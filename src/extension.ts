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
	timestamp: Date | string;
	workspaceFolder?: string;
}

interface BookmarkSaveOptions {
	nameInput: string;
	clearExistingBeforeSave: boolean;
}

/**
 * Class to manage bookmark operations and selection swap
 */
class BookmarkManager {
	private context: vscode.ExtensionContext;
	private readonly STORAGE_KEY_PREFIX = 'selectionssaver.bookmarks';
	private readonly SWAP_SLOT_KEY = 'selectionssaver.swapSlot';
	private swapSlotDecorationType: vscode.TextEditorDecorationType | null = null;
	private swapSlotEditor: vscode.TextEditor | null = null;

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
		this.initializeDecorationType();
		
		// Listen for configuration changes
		context.subscriptions.push(
			vscode.workspace.onDidChangeConfiguration(e => {
				if (e.affectsConfiguration('selectionssaver.swapSlotHighlightColor')) {
					this.updateDecorationType();
				}
			})
		);
	}

	/**
	 * Initialize the decoration type for swap slot highlighting
	 */
	private initializeDecorationType(): void {
		const config = vscode.workspace.getConfiguration('selectionssaver');
		const highlightColor = config.get<string>('swapSlotHighlightColor', 'rgba(255, 200, 0, 0.5)');
		
		this.swapSlotDecorationType = vscode.window.createTextEditorDecorationType({
			backgroundColor: highlightColor,
			border: '1px solid rgba(255, 200, 0, 0.8)',
			borderRadius: '2px'
		});
	}

	/**
	 * Update decoration type when configuration changes
	 */
	private updateDecorationType(): void {
		// Dispose old decoration
		if (this.swapSlotDecorationType) {
			this.swapSlotDecorationType.dispose();
		}
		
		// Create new decoration with updated color
		this.initializeDecorationType();
		
		// Reapply decoration if there's an active swap slot
		const swapSlot = this.context.workspaceState.get<any>(this.SWAP_SLOT_KEY);
		if (swapSlot && this.swapSlotEditor) {
			this.applySwapSlotDecoration(this.swapSlotEditor, swapSlot.selection);
		}
	}

	/**
	 * Apply decoration to the swap slot selection
	 */
	private applySwapSlotDecoration(editor: vscode.TextEditor, selection: any): void {
		if (!this.swapSlotDecorationType) {
			return;
		}
		
		const startPos = new vscode.Position(selection.start.line, selection.start.character);
		const endPos = new vscode.Position(selection.end.line, selection.end.character);
		const range = new vscode.Range(startPos, endPos);
		
		editor.setDecorations(this.swapSlotDecorationType, [range]);
	}

	/**
	 * Clear swap slot decoration
	 */
	private clearSwapSlotDecoration(): void {
		if (this.swapSlotDecorationType && this.swapSlotEditor) {
			this.swapSlotEditor.setDecorations(this.swapSlotDecorationType, []);
		}
		this.swapSlotEditor = null;
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
			return workspaceFolders.map(folder => folder.uri.fsPath).sort().join('|');
		}
	}

	/**
	 * Get storage key for current workspace
	 */
	private getWorkspaceStorageKey(): string | null {
		const workspaceId = this.getCurrentWorkspaceId();
		if (!workspaceId) {
			return null;
		}
		// Create a hash-like key from the workspace path to avoid very long keys
		const hash = this.hashString(workspaceId);
		return `${this.STORAGE_KEY_PREFIX}.${hash}`;
	}

	/**
	 * Simple hash function for workspace paths
	 */
	private hashString(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return Math.abs(hash).toString(36);
	}

	/**
	 * Prompt for bookmark name and whether existing bookmarks should be cleared first
	 */
	private async promptForBookmarkSaveOptions(): Promise<BookmarkSaveOptions | undefined> {
		const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem>();
		quickPick.title = 'Save Selection Bookmark';
		quickPick.placeholder = 'Enter a name for this bookmark (optional)';
		quickPick.ignoreFocusOut = true;
		quickPick.canSelectMany = true;

		const clearItem: vscode.QuickPickItem = {
			label: 'Clear all existing bookmarks before saving this one',
			description: 'Unchecked by default',
			alwaysShow: true
		};

		quickPick.items = [clearItem];
		quickPick.selectedItems = [];

		quickPick.value = '';

		return new Promise<BookmarkSaveOptions | undefined>((resolve) => {
			let didAccept = false;

			quickPick.onDidAccept(() => {
				didAccept = true;
				const clearExistingBeforeSave = quickPick.selectedItems.some(item => item.label === clearItem.label);
				resolve({
					nameInput: quickPick.value.trim(),
					clearExistingBeforeSave
				});
				quickPick.hide();
			});

			quickPick.onDidHide(() => {
				if (!didAccept) {
					resolve(undefined);
				}
				quickPick.dispose();
			});

			quickPick.show();
		});
	}

	/**
	 * Build a bookmark name from selection text when possible
	 */
	private buildSelectionBasedName(editor: vscode.TextEditor): string | null {
		const selectedText = editor.document.getText(editor.selection).trim();
		if (!selectedText) {
			return null;
		}

		const words = selectedText
			.toLowerCase()
			.replace(/[^a-z0-9_\s-]/g, ' ')
			.split(/\s+/)
			.filter(word => word.length >= 3)
			.slice(0, 2)
			.map(word => word.charAt(0).toUpperCase() + word.slice(1));

		if (words.length === 0) {
			return null;
		}

		return words.join('');
	}

	/**
	 * Generate a random verb+noun bookmark name
	 */
	private generateRandomVerbNounName(): string {
		const verbs = [
			'Anchor', 'Trace', 'Jump', 'Scan', 'Map', 'Pin', 'Track', 'Capture', 'Focus', 'Link'
		];
		const nouns = [
			'Comet', 'Harbor', 'Falcon', 'Beacon', 'Canyon', 'Ranger', 'Orbit', 'Summit', 'Compass', 'Bridge'
		];

		const verb = verbs[Math.floor(Math.random() * verbs.length)];
		const noun = nouns[Math.floor(Math.random() * nouns.length)];
		return `${verb}${noun}`;
	}

	/**
	 * Ensure bookmark names are unique in current workspace
	 */
	private createUniqueBookmarkName(baseName: string, existingBookmarks: BookmarkData[]): string {
		const existingNames = new Set(
			existingBookmarks
				.map(bookmark => bookmark.name?.trim())
				.filter((name): name is string => Boolean(name))
		);

		if (!existingNames.has(baseName)) {
			return baseName;
		}

		const timestampSuffix = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
		const timestampName = `${baseName}-${timestampSuffix}`;
		if (!existingNames.has(timestampName)) {
			return timestampName;
		}

		let counter = 2;
		let candidate = `${baseName}-${counter}`;
		while (existingNames.has(candidate)) {
			counter++;
			candidate = `${baseName}-${counter}`;
		}
		return candidate;
	}

	/**
	 * Resolve final bookmark name from user input and generated fallbacks
	 */
	private resolveBookmarkName(nameInput: string, editor: vscode.TextEditor, existingBookmarks: BookmarkData[]): string {
		if (nameInput) {
			return this.createUniqueBookmarkName(nameInput, existingBookmarks);
		}

		const selectionBasedName = this.buildSelectionBasedName(editor);
		if (selectionBasedName) {
			return this.createUniqueBookmarkName(selectionBasedName, existingBookmarks);
		}

		const randomName = this.generateRandomVerbNounName();
		return this.createUniqueBookmarkName(randomName, existingBookmarks);
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

		// Get bookmark name and save options from user
		const saveOptions = await this.promptForBookmarkSaveOptions();

		// If user cancelled, do not save
		if (!saveOptions) {
			vscode.window.showInformationMessage('Bookmark not saved.');
			return;
		}

		// Generate unique ID
		const id = Date.now().toString();

		// Get current bookmarks before save
		let bookmarks = this.getBookmarks();

		if (saveOptions.clearExistingBeforeSave) {
			const storageKey = this.getWorkspaceStorageKey();
			if (!storageKey) {
				vscode.window.showErrorMessage('Unable to save bookmark: Invalid workspace');
				return;
			}
			bookmarks = [];
			await this.context.globalState.update(storageKey, bookmarks);
		}

		const resolvedName = this.resolveBookmarkName(saveOptions.nameInput, editor, bookmarks);
		
		// Get current workspace folder
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
		
		// Create bookmark data
		const bookmark: BookmarkData = {
			id,
			name: resolvedName,
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
		console.log(`Current bookmarks before save: ${bookmarks.length}`);
		console.log(`Adding bookmark with path: ${bookmark.filePath}`);
		console.log(`Current workspace folders:`, vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath));
		
		bookmarks.push(bookmark);
		
		const storageKey = this.getWorkspaceStorageKey();
		if (!storageKey) {
			vscode.window.showErrorMessage('Unable to save bookmark: Invalid workspace');
			return;
		}
		
		await this.context.globalState.update(storageKey, bookmarks);
		
		// Verify the save
		const savedBookmarks = this.context.globalState.get(storageKey, []);
		console.log(`Bookmarks after save: ${savedBookmarks.length}`);

		vscode.window.showInformationMessage(`Bookmark "${bookmark.name}" saved!`);
	}

	private formatBookmarkTimestamp(timestamp: Date | string): string {
		const parsedTimestamp = timestamp instanceof Date ? timestamp : new Date(timestamp);
		if (Number.isNaN(parsedTimestamp.getTime())) {
			return String(timestamp);
		}

		return parsedTimestamp.toLocaleString(undefined, {
			dateStyle: 'short',
			timeStyle: 'short'
		});
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
			detail: `Saved: ${this.formatBookmarkTimestamp(bookmark.timestamp)}`,
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
				detail: `Saved: ${this.formatBookmarkTimestamp(bookmark.timestamp)}`,
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
		const storageKey = this.getWorkspaceStorageKey();
		if (!storageKey) {
			// No workspace open, return empty array
			console.log('No workspace storage key found');
			return [];
		}
		
		// Get bookmarks specific to this workspace
		const allBookmarks: BookmarkData[] = this.context.globalState.get(storageKey, []);
		console.log(`Retrieved ${allBookmarks.length} bookmarks from globalState for workspace key: ${storageKey}`);
		
		return allBookmarks;
	}

	/**
	 * Delete a bookmark by ID
	 */
	private async deleteBookmarkById(id: string): Promise<void> {
		const storageKey = this.getWorkspaceStorageKey();
		if (!storageKey) {
			return;
		}
		
		const allBookmarks: BookmarkData[] = this.context.globalState.get(storageKey, []);
		const filteredBookmarks = allBookmarks.filter((b: BookmarkData) => b.id !== id);
		await this.context.globalState.update(storageKey, filteredBookmarks);
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
			const storageKey = this.getWorkspaceStorageKey();
			if (!storageKey) {
				return;
			}
			
			// Clear bookmarks for this workspace
			await this.context.globalState.update(storageKey, []);
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
		
		// Clear any existing decoration
		this.clearSwapSlotDecoration();
		
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
		
		// Apply decoration to highlight the saved selection
		this.swapSlotEditor = editor;
		this.applySwapSlotDecoration(editor, swapSlot.selection);
		
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
		
		// Clear the old decoration
		this.clearSwapSlotDecoration();
		
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
		
		// Apply decoration to the new swap slot location
		this.swapSlotEditor = editor;
		this.applySwapSlotDecoration(editor, currentSelection.selection);
		
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
