/* extension.js
 *
 * Harbor Workspaces is a fork of Maximize To Empty Workspace with
 * custom behavior for a persistent home workspace, focused maximized
 * workspaces, and workspace-specific shell chrome visibility.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
//  _mutterSettings.get_boolean('workspaces-only-on-primary');
//  _mutterSettings.get_boolean('dynamic-workspaces');

const _handles = [];

const _windowids_maximized = {};
const _windowids_size_change = {};
const MAIN_WORKSPACE_INDEX = 0;
const CHROME_FADE_DURATION = 180;

export default class Extension {
 
    constructor() {
        this._cleanupIdleId = 0;
        this._chromeVisibilityTimeoutId = 0;
        this._savedDynamicWorkspaces = null;
        this._savedNumWorkspaces = null;
    }

    getWorkspaceManager(win = null) {
        if (win)
            return win.get_display().get_workspace_manager();

        return global.workspace_manager;
    }

    getMonitorCount() {
        return Main.layoutManager?.monitors?.length ?? global.display.get_n_monitors();
    }

    isFeatureEnabled() {
        return this.getMonitorCount() <= 1;
    }

    applyWorkspaceMode() {
        if (this._chromeVisibilityTimeoutId !== 0) {
            GLib.source_remove(this._chromeVisibilityTimeoutId);
            this._chromeVisibilityTimeoutId = 0;
        }

        if (this.isFeatureEnabled()) {
            this._mutterSettings.set_boolean('dynamic-workspaces', false);
            if (this._workspacePreferences.get_int('num-workspaces') < MAIN_WORKSPACE_INDEX + 2)
                this._workspacePreferences.set_int('num-workspaces', MAIN_WORKSPACE_INDEX + 2);
            this.queueCompactSecondaryWorkspaces();
        } else {
            this._mutterSettings.set_boolean('dynamic-workspaces', this._savedDynamicWorkspaces);
            this.updateChromeVisibility();
        }
    }

    isWorkspaceAgnosticWindow(win) {
        if (!win)
            return false;

        const gtkApplicationId = win.get_gtk_application_id?.();
        const wmClass = win.get_wm_class?.();

        return win.is_always_on_all_workspaces() ||
            win.is_skip_taskbar?.() ||
            gtkApplicationId === 'com.github.amezin.ddterm' ||
            wmClass === 'Com.github.amezin.ddterm' ||
            wmClass === 'DropDownTerminalWindow';
    }

    shouldManageWindow(win) {
        return this.isFeatureEnabled() &&
            win?.window_type === Meta.WindowType.NORMAL &&
            !this.isWorkspaceAgnosticWindow(win);
    }

    getWorkspaceWindows(workspace) {
        return workspace.list_windows().filter(w => this.shouldManageWindow(w));
    }

    ensureWorkspaceCount(targetCount) {
        if (this._workspacePreferences.get_int('num-workspaces') < targetCount)
            this._workspacePreferences.set_int('num-workspaces', targetCount);
    }

    getFirstFreeSecondaryWorkspaceIndex(manager) {
        const n = manager.get_n_workspaces();

        for (let i = MAIN_WORKSPACE_INDEX + 1; i < n; i++) {
            const workspace = manager.get_workspace_by_index(i);

            if (this.getWorkspaceWindows(workspace).length === 0)
                return i;
        }

        return n;
    }

    moveToMainWorkspace(win) {
        const manager = win.get_display().get_workspace_manager();
        const mainWorkspace = manager.get_workspace_by_index(MAIN_WORKSPACE_INDEX);

        if (!mainWorkspace)
            return;

        if (win.get_workspace().index() !== MAIN_WORKSPACE_INDEX)
            win.change_workspace_by_index(MAIN_WORKSPACE_INDEX, false);

        mainWorkspace.activate(global.get_current_time());
    }

    placeOnSecondaryWorkspace(win) {
        const manager = win.get_display().get_workspace_manager();
        const currentWorkspace = win.get_workspace();

        if (!currentWorkspace)
            return;

        const currentIndex = currentWorkspace.index();
        if (currentIndex > MAIN_WORKSPACE_INDEX)
            return;

        const targetIndex = this.getFirstFreeSecondaryWorkspaceIndex(manager);

        this.ensureWorkspaceCount(targetIndex + 1);
        win.change_workspace_by_index(targetIndex, false);

        const targetWorkspace = manager.get_workspace_by_index(targetIndex);
        if (targetWorkspace)
            targetWorkspace.activate(global.get_current_time());

        this.queueCompactSecondaryWorkspaces();
    }

    compactSecondaryWorkspaces() {
        const manager = this.getWorkspaceManager();
        const occupiedGroups = [];
        const n = manager.get_n_workspaces();

        for (let i = MAIN_WORKSPACE_INDEX + 1; i < n; i++) {
            const workspace = manager.get_workspace_by_index(i);
            const windows = this.getWorkspaceWindows(workspace);

            if (windows.length > 0)
                occupiedGroups.push(windows);
        }

        let targetIndex = MAIN_WORKSPACE_INDEX + 1;
        for (const windows of occupiedGroups) {
            for (const window of windows)
                window.change_workspace_by_index(targetIndex, false);

            targetIndex++;
        }

        // Keep workspace 1 as the persistent home workspace. Additional
        // secondary workspaces are created only when a maximize actually needs
        // them, rather than keeping a spare one around all the time.
        const targetCount = Math.max(MAIN_WORKSPACE_INDEX + 2, targetIndex);
        const activeIndex = manager.get_active_workspace_index();

        if (activeIndex >= targetCount) {
            const fallbackWorkspace = manager.get_workspace_by_index(targetCount - 1);

            if (fallbackWorkspace)
                fallbackWorkspace.activate(global.get_current_time());
        }

        if (this._workspacePreferences.get_int('num-workspaces') !== targetCount)
            this._workspacePreferences.set_int('num-workspaces', targetCount);
    }

    queueCompactSecondaryWorkspaces() {
        if (this._cleanupIdleId !== 0)
            return;

        this._cleanupIdleId = global.compositor.get_laters().add(
            Meta.LaterType.BEFORE_REDRAW,
            () => {
                this._cleanupIdleId = 0;
                this.compactSecondaryWorkspaces();
                return false;
            }
        );
    }

    getDockActors() {
        const chromeGroup = Main.layoutManager?.uiGroup ?? Main.uiGroup;

        if (!chromeGroup)
            return [];

        return chromeGroup.get_children().filter(actor => actor?.name === 'dashtodockContainer');
    }

    setActorVisibility(actor, visible, animate = true) {
        if (!actor)
            return;

        actor.remove_all_transitions();
        actor.reactive = visible;
        actor.can_focus = visible;

        if (!animate) {
            actor.opacity = visible ? 255 : 0;
            if (visible)
                actor.show();
            else
                actor.hide();
            return;
        }

        if (visible) {
            actor.opacity = 0;
            actor.show();
        }

        actor.ease({
            opacity: visible ? 255 : 0,
            duration: CHROME_FADE_DURATION,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onStopped: () => {
                if (!visible)
                    actor.hide();
            },
        });
    }

    updateChromeVisibility() {
        const isMainWorkspace = !this.isFeatureEnabled() ||
            this.getWorkspaceManager().get_active_workspace_index() === MAIN_WORKSPACE_INDEX;

        this.setActorVisibility(Main.panel, isMainWorkspace);

        for (const actor of this.getDockActors())
            this.setActorVisibility(actor, isMainWorkspace);
    }

    scheduleChromeVisibilityUpdate() {
        if (this._chromeVisibilityTimeoutId !== 0) {
            GLib.source_remove(this._chromeVisibilityTimeoutId);
            this._chromeVisibilityTimeoutId = 0;
        }

        const isMainWorkspace = this.getWorkspaceManager().get_active_workspace_index() === MAIN_WORKSPACE_INDEX;
        if (isMainWorkspace) {
            this.updateChromeVisibility();
            return;
        }

        this._chromeVisibilityTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            140,
            () => {
                this._chromeVisibilityTimeoutId = 0;
                this.updateChromeVisibility();
                return GLib.SOURCE_REMOVE;
            }
        );
    }
    
    // First free workspace on the specified monitor
    getFirstFreeMonitor(manager,mMonitor) {
        const n = manager.get_n_workspaces();
        for (let i = 0; i < n; i++) 
        {
            let win_count = manager.get_workspace_by_index(i).list_windows().filter(w => !w.is_always_on_all_workspaces() && w.get_monitor()==mMonitor).length;
            if (win_count < 1) 
                return i; 
        }
        return -1;
    }
    
    // last occupied workspace on the specified monitor
    getLastOcupiedMonitor(manager,nCurrent,mMonitor) {
        for (let i = nCurrent-1; i >= 0; i--) 
        {
            let win_count = manager.get_workspace_by_index(i).list_windows().filter(w => !w.is_always_on_all_workspaces() && w.get_monitor()==mMonitor).length;
            if (win_count > 0) 
                return i;
        }
        const n = manager.get_n_workspaces();
        for (let i = nCurrent + 1; i < n; i++) 
        {
            let win_count = manager.get_workspace_by_index(i).list_windows().filter(w => !w.is_always_on_all_workspaces() && w.get_monitor()==mMonitor).length;
            if (win_count > 0) 
                return i; 
        }
        return -1;
    }
    
    placeOnWorkspace(win) {
        //console.log("achim","placeOnWorkspace:"+win.get_id());
        // bMap true - new windows to end of workspaces
        const bMap = false;

        // Idea: don't move the coresponding window to an other workspace (it may be not fully active yet)
        // Reorder the workspaces and move all other window

        const mMonitor=win.get_monitor();
        const wList = win.get_workspace().list_windows().filter(w => w!==win && !w.is_always_on_all_workspaces() && w.get_monitor()==mMonitor);
        if (wList.length >= 1) 
            {
            const manager = win.get_display().get_workspace_manager();
            const current = manager.get_active_workspace_index();
            if (this._mutterSettings.get_boolean('workspaces-only-on-primary'))
                {
                const mPrimary=win.get_display().get_primary_monitor();
                // Only primary monitor is relevant, others don't have multiple workspaces
                if (mMonitor!=mPrimary) 
                    return;
                const firstfree=this.getFirstFreeMonitor(manager,mMonitor);
                // No free monitor: do nothing
                if (firstfree==-1)
                    return;
                if (current<firstfree)
                    {
                    if (bMap)
                        {
                        // show new window on next free monitor (last on dynamic workspaces)
                        manager.reorder_workspace(manager.get_workspace_by_index(firstfree),current);
                        manager.reorder_workspace(manager.get_workspace_by_index(current+1),firstfree);
                        // move the other windows to their old places
                        wList.forEach( w => {w.change_workspace_by_index(current, false);});
                        }
                    else
                        {
                        // alternative, works too
                        //win.change_workspace_by_index(firstfree, false);
                        //manager.reorder_workspace(manager.get_workspace_by_index(firstfree),current+1);
                        //manager.get_workspace_by_index(current+1).activate(global.get_current_time());
                        
                        // insert existing window on next monitor (each other workspace is moved one index further)
                        manager.reorder_workspace(manager.get_workspace_by_index(firstfree),current);
                        // move the other windows to their old places
                        wList.forEach( w => {w.change_workspace_by_index(current, false);});
                        }
                    // remember reordered window
                    _windowids_maximized[win.get_id()] = "reorder";
                    }
                else if (current>firstfree)
                    {
                    // show window on next free monitor (doesn't happen with dynamic workspaces)
                    manager.reorder_workspace(manager.get_workspace_by_index(current),firstfree);
                    manager.reorder_workspace(manager.get_workspace_by_index(firstfree+1),current);
                    // move the other windows to their old places
                    wList.forEach( w => {w.change_workspace_by_index(current, false);});
                    // remember reordered window
                    _windowids_maximized[win.get_id()] = "reorder";
                    }
                }
            else
                {
                // All monitors have workspaces
                // search the workspaces for a free monitor on the same index
                const firstfree=this.getFirstFreeMonitor(manager,mMonitor);
                // No free monitor: do nothing
                if (firstfree==-1)
                    return;
                // show the window on the workspace with the empty monitor
                const wListcurrent = win.get_workspace().list_windows().filter(w => w!==win && !w.is_always_on_all_workspaces());
                const wListfirstfree = manager.get_workspace_by_index(firstfree).list_windows().filter(w => w!==win && !w.is_always_on_all_workspaces());
                if (current<firstfree)
                    {
                    manager.reorder_workspace(manager.get_workspace_by_index(firstfree),current);
                    manager.reorder_workspace(manager.get_workspace_by_index(current+1),firstfree);
                    // move the other windows to their old places
                    wListcurrent.forEach( w => {w.change_workspace_by_index(current, false);});
                    wListfirstfree.forEach( w => {w.change_workspace_by_index(firstfree, false);});
                    // remember reordered window
                    _windowids_maximized[win.get_id()] = "reorder";
                    }
                else if (current>firstfree)
                    {
                    manager.reorder_workspace(manager.get_workspace_by_index(current),firstfree);
                    manager.reorder_workspace(manager.get_workspace_by_index(firstfree+1),current);
                    // move the other windows to their old places
                    wListcurrent.forEach( w => {w.change_workspace_by_index(current, false);});
                    wListfirstfree.forEach( w => {w.change_workspace_by_index(firstfree, false);});
                    // remember reordered window
                    _windowids_maximized[win.get_id()] = "reorder";
                    }
                }
            }
    }

    // back to last workspace
    backto(win) {

        //console.log("achim","backto "+win.get_id());
        
        // Idea: don't move the coresponding window to an other workspace (it may be not fully active yet)
        // Reorder the workspaces and move all other window
        
        if (!(win.get_id() in _windowids_maximized))
            {
            // no new screen is used in the past: do nothing
            return;
            }
        
        // this is not longer maximized
        delete _windowids_maximized[win.get_id()];


        const mMonitor=win.get_monitor();
        const wList = win.get_workspace().list_windows().filter(w => w!==win && !w.is_always_on_all_workspaces() && w.get_monitor()==mMonitor);
        if (wList.length == 0) 
            {
            const manager = win.get_display().get_workspace_manager();
            const current = manager.get_active_workspace_index();
            if (this._mutterSettings.get_boolean('workspaces-only-on-primary'))
                {
                const mPrimary=win.get_display().get_primary_monitor();
                // Only primary monitor is relevant, others don't have multiple workspaces
                if (mMonitor!=mPrimary) 
                    return;
                const lastocupied=this.getLastOcupiedMonitor(manager,current,mMonitor);
                // No occupied monitor: do nothing
                //log("lastocupied "+ lastocupied);
                if (lastocupied==-1)
                    return;
                const wListlastoccupied = manager.get_workspace_by_index(lastocupied).list_windows().filter(w => w!==win && !w.is_always_on_all_workspaces() && w.get_monitor()==mMonitor);
                // switch workspace position to last with windows and move all windows there
                manager.reorder_workspace(manager.get_workspace_by_index(current),lastocupied);
                wListlastoccupied.forEach( w => {w.change_workspace_by_index(lastocupied, false);});
                }
            else
                {
                const lastocupied=this.getLastOcupiedMonitor(manager,current,mMonitor);
                // No occupied monitor: do nothing
                if (lastocupied==-1)
                    return;
                const wListcurrent = win.get_workspace().list_windows().filter(w => w!==win && !w.is_always_on_all_workspaces());
                if (wListcurrent.length > 0) 
                    return;
                const wListlastoccupied = manager.get_workspace_by_index(lastocupied).list_windows().filter(w => w!==win && !w.is_always_on_all_workspaces());
                // switch workspace position to last with windows and move all windows there
                manager.reorder_workspace(manager.get_workspace_by_index(current),lastocupied);
                wListlastoccupied.forEach( w => {w.change_workspace_by_index(lastocupied, false);});
                }
            }
    }
    
    window_manager_map(act)
    {
        const win = act.meta_window;
        //console.log("achim","window_manager_map "+win.get_id());
        if (!this.shouldManageWindow(win))
            return;

        if (win.get_maximized() === Meta.MaximizeFlags.BOTH) {
            this.placeOnSecondaryWorkspace(win);
            return;
        }

        this.moveToMainWorkspace(win);
        this.queueCompactSecondaryWorkspaces();
    }
    
    window_manager_destroy(act)
    {
        const win = act.meta_window;
        //console.log("achim","window_manager_destroy");
        if (!this.shouldManageWindow(win))
            return;
        this.queueCompactSecondaryWorkspaces();
    }

    window_manager_size_change(act,change,rectold) 
    {
        const win = act.meta_window;
        //console.log("achim","window_manager_size_change "+win.get_id());
        if (!this.shouldManageWindow(win))
            return;
        if (change === Meta.SizeChange.MAXIMIZE)
            {
            //console.log("achim","Meta.SizeChange.MAXIMIZE");
            if (win.get_maximized() === Meta.MaximizeFlags.BOTH)
                {
                //console.log("achim","=== Meta.MaximizeFlags.BOTH");
                _windowids_size_change[win.get_id()]="place-secondary";
                }
            }
        else if (change  === Meta.SizeChange.FULLSCREEN)
            {
            //console.log("achim","Meta.SizeChange.FULLSCREEN");
                _windowids_size_change[win.get_id()]="place-secondary";
            }
        else if (change === Meta.SizeChange.UNMAXIMIZE)
            {
            //console.log("achim","Meta.SizeChange.UNMAXIMIZE");
            // do nothing if it was only partially maximized
            const rectmax=win.get_work_area_for_monitor(win.get_monitor());     
            if (rectmax.equal(rectold))
                {
                //console.log("achim","rectmax matches");
                _windowids_size_change[win.get_id()]="back-main";
                }
            }
        else if (change === Meta.SizeChange.UNFULLSCREEN)
            {
            //console.log("achim","change === Meta.SizeChange.UNFULLSCREEN");
            if (win.get_maximized() !== Meta.MaximizeFlags.BOTH)
                {
                //console.log("achim","!== Meta.MaximizeFlags.BOTH");
                _windowids_size_change[win.get_id()]="back-main";
                }
            }
    }

    window_manager_minimize(act)
    {
        this.queueCompactSecondaryWorkspaces();
    }

    window_manager_unminimize(act)
    {
        this.queueCompactSecondaryWorkspaces();
    }
    
    window_manager_size_changed(act)
    {
        const win = act.meta_window;
        //console.log("achim","window_manager_size_changed "+win.get_id());
        if (win.get_id() in _windowids_size_change) {
            if (_windowids_size_change[win.get_id()]=="place") {                
                this.placeOnWorkspace(win);
            } else if (_windowids_size_change[win.get_id()]=="place-secondary") {
                this.placeOnSecondaryWorkspace(win);
            } else if (_windowids_size_change[win.get_id()]=="back") {                
                this.backto(win);
            } else if (_windowids_size_change[win.get_id()]=="back-main") {
                this.moveToMainWorkspace(win);
                this.queueCompactSecondaryWorkspaces();
            }
            delete _windowids_size_change[win.get_id()];
        }
    }

    window_manager_switch_workspace()
    {
        this.scheduleChromeVisibilityUpdate();
    }

    enable() {
        this._mutterSettings = new Gio.Settings({ schema_id: 'org.gnome.mutter' });
        this._workspacePreferences = new Gio.Settings({ schema_id: 'org.gnome.desktop.wm.preferences' });
        this._savedDynamicWorkspaces = this._mutterSettings.get_boolean('dynamic-workspaces');
        this._savedNumWorkspaces = this._workspacePreferences.get_int('num-workspaces');
        // Trigger new window with maximize size and if the window is maximized
        _handles.push(global.window_manager.connect('minimize', (_, act) => {this.window_manager_minimize(act);}));
        _handles.push(global.window_manager.connect('unminimize', (_, act) => {this.window_manager_unminimize(act);}));
        _handles.push(global.window_manager.connect('size-changed', (_, act) => {this.window_manager_size_changed(act);}));
        _handles.push(global.window_manager.connect('switch-workspace', (_) => {this.window_manager_switch_workspace();}));
        _handles.push(Main.layoutManager.connect('monitors-changed', () => {this.applyWorkspaceMode();}));
        _handles.push(global.window_manager.connect('map', (_, act) => {this.window_manager_map(act);}));
        _handles.push(global.window_manager.connect('destroy', (_, act) => {this.window_manager_destroy(act);}));
        _handles.push(global.window_manager.connect('size-change', (_, act, change,rectold) => {this.window_manager_size_change(act,change,rectold);}));
        this.applyWorkspaceMode();
        this.updateChromeVisibility();
    }

    disable() {
        // remove array and disconect
        _handles.splice(0).forEach(h => global.window_manager.disconnect(h));
        if (this._savedNumWorkspaces !== null)
            this._workspacePreferences.set_int('num-workspaces', this._savedNumWorkspaces);
        if (this._savedDynamicWorkspaces !== null)
            this._mutterSettings.set_boolean('dynamic-workspaces', this._savedDynamicWorkspaces);

        if (this._chromeVisibilityTimeoutId !== 0)
            GLib.source_remove(this._chromeVisibilityTimeoutId);

        this._workspacePreferences = null;
        this._mutterSettings = null;
        this.setActorVisibility(Main.panel, true, false);
        for (const actor of this.getDockActors())
            this.setActorVisibility(actor, true, false);
    }
}
