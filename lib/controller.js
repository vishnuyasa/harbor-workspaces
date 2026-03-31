import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {SETTINGS_KEYS} from './constants.js';
import {HarborChromeController} from './chrome-controller.js';
import {HarborIntegrations} from './integrations.js';
import {shouldOnlyRunOnSingleMonitor, shouldReturnHomeOnCloseFromSecondary} from './settings.js';
import {HarborWorkspacePolicy} from './workspace-policy.js';

export class HarborController {
    constructor(extension, settings) {
        this._extension = extension;
        this._settings = settings;
        this._signals = [];
        this._mutterSettings = new Gio.Settings({schema_id: 'org.gnome.mutter'});
        this._workspacePreferences =
            new Gio.Settings({schema_id: 'org.gnome.desktop.wm.preferences'});
        this._savedDynamicWorkspaces = this._mutterSettings.get_boolean('dynamic-workspaces');
        this._savedNumWorkspaces = this._workspacePreferences.get_int('num-workspaces');

        this._integrations = new HarborIntegrations(extension.path, settings);
        this._workspacePolicy = new HarborWorkspacePolicy(
            settings,
            this._mutterSettings,
            this._workspacePreferences,
            this._integrations,
            () => this.isFeatureEnabled()
        );
        this._chromeController = new HarborChromeController(
            settings,
            this._integrations,
            () => this.isFeatureEnabled(),
            () => global.workspace_manager
        );
    }

    enable() {
        this._connectSignal(this._settings, 'changed', (_, key) => this._handleSettingsChanged(key));
        this._connectSignal(global.window_manager, 'minimize',
            (_, actor) => this._workspacePolicy.handleWindowMinimized(actor?.meta_window));
        this._connectSignal(global.window_manager, 'unminimize',
            (_, actor) => this._workspacePolicy.handleWindowUnminimized(actor?.meta_window));
        this._connectSignal(global.window_manager, 'size-changed',
            (_, actor) => this._workspacePolicy.handleWindowSizeChanged(actor.meta_window));
        this._connectSignal(global.window_manager, 'switch-workspace',
            () => this._handleWorkspaceSwitched());
        this._connectSignal(Main.layoutManager, 'monitors-changed',
            () => this._handleMonitorsChanged());
        this._connectSignal(global.window_manager, 'map',
            (_, actor) => this._workspacePolicy.handleWindowMapped(actor.meta_window));
        this._connectSignal(global.window_manager, 'destroy',
            (_, actor) => this._workspacePolicy.handleWindowDestroyed(
                actor.meta_window,
                shouldReturnHomeOnCloseFromSecondary(this._settings)
            ));
        this._connectSignal(global.window_manager, 'size-change',
            (_, actor, change, oldRect) =>
                this._workspacePolicy.handleWindowSizeChange(actor.meta_window, change, oldRect));

        this._workspacePolicy.applyWorkspaceMode(
            this._savedDynamicWorkspaces,
            this._savedNumWorkspaces
        );
        this._chromeController.updateVisibility();
    }

    destroy() {
        this._disconnectAllSignals();
        this._workspacePolicy.destroy();
        this._chromeController.destroy();
        this._integrations.destroy();

        if (this._savedNumWorkspaces !== null)
            this._workspacePreferences.set_int('num-workspaces', this._savedNumWorkspaces);
        if (this._savedDynamicWorkspaces !== null)
            this._mutterSettings.set_boolean('dynamic-workspaces', this._savedDynamicWorkspaces);
    }

    getMonitorCount() {
        return Main.layoutManager?.monitors?.length ?? global.display.get_n_monitors();
    }

    isFeatureEnabled() {
        return !shouldOnlyRunOnSingleMonitor(this._settings) || this.getMonitorCount() <= 1;
    }

    _connectSignal(emitter, signal, handler) {
        const id = emitter.connect(signal, handler);
        this._signals.push({emitter, id});
    }

    _disconnectAllSignals() {
        for (const {emitter, id} of this._signals.splice(0)) {
            try {
                emitter.disconnect(id);
            } catch (error) {
                // Ignore stale signals during shell reloads.
            }
        }
    }

    _handleWorkspaceSwitched() {
        this._integrations.captureVisibleWorkspaceAgnosticWindows();
        this._workspacePolicy.handleWorkspaceSwitched();
        this._chromeController.scheduleUpdate();
        this._integrations.scheduleWorkspaceAgnosticWindowRefresh();
    }

    _handleMonitorsChanged() {
        this._workspacePolicy.applyWorkspaceMode(
            this._savedDynamicWorkspaces,
            this._savedNumWorkspaces
        );
        this._chromeController.updateVisibility();
    }

    _handleSettingsChanged(key) {
        if ([
            SETTINGS_KEYS.ENABLED_ON_SINGLE_MONITOR_ONLY,
            SETTINGS_KEYS.REDIRECT_EMPTY_SECONDARY_WORKSPACES,
            SETTINGS_KEYS.RETURN_HOME_ON_CLOSE_FROM_SECONDARY,
            SETTINGS_KEYS.EXCLUDED_GTK_APPLICATION_IDS,
            SETTINGS_KEYS.EXCLUDED_WM_CLASSES,
        ].includes(key)) {
            this._workspacePolicy.applyWorkspaceMode(
                this._savedDynamicWorkspaces,
                this._savedNumWorkspaces
            );
        }

        this._chromeController.scheduleUpdate();
    }
}
