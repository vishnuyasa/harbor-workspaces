import {SETTINGS_KEYS} from './constants.js';

export function getChromeFadeDuration(settings) {
    return Math.max(0, settings.get_int(SETTINGS_KEYS.CHROME_FADE_DURATION_MS));
}

export function shouldAnimateChromeTransitions(settings) {
    return settings.get_boolean(SETTINGS_KEYS.ANIMATE_CHROME_TRANSITIONS);
}

export function shouldHideTopBarOnSecondaryWorkspaces(settings) {
    return settings.get_boolean(SETTINGS_KEYS.HIDE_TOP_BAR_ON_SECONDARY_WORKSPACES);
}

export function shouldHideDockOnSecondaryWorkspaces(settings) {
    return settings.get_boolean(SETTINGS_KEYS.HIDE_DOCK_ON_SECONDARY_WORKSPACES);
}

export function shouldDisableBlurMyShellPanelBlurOnSecondaryWorkspaces(settings) {
    return settings.get_boolean(
        SETTINGS_KEYS.DISABLE_BLUR_MY_SHELL_PANEL_BLUR_ON_SECONDARY_WORKSPACES
    );
}

export function shouldRedirectEmptySecondaryWorkspaces(settings) {
    return settings.get_boolean(SETTINGS_KEYS.REDIRECT_EMPTY_SECONDARY_WORKSPACES);
}

export function shouldReturnHomeOnCloseFromSecondary(settings) {
    return settings.get_boolean(SETTINGS_KEYS.RETURN_HOME_ON_CLOSE_FROM_SECONDARY);
}

export function shouldOnlyRunOnSingleMonitor(settings) {
    return settings.get_boolean(SETTINGS_KEYS.ENABLED_ON_SINGLE_MONITOR_ONLY);
}

function getNormalizedStringSet(settings, key) {
    return new Set(
        settings.get_strv(key)
            .map(value => value.trim())
            .filter(Boolean)
    );
}

export function getExcludedGtkApplicationIds(settings) {
    return getNormalizedStringSet(settings, SETTINGS_KEYS.EXCLUDED_GTK_APPLICATION_IDS);
}

export function getExcludedWmClasses(settings) {
    return getNormalizedStringSet(settings, SETTINGS_KEYS.EXCLUDED_WM_CLASSES);
}
