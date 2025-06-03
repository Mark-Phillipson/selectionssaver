# SelectionsSaver

A Visual Studio Code extension that provides enhanced bookmark functionality by recording and restoring:
- Text selections in code files
- Line locations and cursor positions  
- Vertical scrollbar positions
- File context for navigation

## Features

### Save Selection Bookmarks
- **Command**: `SelectionsSaver: Save Selection Bookmark`
- **Shortcut**: `Ctrl+Shift+S` (Windows/Linux) / `Cmd+Shift+S` (Mac)
- Captures your current text selection, cursor position, and scroll location
- Allows you to provide an optional name for the bookmark
- Works across all file types

### Restore Selection Bookmarks
- **Command**: `SelectionsSaver: Restore Selection Bookmark`
- **Shortcut**: `Ctrl+Shift+R` (Windows/Linux) / `Cmd+Shift+R` (Mac)
- Shows a quick pick list of all saved bookmarks
- Navigates to the saved file, restores the exact selection, and scroll position
- Handles cases where files have been moved or modified

### Bookmark Management
- **List Bookmarks**: View all saved bookmarks with file paths and line numbers
- **Clear All Bookmarks**: Remove all saved bookmarks (with confirmation)
- Context menu integration for easy access

## How to Use

1. **Save a Bookmark**:
   - Select some text or position your cursor where you want to bookmark
   - Press `Ctrl+Shift+S` or use Command Palette → "Save Selection Bookmark"
   - Optionally enter a name for the bookmark

2. **Restore a Bookmark**:
   - Press `Ctrl+Shift+R` or use Command Palette → "Restore Selection Bookmark"
   - Select from the list of saved bookmarks
   - The extension will open the file and restore your exact selection and scroll position

3. **Manage Bookmarks**:
   - Use Command Palette → "List All Bookmarks" to see all saved bookmarks
   - Use Command Palette → "Clear All Bookmarks" to remove all bookmarks

## Commands

| Command | Description | Keyboard Shortcut |
|---------|-------------|-------------------|
| `selectionssaver.saveBookmark` | Save current selection as bookmark | `Ctrl+Shift+S` |
| `selectionssaver.restoreBookmark` | Restore a saved bookmark | `Ctrl+Shift+R` |
| `selectionssaver.listBookmarks` | List all saved bookmarks | - |
| `selectionssaver.clearAllBookmarks` | Clear all bookmarks | - |

## Requirements

- Visual Studio Code 1.100.3 or higher

## Data Storage

Bookmarks are stored using VS Code's global state, meaning they persist across:
- VS Code restarts
- Workspace changes
- Extension updates

Each bookmark contains:
- Unique identifier
- Optional user-provided name
- File path
- Selection start/end positions
- Scroll position
- Timestamp
- Workspace folder (if applicable)

For example:

This extension contributes the following settings:

* `myExtension.enable`: Enable/disable this extension.
* `myExtension.thing`: Set to `blah` to do something.

## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.

## Release Notes

Users appreciate release notes as you update your extension.

### 1.0.0

Initial release of ...

### 1.0.1

Fixed issue #.

### 1.1.0

Added features X, Y, and Z.

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
