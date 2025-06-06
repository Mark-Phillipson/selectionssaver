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
- Works across all code file types

### Restore Selection Bookmarks
- **Command**: `SelectionsSaver: Restore Selection Bookmark`
- **Shortcut**: `Ctrl+Shift+R` (Windows/Linux) / `Cmd+Shift+R` (Mac)
- Shows a quick pick list of all saved bookmarks
- Navigates to the saved file, restores the exact selection, and scroll position

### Bookmark Management
- **Clear All Bookmarks**: Remove all saved bookmarks (with confirmation)

## How to Use

1. **Save a Bookmark**:
   - Select some text or position your cursor where you want to bookmark
   - Press `Ctrl+Shift+S` or use Command Palette → "SelectionsSaver: Save Selection Bookmark"
   - Optionally enter a name for the bookmark (duplicate names are allowed)

2. **Restore or Delete a Bookmark**:
   - Press `Ctrl+Shift+R` or use Command Palette → "SelectionsSaver: Restore Selection Bookmark"
   - Select from the list of saved bookmarks to restore
   - To delete a bookmark, click the trash icon next to it in the list
   - The extension will open the file and restore your exact selection and scroll position

3. **Manage Bookmarks**:
Will stop   - Use Command Palette → "Clear All Bookmarks" to remove all bookmarks

## Commands

| Command | Description | Keyboard Shortcut |
|---------|-------------|-------------------|
| `selectionssaver.saveBookmark` | Save current selection as bookmark | `Ctrl+Shift+S` |
| `selectionssaver.restoreBookmark` | Restore or delete a saved bookmark | `Ctrl+Shift+R` |
| `selectionssaver.clearAllBookmarks` | Clear all bookmarks | - |
| `selectionssaver.saveSelectionToSwapSlot` | Save current selection to swap slot | `Ctrl+Shift+2` |
| `selectionssaver.swapWithSwapSlot` | Swap current selection with swap slot | `Ctrl+Shift+1` |

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

## Known Issues

- Bookmarks reference static line and character positions. If lines are added or removed in a file after a bookmark is created, the bookmark may point to an incorrect or outdated location.

**Workarounds:**
- After major edits, re-save your bookmarks to ensure they point to the correct location.
- Place a unique comment or marker (e.g., `// BOOKMARK: MyFeature`) at the desired location. After editing, search for this marker and re-create the bookmark if needed.
- Avoid large-scale edits above bookmarked lines if you want to preserve bookmark accuracy.
- If a bookmark points to the wrong line after edits, use the extension to jump close to the old location, then manually adjust and re-save the bookmark.

**Note:**
It is technically possible to listen for file changes and attempt to update bookmarks automatically using the VS Code API (e.g., `onDidChangeTextDocument`). However, handling all possible text edits and keeping bookmarks accurate is complex and may impact performance. This feature may be considered for a future release if there is enough user interest.

## Release Notes

### 1.2.0
- Added ability to delete individual bookmarks directly from the restore picker (trash icon)
- Removed non-functional 'List Bookmarks' command and related UI/documentation
- Cleaned up documentation and improved user guidance for known issues and workarounds

### 1.1.0
- Added bookmark management commands: list, delete, and clear all bookmarks
- Implemented import/export of bookmark collections
- Improved error handling for missing or changed files
- Enhanced UI feedback and user prompts

### 1.0.1
- Fixed minor bugs in bookmark persistence and restoration
- Improved compatibility with recent VS Code versions

### 1.0.0
- Initial release of SelectionsSaver
- Save and restore text selections, cursor positions, and scroll locations
- Bookmarks persist across VS Code sessions
- Quick pick UI for restoring bookmarks
- Optional bookmark naming and workspace folder association

## Repository

The source code for SelectionsSaver is available on GitHub:
[https://github.com/Mark-Phillipson/selectionssaver](https://github.com/Mark-Phillipson/selectionssaver)
