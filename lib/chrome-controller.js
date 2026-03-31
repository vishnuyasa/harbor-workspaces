import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {HOME_WORKSPACE_INDEX} from './constants.js';
import {
    getChromeFadeDuration,
    shouldAnimateChromeTransitions,
    shouldHideDockOnSecondaryWorkspaces,
    shouldHideTopBarOnSecondaryWorkspaces,
} from './settings.js';

export class HarborChromeController {
    constructor(settings, integrations, isFeatureEnabled, getWorkspaceManager) {
        this._settings = settings;
        this._integrations = integrations;
        this._isFeatureEnabled = isFeatureEnabled;
        this._getWorkspaceManager = getWorkspaceManager;
        this._chromeVisibilityTimeoutId = 0;
        this._chromeVisibilityFollowupTimeoutId = 0;
    }

    destroy() {
        if (this._chromeVisibilityTimeoutId !== 0)
            GLib.source_remove(this._chromeVisibilityTimeoutId);
        if (this._chromeVisibilityFollowupTimeoutId !== 0)
            GLib.source_remove(this._chromeVisibilityFollowupTimeoutId);

        this._chromeVisibilityTimeoutId = 0;
        this._chromeVisibilityFollowupTimeoutId = 0;
        this.setActorVisibility(Main.panel, true, false);
        for (const actor of this._integrations.getBlurPanelActors())
            this.setActorVisibility(actor, true, false);
        for (const actor of this._integrations.getDockActors())
            this.setActorVisibility(actor, true, false);
    }

    setActorVisibility(actor, visible, animate = shouldAnimateChromeTransitions(this._settings)) {
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
            duration: getChromeFadeDuration(this._settings),
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onStopped: () => {
                if (!visible)
                    actor.hide();
            },
        });
    }

    updateVisibility() {
        const isMainWorkspace = !this._isFeatureEnabled() ||
            this._getWorkspaceManager().get_active_workspace_index() === HOME_WORKSPACE_INDEX;
        const showTopBar = isMainWorkspace ||
            !shouldHideTopBarOnSecondaryWorkspaces(this._settings);
        const showDock = isMainWorkspace ||
            !shouldHideDockOnSecondaryWorkspaces(this._settings);

        this._integrations.syncBlurMyShellPanelBlur(isMainWorkspace);
        this.setActorVisibility(Main.panel, showTopBar);
        for (const actor of this._integrations.getBlurPanelActors())
            this.setActorVisibility(actor, showTopBar);

        for (const actor of this._integrations.getDockActors())
            this.setActorVisibility(actor, showDock);
    }

    scheduleUpdate() {
        if (this._chromeVisibilityTimeoutId !== 0) {
            GLib.source_remove(this._chromeVisibilityTimeoutId);
            this._chromeVisibilityTimeoutId = 0;
        }

        if (this._chromeVisibilityFollowupTimeoutId !== 0) {
            GLib.source_remove(this._chromeVisibilityFollowupTimeoutId);
            this._chromeVisibilityFollowupTimeoutId = 0;
        }

        const isMainWorkspace =
            this._getWorkspaceManager().get_active_workspace_index() === HOME_WORKSPACE_INDEX;

        if (isMainWorkspace) {
            this.updateVisibility();
            return;
        }

        this._chromeVisibilityTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            140,
            () => {
                this._chromeVisibilityTimeoutId = 0;
                this.updateVisibility();

                this._chromeVisibilityFollowupTimeoutId = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    260,
                    () => {
                        this._chromeVisibilityFollowupTimeoutId = 0;
                        this.updateVisibility();
                        return GLib.SOURCE_REMOVE;
                    }
                );

                return GLib.SOURCE_REMOVE;
            }
        );
    }
}
