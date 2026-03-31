import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {SETTINGS_KEYS} from './lib/constants.js';

function bindStringArray(settings, key, row) {
    row.set_text(settings.get_strv(key).join(', '));
    row.connect('changed', () => {
        const values = row.get_text()
            .split(',')
            .map(value => value.trim())
            .filter(Boolean);
        settings.set_strv(key, values);
    });
}

export default class HarborPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        window.set_title(_('Harbor Workspaces'));
        window.set_default_size(720, 640);

        const page = new Adw.PreferencesPage();
        page.add(this._buildGeneralGroup(settings));
        page.add(this._buildWorkspaceGroup(settings));
        page.add(this._buildChromeGroup(settings));
        page.add(this._buildExclusionsGroup(settings));
        window.add(page);
    }

    _buildGeneralGroup(settings) {
        const group = new Adw.PreferencesGroup({
            title: _('General'),
        });

        const singleMonitorOnly = new Adw.SwitchRow({
            title: _('Enable Harbor only on single-monitor setups'),
            subtitle: _('When disabled, Harbor continues to manage workspaces even with external monitors attached.'),
        });
        settings.bind(
            SETTINGS_KEYS.ENABLED_ON_SINGLE_MONITOR_ONLY,
            singleMonitorOnly,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        const homeWorkspaceInfo = new Adw.ActionRow({
            title: _('Home workspace'),
            subtitle: _('Workspace 1 is the fixed Harbor home workspace in this version.'),
        });

        group.add(singleMonitorOnly);
        group.add(homeWorkspaceInfo);
        return group;
    }

    _buildWorkspaceGroup(settings) {
        const group = new Adw.PreferencesGroup({
            title: _('Secondary Workspaces'),
        });

        const redirectEmptySecondary = new Adw.SwitchRow({
            title: _('Redirect empty secondary workspaces'),
            subtitle: _('Empty secondary workspaces behave like a dead end and redirect to the nearest previous workspace.'),
        });
        settings.bind(
            SETTINGS_KEYS.REDIRECT_EMPTY_SECONDARY_WORKSPACES,
            redirectEmptySecondary,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        const returnHomeOnClose = new Adw.SwitchRow({
            title: _('Return home when closing from a secondary workspace'),
            subtitle: _('When the active managed secondary workspace becomes empty after closing a window, focus returns to workspace 1.'),
        });
        settings.bind(
            SETTINGS_KEYS.RETURN_HOME_ON_CLOSE_FROM_SECONDARY,
            returnHomeOnClose,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        group.add(redirectEmptySecondary);
        group.add(returnHomeOnClose);
        return group;
    }

    _buildChromeGroup(settings) {
        const group = new Adw.PreferencesGroup({
            title: _('Chrome'),
        });

        const hideTopBar = new Adw.SwitchRow({
            title: _('Hide top bar on secondary workspaces'),
        });
        settings.bind(
            SETTINGS_KEYS.HIDE_TOP_BAR_ON_SECONDARY_WORKSPACES,
            hideTopBar,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        const hideDock = new Adw.SwitchRow({
            title: _('Hide Ubuntu Dock on secondary workspaces'),
        });
        settings.bind(
            SETTINGS_KEYS.HIDE_DOCK_ON_SECONDARY_WORKSPACES,
            hideDock,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        const disableBlur = new Adw.SwitchRow({
            title: _('Disable Blur My Shell panel blur on secondary workspaces'),
            subtitle: _('Only has an effect when Blur My Shell is installed and its panel blur is enabled.'),
        });
        settings.bind(
            SETTINGS_KEYS.DISABLE_BLUR_MY_SHELL_PANEL_BLUR_ON_SECONDARY_WORKSPACES,
            disableBlur,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        const animateChrome = new Adw.SwitchRow({
            title: _('Animate top bar and dock transitions'),
        });
        settings.bind(
            SETTINGS_KEYS.ANIMATE_CHROME_TRANSITIONS,
            animateChrome,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        const fadeDuration = new Adw.SpinRow({
            title: _('Chrome fade duration'),
            subtitle: _('Duration in milliseconds.'),
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 1000,
                step_increment: 10,
                page_increment: 50,
            }),
        });
        settings.bind(
            SETTINGS_KEYS.CHROME_FADE_DURATION_MS,
            fadeDuration,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );

        group.add(hideTopBar);
        group.add(hideDock);
        group.add(disableBlur);
        group.add(animateChrome);
        group.add(fadeDuration);
        return group;
    }

    _buildExclusionsGroup(settings) {
        const group = new Adw.PreferencesGroup({
            title: _('Exclusions'),
            description: _('Comma-separated application IDs and WM classes that Harbor should treat as workspace-agnostic utility windows.'),
        });

        const gtkApplicationIds = new Adw.EntryRow({
            title: _('Excluded GTK application IDs'),
        });
        bindStringArray(settings, SETTINGS_KEYS.EXCLUDED_GTK_APPLICATION_IDS, gtkApplicationIds);

        const wmClasses = new Adw.EntryRow({
            title: _('Excluded WM classes'),
        });
        bindStringArray(settings, SETTINGS_KEYS.EXCLUDED_WM_CLASSES, wmClasses);

        group.add(gtkApplicationIds);
        group.add(wmClasses);
        return group;
    }
}
