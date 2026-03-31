import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {
    BLUR_MY_SHELL_UUID,
} from './constants.js';
import {
    getExcludedGtkApplicationIds,
    getExcludedWmClasses,
    shouldDisableBlurMyShellPanelBlurOnSecondaryWorkspaces,
} from './settings.js';

export class HarborIntegrations {
    constructor(extensionPath, settings) {
        this._extensionPath = extensionPath;
        this._settings = settings;
        this._blurMyShellPanelSettings = null;
        this._savedBlurMyShellPanelBlur = null;
        this._workspaceAgnosticRefreshTimeoutId = 0;
        this._visibleWorkspaceAgnosticWindowIds = new Set();

        this._loadBlurMyShellPanelSettings();
    }

    destroy() {
        if (this._workspaceAgnosticRefreshTimeoutId !== 0)
            GLib.source_remove(this._workspaceAgnosticRefreshTimeoutId);

        if (this._blurMyShellPanelSettings && this._savedBlurMyShellPanelBlur !== null) {
            this._blurMyShellPanelSettings.set_boolean(
                'blur',
                this._savedBlurMyShellPanelBlur
            );
        }

        this._workspaceAgnosticRefreshTimeoutId = 0;
        this._visibleWorkspaceAgnosticWindowIds.clear();
        this._blurMyShellPanelSettings = null;
        this._savedBlurMyShellPanelBlur = null;
    }

    _loadBlurMyShellPanelSettings() {
        try {
            const blurExtensionDir = this._getInstalledExtensionDir(BLUR_MY_SHELL_UUID);

            if (!blurExtensionDir)
                return;

            const blurSchemasDir = GLib.build_filenamev([blurExtensionDir, 'schemas']);
            const schemaSource = Gio.SettingsSchemaSource.new_from_directory(
                blurSchemasDir,
                Gio.SettingsSchemaSource.get_default(),
                false
            );
            const schema = schemaSource.lookup(
                'org.gnome.shell.extensions.blur-my-shell.panel',
                true
            );

            if (!schema)
                return;

            this._blurMyShellPanelSettings = new Gio.Settings({settings_schema: schema});
            this._savedBlurMyShellPanelBlur =
                this._blurMyShellPanelSettings.get_boolean('blur');
        } catch (error) {
            this._blurMyShellPanelSettings = null;
            this._savedBlurMyShellPanelBlur = null;
        }
    }

    _getInstalledExtensionDir(uuid) {
        const baseDirs = [
            GLib.build_filenamev([GLib.get_user_data_dir(), 'gnome-shell', 'extensions']),
            ...GLib.get_system_data_dirs().map(dir =>
                GLib.build_filenamev([dir, 'gnome-shell', 'extensions'])
            ),
        ];

        for (const baseDir of baseDirs) {
            const extensionDir = GLib.build_filenamev([baseDir, uuid]);

            if (Gio.File.new_for_path(extensionDir).query_exists(null))
                return extensionDir;
        }

        return null;
    }

    isWorkspaceAgnosticWindow(win) {
        if (!win)
            return false;

        const gtkApplicationId = win.get_gtk_application_id?.()?.trim() ?? '';
        const wmClass = win.get_wm_class?.()?.trim() ?? '';
        const excludedGtkApplicationIds = getExcludedGtkApplicationIds(this._settings);
        const excludedWmClasses = getExcludedWmClasses(this._settings);

        return win.is_always_on_all_workspaces() ||
            win.is_skip_taskbar?.() ||
            excludedGtkApplicationIds.has(gtkApplicationId) ||
            excludedWmClasses.has(wmClass);
    }

    getDockActors() {
        const chromeGroup = Main.layoutManager?.uiGroup ?? Main.uiGroup;

        if (!chromeGroup)
            return [];

        return chromeGroup.get_children().filter(actor => actor?.name === 'dashtodockContainer');
    }

    getBlurPanelActors() {
        const panelBox = Main.layoutManager?.panelBox ?? Main.panel?.get_parent?.();

        if (!panelBox?.get_children)
            return [];

        const blurActors = [];

        for (const actor of panelBox.get_children()) {
            if (actor?.name !== 'bms-panel-backgroundgroup')
                continue;

            blurActors.push(actor);

            if (!actor.get_children)
                continue;

            for (const child of actor.get_children()) {
                if (child?.name === 'bms-panel-blurred-widget')
                    blurActors.push(child);
            }
        }

        return blurActors;
    }

    syncBlurMyShellPanelBlur(isMainWorkspace) {
        if (!this._blurMyShellPanelSettings)
            return;

        const target = shouldDisableBlurMyShellPanelBlurOnSecondaryWorkspaces(this._settings)
            ? (isMainWorkspace ? this._savedBlurMyShellPanelBlur : false)
            : this._savedBlurMyShellPanelBlur;

        if (target === null || target === undefined)
            return;

        if (this._blurMyShellPanelSettings.get_boolean('blur') !== target)
            this._blurMyShellPanelSettings.set_boolean('blur', target);
    }

    captureVisibleWorkspaceAgnosticWindows() {
        this._visibleWorkspaceAgnosticWindowIds = new Set(
            global.get_window_actors()
                .map(actor => actor?.meta_window)
                .filter(win =>
                    this.isWorkspaceAgnosticWindow(win) &&
                    !win.is_hidden?.() &&
                    (win.get_compositor_private?.()?.visible ?? true)
                )
                .map(win => win.get_id())
        );
    }

    refreshVisibleWorkspaceAgnosticWindows() {
        if (this._visibleWorkspaceAgnosticWindowIds.size === 0)
            return;

        for (const actor of global.get_window_actors()) {
            const win = actor?.meta_window;

            if (!win || !this._visibleWorkspaceAgnosticWindowIds.has(win.get_id()))
                continue;

            if (!this.isWorkspaceAgnosticWindow(win))
                continue;

            if (win.stick)
                win.stick();

            if (win.make_above && !win.above)
                win.make_above();

            actor.show?.();
        }

        this._visibleWorkspaceAgnosticWindowIds.clear();
    }

    scheduleWorkspaceAgnosticWindowRefresh() {
        if (this._workspaceAgnosticRefreshTimeoutId !== 0) {
            GLib.source_remove(this._workspaceAgnosticRefreshTimeoutId);
            this._workspaceAgnosticRefreshTimeoutId = 0;
        }

        this._workspaceAgnosticRefreshTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            180,
            () => {
                this._workspaceAgnosticRefreshTimeoutId = 0;
                this.refreshVisibleWorkspaceAgnosticWindows();
                return GLib.SOURCE_REMOVE;
            }
        );
    }
}
