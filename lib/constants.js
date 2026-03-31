export const HOME_WORKSPACE_INDEX = 0;
export const BLUR_MY_SHELL_UUID = 'blur-my-shell@aunetx';

export const SETTINGS_SCHEMA_ID = 'org.gnome.shell.extensions.harbor-workspaces';

export const SETTINGS_KEYS = {
    ENABLED_ON_SINGLE_MONITOR_ONLY: 'enabled-on-single-monitor-only',
    HIDE_TOP_BAR_ON_SECONDARY_WORKSPACES: 'hide-top-bar-on-secondary-workspaces',
    HIDE_DOCK_ON_SECONDARY_WORKSPACES: 'hide-dock-on-secondary-workspaces',
    DISABLE_BLUR_MY_SHELL_PANEL_BLUR_ON_SECONDARY_WORKSPACES:
        'disable-blur-my-shell-panel-blur-on-secondary-workspaces',
    REDIRECT_EMPTY_SECONDARY_WORKSPACES: 'redirect-empty-secondary-workspaces',
    RETURN_HOME_ON_CLOSE_FROM_SECONDARY: 'return-home-on-close-from-secondary',
    ANIMATE_CHROME_TRANSITIONS: 'animate-chrome-transitions',
    CHROME_FADE_DURATION_MS: 'chrome-fade-duration-ms',
    EXCLUDED_GTK_APPLICATION_IDS: 'excluded-gtk-application-ids',
    EXCLUDED_WM_CLASSES: 'excluded-wm-classes',
};

export const DEFAULT_EXCLUDED_GTK_APPLICATION_IDS = [
    'com.github.amezin.ddterm',
];

export const DEFAULT_EXCLUDED_WM_CLASSES = [
    'Com.github.amezin.ddterm',
    'DropDownTerminalWindow',
];
