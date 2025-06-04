// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

/**
 * Interface for bookmark data structure
 */
interface BookmarkData {
	id: string;
	name?: string;
	filePath: string;
	selection: {
		start: { line: number; character: number };
		end: { line: number; character: number };
	};
	scrollPosition: number;
	timestamp: Date;
	workspaceFolder?: string;
}

/**
 * Class to manage bookmark operations
 */
class BookmarkManager {
	private context: vscode.ExtensionContext;
	private readonly STORAGE_KEY = 'selectionssaver.bookmarks';

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
	}

	/**
	 * Save current selection and position as a bookmark
	 */
	async saveBookmark(): Promise<void> {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor found');
			return;
		}

		// Get bookmark name from user
		const name = await vscode.window.showInputBox({
			prompt: 'Enter a name for this bookmark (optional)',
			placeHolder: 'Bookmark name'
		});

		// Generate unique ID
		const id = Date.now().toString();
		
		// Get current workspace folder
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
		
		// Create bookmark data
		const bookmark: BookmarkData = {
			id,
			name: name || `Bookmark ${id}`,
			filePath: editor.document.uri.fsPath,
			selection: {
				start: {
					line: editor.selection.start.line,
					character: editor.selection.start.character
				},
				end: {
					line: editor.selection.end.line,
					character: editor.selection.end.character
				}
			},
			scrollPosition: editor.visibleRanges[0].start.line,
			timestamp: new Date(),
			workspaceFolder: workspaceFolder?.name
		};

		// Save bookmark
		const bookmarks = this.getBookmarks();
		bookmarks.push(bookmark);
		await this.context.globalState.update(this.STORAGE_KEY, bookmarks);

		vscode.window.showInformationMessage(`Bookmark "${bookmark.name}" saved!`);
	}

	/**
	 * Show list of bookmarks and restore selected one
	 */
	async restoreBookmark(): Promise<void> {
		const bookmarks = this.getBookmarks();
		
		if (bookmarks.length === 0) {
			vscode.window.showInformationMessage('No bookmarks saved yet');
			return;
		}

		// Create quick pick items
		const items = bookmarks.map(bookmark => ({
			label: bookmark.name || 'Unnamed Bookmark',
			description: `${bookmark.filePath} (Line ${bookmark.selection.start.line + 1})`,
			detail: `Saved: ${bookmark.timestamp.toLocaleString()}`,
			bookmark: bookmark
		}));

		// Show quick pick
		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: 'Select a bookmark to restore'
		});

		if (selected) {
			await this.restoreBookmarkData(selected.bookmark);
		}
	}

	/**
	 * Restore a specific bookmark
	 */
	private async restoreBookmarkData(bookmark: BookmarkData): Promise<void> {
		try {
			// Open the file
			const document = await vscode.workspace.openTextDocument(bookmark.filePath);
			const editor = await vscode.window.showTextDocument(document);

			// Restore selection
			const startPos = new vscode.Position(bookmark.selection.start.line, bookmark.selection.start.character);
			const endPos = new vscode.Position(bookmark.selection.end.line, bookmark.selection.end.character);
			const selection = new vscode.Selection(startPos, endPos);
			
			editor.selection = selection;

			// Restore scroll position
			const scrollPos = new vscode.Position(bookmark.scrollPosition, 0);
			editor.revealRange(new vscode.Range(scrollPos, scrollPos), vscode.TextEditorRevealType.AtTop);

			vscode.window.showInformationMessage(`Restored bookmark: ${bookmark.name}`);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to restore bookmark: ${error}`);
		}
	}

	/**
	 * Get all saved bookmarks
	 */
	private getBookmarks(): BookmarkData[] {
		return this.context.globalState.get(this.STORAGE_KEY, []);
	}

	/**
	 * List all bookmarks
	 */
	async listBookmarks(): Promise<void> {
		const bookmarks = this.getBookmarks();
		
		if (bookmarks.length === 0) {
			vscode.window.showInformationMessage('No bookmarks saved yet');
			return;
		}

		const items = bookmarks.map(bookmark => 
			`• ${bookmark.name} - ${bookmark.filePath} (Line ${bookmark.selection.start.line + 1})`
		).join('\n');

		vscode.window.showInformationMessage(`Saved Bookmarks:\n${items}`);
	}

	/**
	 * Clear all bookmarks
	 */
	async clearAllBookmarks(): Promise<void> {
		const confirm = await vscode.window.showWarningMessage(
			'Are you sure you want to delete all bookmarks?',
			'Yes', 'No'
		);

		if (confirm === 'Yes') {
			await this.context.globalState.update(this.STORAGE_KEY, []);
			vscode.window.showInformationMessage('All bookmarks cleared!');
		}
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('SelectionsSaver extension is now active!');

	// Create bookmark manager instance
	const bookmarkManager = new BookmarkManager(context);

	// Register commands
	const saveBookmarkCommand = vscode.commands.registerCommand('selectionssaver.saveBookmark', () => {
		bookmarkManager.saveBookmark();
	});

	const restoreBookmarkCommand = vscode.commands.registerCommand('selectionssaver.restoreBookmark', () => {
		bookmarkManager.restoreBookmark();
	});

	const listBookmarksCommand = vscode.commands.registerCommand('selectionssaver.listBookmarks', () => {
		bookmarkManager.listBookmarks();
	});

	const clearBookmarksCommand = vscode.commands.registerCommand('selectionssaver.clearAllBookmarks', () => {
		bookmarkManager.clearAllBookmarks();
	});

	// Add all commands to subscriptions
	context.subscriptions.push(
		saveBookmarkCommand,
		restoreBookmarkCommand,
		listBookmarksCommand,
		clearBookmarksCommand
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
