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
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {HarborController} from './lib/controller.js';

export default class HarborWorkspacesExtension extends Extension {
    enable() {
        this._controller = new HarborController(this, this.getSettings());
        this._controller.enable();
    }

    disable() {
        this._controller?.destroy();
        this._controller = null;
    }
}
