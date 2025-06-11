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
 * Class to manage bookmark operations and selection swap
 */
class BookmarkManager {
	private context: vscode.ExtensionContext;
	private readonly STORAGE_KEY = 'selectionssaver.bookmarks';
	private readonly SWAP_SLOT_KEY = 'selectionssaver.swapSlot';

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
	}

	/**
	 * Get current workspace identifier for scoping bookmarks
	 */
	private getCurrentWorkspaceId(): string | null {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			return null;
		}
		
		// For multi-root workspaces, use the first folder or a combination
		if (workspaceFolders.length === 1) {
			return workspaceFolders[0].uri.fsPath;
		} else {
			// For multi-root, create a composite identifier
			return workspaceFolders.map(folder => folder.name).sort().join('|');
		}
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

		// Check if we have a workspace
		const currentWorkspaceId = this.getCurrentWorkspaceId();
		if (!currentWorkspaceId) {
			vscode.window.showErrorMessage('No workspace open. Bookmarks are workspace-specific.');
			return;
		}

		// Get bookmark name from user
		const name = await vscode.window.showInputBox({
			prompt: 'Enter a name for this bookmark (optional)',
			placeHolder: 'Bookmark name'
		});

		// If user cancelled (pressed Esc or clicked away), do not save
		if (typeof name === 'undefined') {
			vscode.window.showInformationMessage('Bookmark not saved.');
			return;
		}

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
		console.log(`Current bookmarks before save: ${bookmarks.length}`);
		console.log(`Adding bookmark with path: ${bookmark.filePath}`);
		console.log(`Current workspace folders:`, vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath));
		
		bookmarks.push(bookmark);
		await this.context.workspaceState.update(this.STORAGE_KEY, bookmarks);
		
		// Verify the save
		const savedBookmarks = this.context.workspaceState.get(this.STORAGE_KEY, []);
		console.log(`Bookmarks after save: ${savedBookmarks.length}`);

		vscode.window.showInformationMessage(`Bookmark "${bookmark.name}" saved!`);
	}

	/**
	 * Show list of bookmarks and restore or delete selected one
	 */
	async restoreBookmark(): Promise<void> {
		// Check if we have a workspace
		const currentWorkspaceId = this.getCurrentWorkspaceId();
		if (!currentWorkspaceId) {
			vscode.window.showErrorMessage('No workspace open. Bookmarks are workspace-specific.');
			return;
		}

		let bookmarks = this.getBookmarks();
		if (bookmarks.length === 0) {
			vscode.window.showInformationMessage('No bookmarks saved in this workspace yet');
			return;
		}

		const quickPick = vscode.window.createQuickPick();
		quickPick.items = bookmarks.map(bookmark => ({
			label: bookmark.name || 'Unnamed Bookmark',
			description: `${bookmark.filePath} (Line ${bookmark.selection.start.line + 1})`,
			detail: `Saved: ${bookmark.timestamp.toLocaleString()}`,
			bookmark: bookmark,
			buttons: [
				{
					iconPath: new vscode.ThemeIcon('trash'),
					tooltip: 'Delete Bookmark'
				}
			]
		}));
		quickPick.placeholder = 'Select a bookmark to restore or delete';

		quickPick.onDidTriggerItemButton(async e => {
			const toDelete = (e.item as any).bookmark;
			await this.deleteBookmarkById(toDelete.id);
			bookmarks = this.getBookmarks();
			quickPick.items = bookmarks.map(bookmark => ({
				label: bookmark.name || 'Unnamed Bookmark',
				description: `${bookmark.filePath} (Line ${bookmark.selection.start.line + 1})`,
				detail: `Saved: ${bookmark.timestamp.toLocaleString()}`,
				bookmark: bookmark,
				buttons: [
					{
						iconPath: new vscode.ThemeIcon('trash'),
						tooltip: 'Delete Bookmark'
					}
				]
			}));
			vscode.window.showInformationMessage(`Bookmark deleted.`);
			if (bookmarks.length === 0) {
				quickPick.hide();
			}
		});

		quickPick.onDidAccept(async () => {
			const selected = quickPick.selectedItems[0];
			if (selected) {
				await this.restoreBookmarkData((selected as any).bookmark);
			}
			quickPick.hide();
		});

		quickPick.onDidHide(() => quickPick.dispose());
		quickPick.show();
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
	 * Get all saved bookmarks for the current workspace
	 */
	private getBookmarks(): BookmarkData[] {
		const currentWorkspaceId = this.getCurrentWorkspaceId();
		if (!currentWorkspaceId) {
			// No workspace open, return empty array
			console.log('No workspace ID found');
			return [];
		}
		
		// Since we're using workspaceState, bookmarks are already workspace-specific
		const allBookmarks: BookmarkData[] = this.context.workspaceState.get(this.STORAGE_KEY, []);
		console.log(`Retrieved ${allBookmarks.length} bookmarks from workspaceState for workspace: ${currentWorkspaceId}`);
		
		return allBookmarks;
	}

	/**
	 * Delete a bookmark by ID
	 */
	private async deleteBookmarkById(id: string): Promise<void> {
		const allBookmarks: BookmarkData[] = this.context.workspaceState.get(this.STORAGE_KEY, []);
		const filteredBookmarks = allBookmarks.filter((b: BookmarkData) => b.id !== id);
		await this.context.workspaceState.update(this.STORAGE_KEY, filteredBookmarks);
	}

	/**
	 * Clear all bookmarks for the current workspace
	 */
	async clearAllBookmarks(): Promise<void> {
		const currentWorkspaceBookmarks = this.getBookmarks();
		if (currentWorkspaceBookmarks.length === 0) {
			vscode.window.showInformationMessage('No bookmarks to clear in current workspace.');
			return;
		}

		const confirm = await vscode.window.showWarningMessage(
			`Are you sure you want to delete all ${currentWorkspaceBookmarks.length} bookmarks in this workspace?`,
			'Yes', 'No'
		);

		if (confirm === 'Yes') {
			// Since workspaceState is already workspace-specific, just clear it
			await this.context.workspaceState.update(this.STORAGE_KEY, []);
			vscode.window.showInformationMessage('All workspace bookmarks cleared!');
		}
	}

	/**
	 * Save current selection to swap slot (temporary)
	 */
	async saveSelectionToSwapSlot(): Promise<void> {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor found');
			return;
		}
		const swapSlot = {
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
			}
		};
		await this.context.workspaceState.update(this.SWAP_SLOT_KEY, swapSlot);
		vscode.window.showInformationMessage('Selection saved to swap slot.');
	}

	/**
	 * Swap current selection with swap slot
	 */
	async swapWithSwapSlot(): Promise<void> {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor found');
			return;
		}
		const swapSlot = this.context.workspaceState.get<any>(this.SWAP_SLOT_KEY);
		if (!swapSlot) {
			vscode.window.showErrorMessage('No selection in swap slot.');
			return;
		}
		// Save current selection to swap slot
		const currentSelection = {
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
			}
		};
		await this.context.workspaceState.update(this.SWAP_SLOT_KEY, currentSelection);

		// Switch to swap slot selection (open file if needed)
		if (swapSlot.filePath !== editor.document.uri.fsPath) {
			const document = await vscode.workspace.openTextDocument(swapSlot.filePath);
			await vscode.window.showTextDocument(document);
		}
		const targetEditor = vscode.window.activeTextEditor;
		if (!targetEditor) {
			vscode.window.showErrorMessage('Failed to switch editor for swap.');
			return;
		}
		const startPos = new vscode.Position(swapSlot.selection.start.line, swapSlot.selection.start.character);
		const endPos = new vscode.Position(swapSlot.selection.end.line, swapSlot.selection.end.character);
		targetEditor.selection = new vscode.Selection(startPos, endPos);
		targetEditor.revealRange(new vscode.Range(startPos, endPos));
		vscode.window.showInformationMessage('Selection swapped with swap slot.');
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

	const clearBookmarksCommand = vscode.commands.registerCommand('selectionssaver.clearAllBookmarks', () => {
		bookmarkManager.clearAllBookmarks();
	});

	const saveSwapSlotCommand = vscode.commands.registerCommand('selectionssaver.saveSelectionToSwapSlot', () => {
		bookmarkManager.saveSelectionToSwapSlot();
	});

	const swapWithSwapSlotCommand = vscode.commands.registerCommand('selectionssaver.swapWithSwapSlot', () => {
		bookmarkManager.swapWithSwapSlot();
	});

	// Add all commands to subscriptions
	context.subscriptions.push(
		saveBookmarkCommand,
		restoreBookmarkCommand,
		clearBookmarksCommand,
		saveSwapSlotCommand,
		swapWithSwapSlotCommand
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
