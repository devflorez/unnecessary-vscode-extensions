import * as vscode from 'vscode';

import {
	convertTextEol,
	decideAction,
	mapEolEnum,
	resolveExpectedEol,
} from './core/eolCore';
import { findEditorConfigEol } from './editorconfig';

const COMMAND_FIX = 'eol-guardian.fixCurrentFileEol';
const COMMAND_SHOW = 'eol-guardian.showCurrentFileEol';
const COMMAND_TOGGLE = 'eol-guardian.toggleEnabled';

const CONVERT_ACTION = 'Convert';
const IGNORE_ACTION = 'Ignore';

type Config = {
	enabled: boolean;
	expectedEOL: 'lf' | 'crlf' | 'auto';
	detectOnOpen: boolean;
	detectOnSave: boolean;
	mode: 'detectOnly' | 'askBeforeFix' | 'fixOnSave';
	cooldownSeconds: number;
	respectEditorConfig: boolean;
};

type FileState = {
	lastNotifiedAt: number | null;
	ignored: boolean;
	pendingFixEol?: 'lf' | 'crlf';
};

type ConversionResult = {
	status: 'changed' | 'unchanged' | 'failed';
};

export function activate(context: vscode.ExtensionContext): void {
	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	statusBar.command = COMMAND_SHOW;
	statusBar.show();

	const fileState = new Map<string, FileState>();

	const shouldProcessDocument = (
		document: vscode.TextDocument,
		reason: 'open' | 'save',
		config: Config,
	): boolean => {
		if (!config.enabled) {
			return false;
		}
		if (reason === 'open' && !config.detectOnOpen) {
			return false;
		}
		if (reason === 'save' && !config.detectOnSave) {
			return false;
		}
		if (config.mode === 'fixOnSave' && reason !== 'save') {
			return false;
		}
		return isTextDocument(document);
	};

	const showMismatchWarning = async (current: string, expected: string): Promise<void> => {
		await vscode.window.showWarningMessage(
			vscode.l10n.t('EOL mismatch: {0} found, expected {1}.', current, expected),
		);
	};

	const promptToFix = async (current: string, expected: string): Promise<'convert' | 'ignore' | 'dismiss'> => {
		const convertLabel = vscode.l10n.t(CONVERT_ACTION);
		const ignoreLabel = vscode.l10n.t(IGNORE_ACTION);
		const action = await vscode.window.showWarningMessage(
			vscode.l10n.t('EOL mismatch: {0} found, expected {1}.', current, expected),
			convertLabel,
			ignoreLabel,
		);
		if (action === convertLabel) {
			return 'convert';
		}
		if (action === ignoreLabel) {
			return 'ignore';
		}
		return 'dismiss';
	};

	const updateStatusBar = async (editor: vscode.TextEditor | undefined): Promise<void> => {
		const config = getConfig();
		if (!config.enabled) {
			statusBar.text = vscode.l10n.t('EOL: OFF');
			return;
		}
		if (!editor) {
			statusBar.text = vscode.l10n.t('EOL: --');
			return;
		}
		const document = editor.document;
		const current = mapEolEnum(document.eol);
		const expectedInfo = await getExpectedEolInfo(document, config);
		const mismatch = expectedInfo.expected !== 'auto' && current !== expectedInfo.expected;
		statusBar.text = mismatch
			? vscode.l10n.t('EOL: {0} ⚠️', current.toUpperCase())
			: vscode.l10n.t('EOL: {0}', current.toUpperCase());
	};

	const handleDocument = async (document: vscode.TextDocument, reason: 'open' | 'save'): Promise<void> => {
		const config = getConfig();
		if (!shouldProcessDocument(document, reason, config)) {
			await updateStatusBar(vscode.window.activeTextEditor);
			return;
		}

		const expectedInfo = await getExpectedEolInfo(document, config);
		const expectedEol = expectedInfo.expected;
		if (expectedEol === 'auto') {
			await updateStatusBar(vscode.window.activeTextEditor);
			return;
		}

		const currentEol = mapEolEnum(document.eol);
		const key = document.uri.toString();
		const state = fileState.get(key) ?? { lastNotifiedAt: null, ignored: false };
		const decision = decideAction({
			currentEol,
			expected: expectedEol,
			mode: config.mode,
			cooldownSeconds: config.cooldownSeconds,
			nowMs: Date.now(),
			lastNotifiedAt: state.lastNotifiedAt,
			ignored: state.ignored,
		});

		if (decision.action === 'none') {
			await updateStatusBar(vscode.window.activeTextEditor);
			return;
		}

		state.lastNotifiedAt = Date.now();
		fileState.set(key, state);

		const currentLabel = currentEol.toUpperCase();
		const expectedLabel = expectedEol.toUpperCase();

		if (decision.action === 'warn') {
			await showMismatchWarning(currentLabel, expectedLabel);
			await updateStatusBar(vscode.window.activeTextEditor);
			return;
		}

		if (decision.action === 'prompt') {
			const choice = await promptToFix(currentLabel, expectedLabel);
			if (choice === 'convert') {
				const result = await convertDocumentEol(document, expectedEol);
				await showConversionMessage(expectedEol, result.status);
			} else if (choice === 'ignore') {
				fileState.set(key, { ...state, ignored: true });
			}
			await updateStatusBar(vscode.window.activeTextEditor);
		}
	};

	const onOpen = vscode.workspace.onDidOpenTextDocument((document) => {
		void handleDocument(document, 'open');
	});

	const onSave = vscode.workspace.onDidSaveTextDocument((document) => {
		const config = getConfig();
		if (config.mode === 'fixOnSave') {
			const state = fileState.get(document.uri.toString());
			if (state?.pendingFixEol) {
				const pending = state.pendingFixEol;
				state.pendingFixEol = undefined;
				fileState.set(document.uri.toString(), state);
				void showFixMessage(pending);
			}
			void updateStatusBar(vscode.window.activeTextEditor);
			return;
		}
		void handleDocument(document, 'save');
	});

	const onWillSave = vscode.workspace.onWillSaveTextDocument((event) => {
		const config = getConfig();
		if (!config.enabled || config.mode !== 'fixOnSave') {
			return;
		}
		if (!isTextDocument(event.document)) {
			return;
		}
		event.waitUntil(
			(async () => {
				const expectedInfo = await getExpectedEolInfo(event.document, config);
				if (expectedInfo.expected === 'auto') {
					return [];
				}
				const current = mapEolEnum(event.document.eol);
				if (current === expectedInfo.expected) {
					return [];
				}
				const edits = buildEdits(event.document, expectedInfo.expected);
				if (edits.length > 0) {
					const key = event.document.uri.toString();
					const state = fileState.get(key) ?? { lastNotifiedAt: null, ignored: false };
					state.pendingFixEol = expectedInfo.expected;
					fileState.set(key, state);
				}
				return edits;
			})(),
		);
	});

	const onActiveEditor = vscode.window.onDidChangeActiveTextEditor((editor) => {
		void updateStatusBar(editor);
	});

	const onConfigChange = vscode.workspace.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration('eolGuardian')) {
			void updateStatusBar(vscode.window.activeTextEditor);
		}
	});

	const fixCommand = vscode.commands.registerCommand(COMMAND_FIX, async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}
		const config = getConfig();
		const expectedInfo = await getExpectedEolInfo(editor.document, config);
		const expectedEol = expectedInfo.expected;
		if (expectedEol === 'auto') {
			const choice = await vscode.window.showQuickPick(['LF', 'CRLF'], {
				placeHolder: vscode.l10n.t('Choose target EOL'),
			});
			if (!choice) {
				return;
			}
				const target = choice === 'LF' ? 'lf' : 'crlf';
				const result = await convertDocumentEol(editor.document, target);
				await showConversionMessage(target, result.status);
				await updateStatusBar(editor);
				return;
			}
		const result = await convertDocumentEol(editor.document, expectedEol);
		await showConversionMessage(expectedEol, result.status);
		await updateStatusBar(editor);
	});

	const showCommand = vscode.commands.registerCommand(COMMAND_SHOW, async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}
		const config = getConfig();
		const current = mapEolEnum(editor.document.eol);
		const expectedInfo = await getExpectedEolInfo(editor.document, config);
		const sourceLabel = buildSourceLabel(expectedInfo.source, expectedInfo.sourcePath);
		await vscode.window.showInformationMessage(
			vscode.l10n.t(
				'Current: {0} | Expected: {1} ({2})',
				current.toUpperCase(),
				expectedInfo.expected.toUpperCase(),
				sourceLabel,
			),
		);
	});

	const toggleCommand = vscode.commands.registerCommand(COMMAND_TOGGLE, async () => {
		const config = vscode.workspace.getConfiguration('eolGuardian');
		const current = config.get<boolean>('enabled', true);
		await config.update('enabled', !current, vscode.ConfigurationTarget.Global);
		await updateStatusBar(vscode.window.activeTextEditor);
	});

	context.subscriptions.push(
		statusBar,
		onOpen,
		onSave,
		onWillSave,
		onActiveEditor,
		onConfigChange,
		fixCommand,
		showCommand,
		toggleCommand,
	);

	void updateStatusBar(vscode.window.activeTextEditor);
}

export function deactivate(): void {
	// No cleanup required.
}

async function convertDocumentEol(document: vscode.TextDocument, target: 'lf' | 'crlf'): Promise<ConversionResult> {
	const current = mapEolEnum(document.eol);
	if (current === target) {
		return { status: 'unchanged' };
	}

	const editor = vscode.window.visibleTextEditors.find((item) => item.document.uri.toString() === document.uri.toString());
	if (editor) {
		const success = await editor.edit((edit) => {
			edit.setEndOfLine(target === 'lf' ? vscode.EndOfLine.LF : vscode.EndOfLine.CRLF);
		});
		return { status: success ? 'changed' : 'failed' };
	}

	const text = document.getText();
	const converted = convertTextEol(text, target);
	if (converted === text) {
		return { status: 'unchanged' };
	}
	const edit = new vscode.WorkspaceEdit();
	edit.replace(document.uri, getFullRange(document), converted);
	const applied = await vscode.workspace.applyEdit(edit);
	return { status: applied ? 'changed' : 'failed' };
}

async function getExpectedEolInfo(document: vscode.TextDocument, config: Config): Promise<{
	expected: 'lf' | 'crlf' | 'auto';
	source: 'editorconfig' | 'settings' | 'auto';
	sourcePath?: string;
}> {
	let editorconfigValue: 'lf' | 'crlf' | null = null;
	let sourcePath: string | undefined;
	if (config.respectEditorConfig && document.uri.scheme === 'file') {
		const result = await findEditorConfigEol(document.uri.fsPath);
		if (result) {
			editorconfigValue = result.endOfLine;
			sourcePath = result.sourcePath;
		}
	}
	const resolved = resolveExpectedEol(config.expectedEOL, editorconfigValue, config.respectEditorConfig);
	return { expected: resolved.expected, source: resolved.source, sourcePath };
}

function getConfig(): Config {
	const config = vscode.workspace.getConfiguration('eolGuardian');
	return {
		enabled: config.get<boolean>('enabled', true),
		expectedEOL: config.get<'lf' | 'crlf' | 'auto'>('expectedEOL', 'auto'),
		detectOnOpen: config.get<boolean>('detectOnOpen', true),
		detectOnSave: config.get<boolean>('detectOnSave', true),
		mode: config.get<'detectOnly' | 'askBeforeFix' | 'fixOnSave'>('mode', 'detectOnly'),
		cooldownSeconds: config.get<number>('cooldownSeconds', 60),
		respectEditorConfig: config.get<boolean>('respectEditorConfig', true),
	};
}

function isTextDocument(document: vscode.TextDocument): boolean {
	if (document.languageId === 'binary') {
		return false;
	}
	return document.uri.scheme === 'file' || document.uri.scheme === 'untitled';
}

function buildEdits(document: vscode.TextDocument, target: 'lf' | 'crlf'): vscode.TextEdit[] {
	const text = document.getText();
	const converted = convertTextEol(text, target);
	if (converted === text) {
		return [];
	}
	return [vscode.TextEdit.replace(getFullRange(document), converted)];
}

function getFullRange(document: vscode.TextDocument): vscode.Range {
	const lastLine = document.lineCount > 0 ? document.lineCount - 1 : 0;
	const lastLineText = document.lineAt(lastLine).text;
	return new vscode.Range(0, 0, lastLine, lastLineText.length);
}

function buildSourceLabel(source: 'editorconfig' | 'settings' | 'auto', sourcePath?: string): string {
	if (source === 'editorconfig') {
		return sourcePath
			? vscode.l10n.t('editorconfig ({0})', sourcePath)
			: vscode.l10n.t('editorconfig');
	}
	return vscode.l10n.t(source);
}

async function showConversionMessage(target: 'lf' | 'crlf', status: ConversionResult['status']): Promise<void> {
	const label = target.toUpperCase();
	if (status === 'changed') {
		await vscode.window.showInformationMessage(vscode.l10n.t('EOL corrected to {0}.', label));
		return;
	}
	if (status === 'unchanged') {
		await vscode.window.showInformationMessage(vscode.l10n.t('EOL already {0}.', label));
		return;
	}
	await vscode.window.showWarningMessage(vscode.l10n.t('EOL update failed.'));
}
