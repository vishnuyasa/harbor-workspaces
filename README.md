# Harbor Workspaces

`Harbor Workspaces` is a GNOME Shell extension fork for a workspace model centered around a persistent home workspace.

The workflow is directly inspired by macOS Mission Control and fullscreen spaces. On a Mac, regular apps often live in a general desktop while focused apps can occupy their own swipeable spaces. This fork brings that idea to GNOME, but with a stricter rule set: workspace 1 remains the general-purpose home base, and maximized apps temporarily move into cleaner secondary workspaces before returning home when unmaximized.

On this fork:

- Workspace 1 is always the home workspace for regular windows.
- Maximizing a window moves it to the next secondary workspace.
- Unmaximizing a window sends it back to workspace 1.
- Secondary workspaces are compacted when they become empty.
- The top bar and Ubuntu Dock are shown on workspace 1 and hidden on secondary workspaces.

The name comes from the workflow: workspace 1 is the harbor, and focused windows leave it only while they are maximized.

## Status

This fork is currently tailored for `GNOME Shell 46` on Ubuntu 24.04.

## Install

1. Copy this directory to:
   `/home/$USER/.local/share/gnome-shell/extensions/harbor-workspaces@vishnuyasa.github.io`
2. Enable the extension:
   `gnome-extensions enable harbor-workspaces@vishnuyasa.github.io`
3. Log out and back in, or reload GNOME Shell if your session supports it.

## Notes

- This fork disables GNOME dynamic workspaces while enabled and manages the workspace layout itself.
- It was forked from `Maximize To Empty Workspace` and keeps the original GPL licensing.

## License

This project is licensed under `GPL-2.0-or-later`. See [LICENSE](./LICENSE) and [NOTICE.md](./NOTICE.md).
