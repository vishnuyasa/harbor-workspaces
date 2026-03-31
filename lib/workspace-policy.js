import Meta from 'gi://Meta';

import {HOME_WORKSPACE_INDEX} from './constants.js';
import {
    getCompactedWorkspaceCount,
    getEmptySecondaryFallbackIndex,
    shouldRedirectFromEmptySecondary,
} from './policy-model.js';
import {
    shouldRedirectEmptySecondaryWorkspaces,
} from './settings.js';

export class HarborWorkspacePolicy {
    constructor(settings, mutterSettings, workspacePreferences, integrations, isFeatureEnabled) {
        this._settings = settings;
        this._mutterSettings = mutterSettings;
        this._workspacePreferences = workspacePreferences;
        this._integrations = integrations;
        this._isFeatureEnabled = isFeatureEnabled;
        this._cleanupIdleId = 0;
        this._returnHomeOnNextCompact = false;
        this._emptySecondaryWorkspaceGuardLaterId = 0;
        this._windowIdsSizeChange = new Map();
    }

    destroy() {
        if (this._cleanupIdleId !== 0)
            global.compositor.get_laters().remove(this._cleanupIdleId);
        if (this._emptySecondaryWorkspaceGuardLaterId !== 0)
            global.compositor.get_laters().remove(this._emptySecondaryWorkspaceGuardLaterId);

        this._cleanupIdleId = 0;
        this._emptySecondaryWorkspaceGuardLaterId = 0;
        this._returnHomeOnNextCompact = false;
        this._windowIdsSizeChange.clear();
    }

    getWorkspaceManager(win = null) {
        if (win)
            return win.get_display().get_workspace_manager();

        return global.workspace_manager;
    }

    applyWorkspaceMode(savedDynamicWorkspaces, savedNumWorkspaces = null) {
        if (this._isFeatureEnabled()) {
            this._mutterSettings.set_boolean('dynamic-workspaces', false);
            if (this._workspacePreferences.get_int('num-workspaces') < HOME_WORKSPACE_INDEX + 2)
                this._workspacePreferences.set_int('num-workspaces', HOME_WORKSPACE_INDEX + 2);
            this.queueCompactSecondaryWorkspaces();
            this.scheduleEmptySecondaryWorkspaceGuard();
        } else if (savedDynamicWorkspaces !== null) {
            this._mutterSettings.set_boolean('dynamic-workspaces', savedDynamicWorkspaces);
            if (savedNumWorkspaces !== null)
                this._workspacePreferences.set_int('num-workspaces', savedNumWorkspaces);
        }
    }

    shouldManageWindow(win) {
        return this._isFeatureEnabled() &&
            win?.window_type === Meta.WindowType.NORMAL &&
            !this._integrations.isWorkspaceAgnosticWindow(win);
    }

    getWorkspaceWindows(workspace) {
        return workspace.list_windows().filter(window => this.shouldManageWindow(window));
    }

    ensureWorkspaceCount(targetCount) {
        if (this._workspacePreferences.get_int('num-workspaces') < targetCount)
            this._workspacePreferences.set_int('num-workspaces', targetCount);
    }

    getFirstFreeSecondaryWorkspaceIndex(manager) {
        const nWorkspaces = manager.get_n_workspaces();

        for (let i = HOME_WORKSPACE_INDEX + 1; i < nWorkspaces; i++) {
            const workspace = manager.get_workspace_by_index(i);

            if (this.getWorkspaceWindows(workspace).length === 0)
                return i;
        }

        return nWorkspaces;
    }

    moveToHomeWorkspace(win) {
        const manager = win.get_display().get_workspace_manager();
        const homeWorkspace = manager.get_workspace_by_index(HOME_WORKSPACE_INDEX);

        if (!homeWorkspace)
            return;

        if (win.get_workspace().index() !== HOME_WORKSPACE_INDEX)
            win.change_workspace_by_index(HOME_WORKSPACE_INDEX, false);

        homeWorkspace.activate(global.get_current_time());
    }

    placeOnSecondaryWorkspace(win) {
        const manager = win.get_display().get_workspace_manager();
        const currentWorkspace = win.get_workspace();

        if (!currentWorkspace)
            return;

        const currentWorkspaceIndex = currentWorkspace.index();
        const otherManagedWindows = this.getWorkspaceWindows(currentWorkspace)
            .filter(window => window !== win);

        if (currentWorkspaceIndex > HOME_WORKSPACE_INDEX &&
            otherManagedWindows.length === 0)
            return;

        const targetIndex = this.getFirstFreeSecondaryWorkspaceIndex(manager);
        this.ensureWorkspaceCount(targetIndex + 1);
        win.change_workspace_by_index(targetIndex, false);

        const targetWorkspace = manager.get_workspace_by_index(targetIndex);
        if (targetWorkspace)
            targetWorkspace.activate(global.get_current_time());

        this.queueCompactSecondaryWorkspaces();
    }

    compactSecondaryWorkspaces(returnHomeIfActiveSecondaryEmpty = false) {
        const manager = this.getWorkspaceManager();
        const occupiedGroups = [];
        const nWorkspaces = manager.get_n_workspaces();

        for (let i = HOME_WORKSPACE_INDEX + 1; i < nWorkspaces; i++) {
            const workspace = manager.get_workspace_by_index(i);
            const windows = this.getWorkspaceWindows(workspace);

            if (windows.length > 0)
                occupiedGroups.push(windows);
        }

        let targetIndex = HOME_WORKSPACE_INDEX + 1;
        for (const windows of occupiedGroups) {
            for (const window of windows)
                window.change_workspace_by_index(targetIndex, false);

            targetIndex++;
        }

        const targetCount = getCompactedWorkspaceCount(occupiedGroups.length, HOME_WORKSPACE_INDEX);
        const activeIndex = manager.get_active_workspace_index();

        if (activeIndex >= targetCount) {
            const fallbackWorkspace = manager.get_workspace_by_index(targetCount - 1);

            if (fallbackWorkspace)
                fallbackWorkspace.activate(global.get_current_time());
        } else if (returnHomeIfActiveSecondaryEmpty && activeIndex > HOME_WORKSPACE_INDEX) {
            const activeWorkspace = manager.get_workspace_by_index(activeIndex);
            const activeWorkspaceWindows = activeWorkspace
                ? this.getWorkspaceWindows(activeWorkspace)
                : [];

            if (activeWorkspaceWindows.length === 0) {
                const homeWorkspace = manager.get_workspace_by_index(HOME_WORKSPACE_INDEX);

                if (homeWorkspace)
                    homeWorkspace.activate(global.get_current_time());
            }
        }

        if (this._workspacePreferences.get_int('num-workspaces') !== targetCount)
            this._workspacePreferences.set_int('num-workspaces', targetCount);
    }

    queueCompactSecondaryWorkspaces(returnHomeIfActiveSecondaryEmpty = false) {
        this._returnHomeOnNextCompact ||= returnHomeIfActiveSecondaryEmpty;

        if (this._cleanupIdleId !== 0)
            return;

        this._cleanupIdleId = global.compositor.get_laters().add(
            Meta.LaterType.BEFORE_REDRAW,
            () => {
                this._cleanupIdleId = 0;
                const returnHome = this._returnHomeOnNextCompact;
                this._returnHomeOnNextCompact = false;
                this.compactSecondaryWorkspaces(returnHome);
                return false;
            }
        );
    }

    enforceValidActiveWorkspace() {
        if (!this._isFeatureEnabled() ||
            !shouldRedirectEmptySecondaryWorkspaces(this._settings))
            return;

        const manager = this.getWorkspaceManager();
        const activeIndex = manager.get_active_workspace_index();

        if (!shouldRedirectFromEmptySecondary(activeIndex, HOME_WORKSPACE_INDEX))
            return;

        const activeWorkspace = manager.get_workspace_by_index(activeIndex);
        const activeWorkspaceWindows = activeWorkspace
            ? this.getWorkspaceWindows(activeWorkspace)
            : [];

        if (activeWorkspaceWindows.length === 0) {
            const fallbackIndex = getEmptySecondaryFallbackIndex(
                activeIndex,
                HOME_WORKSPACE_INDEX
            );
            const fallbackWorkspace = manager.get_workspace_by_index(fallbackIndex);

            if (fallbackWorkspace)
                fallbackWorkspace.activate(global.get_current_time());
        }
    }

    scheduleEmptySecondaryWorkspaceGuard() {
        if (this._emptySecondaryWorkspaceGuardLaterId !== 0)
            return;

        this._emptySecondaryWorkspaceGuardLaterId = global.compositor.get_laters().add(
            Meta.LaterType.BEFORE_REDRAW,
            () => {
                this._emptySecondaryWorkspaceGuardLaterId = 0;
                this.enforceValidActiveWorkspace();
                return false;
            }
        );
    }

    handleWindowMapped(win) {
        if (!this.shouldManageWindow(win))
            return;

        if (win.get_maximized() === Meta.MaximizeFlags.BOTH) {
            this.placeOnSecondaryWorkspace(win);
            return;
        }

        this.moveToHomeWorkspace(win);
        this.queueCompactSecondaryWorkspaces();
    }

    handleWindowDestroyed(win, returnHomeIfActiveSecondaryEmpty = false) {
        if (!this.shouldManageWindow(win))
            return;

        this.queueCompactSecondaryWorkspaces(returnHomeIfActiveSecondaryEmpty);
    }

    handleWindowSizeChange(win, change, oldRect) {
        if (!this.shouldManageWindow(win))
            return;

        if (change === Meta.SizeChange.MAXIMIZE) {
            if (win.get_maximized() === Meta.MaximizeFlags.BOTH)
                this._windowIdsSizeChange.set(win.get_id(), 'place-secondary');
            return;
        }

        if (change === Meta.SizeChange.FULLSCREEN) {
            this._windowIdsSizeChange.set(win.get_id(), 'place-secondary');
            return;
        }

        if (change === Meta.SizeChange.UNMAXIMIZE) {
            const maximizedRect = win.get_work_area_for_monitor(win.get_monitor());

            if (maximizedRect.equal(oldRect))
                this._windowIdsSizeChange.set(win.get_id(), 'back-home');
            return;
        }

        if (change === Meta.SizeChange.UNFULLSCREEN &&
            win.get_maximized() !== Meta.MaximizeFlags.BOTH) {
            this._windowIdsSizeChange.set(win.get_id(), 'back-home');
        }
    }

    handleWindowSizeChanged(win) {
        const action = this._windowIdsSizeChange.get(win.get_id());

        if (!action)
            return;

        if (action === 'place-secondary') {
            this.placeOnSecondaryWorkspace(win);
        } else if (action === 'back-home') {
            this.moveToHomeWorkspace(win);
            this.queueCompactSecondaryWorkspaces();
        }

        this._windowIdsSizeChange.delete(win.get_id());
    }

    handleWindowMinimized() {
        this.queueCompactSecondaryWorkspaces();
    }

    handleWindowUnminimized() {
        this.queueCompactSecondaryWorkspaces();
    }

    handleWorkspaceSwitched() {
        this.scheduleEmptySecondaryWorkspaceGuard();
    }
}
