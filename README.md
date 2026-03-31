# Harbor Workspaces

`Harbor Workspaces` is a GNOME Shell extension fork for a workspace model centered around a persistent home workspace.

The workflow is directly inspired by macOS Mission Control and fullscreen spaces. On a Mac, regular apps often live in a general desktop while focused apps can occupy their own swipeable spaces. This fork brings that idea to GNOME, but with a stricter rule set: workspace 1 remains the general-purpose home base, and maximized apps temporarily move into cleaner secondary workspaces before returning home when unmaximized.

On this fork:

- Workspace 1 is always the home workspace for regular windows.
- Maximizing a window moves it to the next secondary workspace.
- Unmaximizing a window sends it back to workspace 1.
- Closing a maximized window on a secondary workspace returns focus to workspace 1.
- Secondary workspaces are compacted when they become empty.
- Empty secondary workspaces are not meant to be navigable. Harbor redirects back to workspace 1 before an empty secondary workspace is drawn.
- The top bar and Ubuntu Dock are shown on workspace 1 and hidden on secondary workspaces.
- Blur My Shell panel blur is enabled on workspace 1 and disabled on secondary workspaces.
- Sticky utility windows such as `ddterm` are excluded from Harbor’s workspace moves and are refreshed after workspace switches so they stay visible.
- The custom Harbor behavior only runs on a single-display setup. If an external monitor is connected, Harbor Workspaces falls back to normal GNOME behavior.

The name comes from the workflow: workspace 1 is the harbor, and focused windows leave it only while they are maximized.

## Status

This fork is currently tailored for `GNOME Shell 46` on Ubuntu 24.04.

## Supported Extensions

Harbor Workspaces currently has intentional support for these GNOME extensions:

- `ubuntu-dock@ubuntu.com`
  Harbor hides and restores the Ubuntu Dock based on whether you are on workspace 1 or a secondary workspace.
- `blur-my-shell@aunetx`
  Harbor integrates with Blur My Shell’s panel blur so the top-panel blur is kept on workspace 1 and turned off on secondary workspaces.
- `ddterm@amezin.github.com`
  Harbor treats ddterm as a sticky utility window rather than a normal managed app window, and it preserves that sticky/above behavior across workspace switches.

Other installed extensions may still work, but these are the ones Harbor currently accounts for explicitly in its code.

## Install

1. Copy this directory to:
   `/home/$USER/.local/share/gnome-shell/extensions/harbor-workspaces@vishnuyasa.github.io`
2. Enable the extension:
   `gnome-extensions enable harbor-workspaces@vishnuyasa.github.io`
3. Log out and back in, or reload GNOME Shell if your session supports it.

## Notes

- This fork disables GNOME dynamic workspaces while enabled and manages the workspace layout itself.
- If more than one monitor is connected, the extension disables its custom window/workspace management and shell-chrome hiding behavior.
- Harbor is currently opinionated about the Ubuntu GNOME stack and is not intended as a general-purpose GNOME Shell extension for arbitrary desktop configurations.
- It was forked from `Maximize To Empty Workspace` and keeps the original GPL licensing.

## License

This project is licensed under `GPL-2.0-or-later`. See [LICENSE](./LICENSE) and [NOTICE.md](./NOTICE.md).
