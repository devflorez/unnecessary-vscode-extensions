import * as path from 'node:path';
import * as vscode from 'vscode';

import {
	convertTextEol,
	decideAction,
	mapEolEnum,
	resolveExpectedEol,
} from './core/eolCore';
import { matchGlob, normalizePath } from './core/glob';
import { findEditorConfigEol } from './editorconfig';

const COMMAND_FIX = 'eol-guardian.fixCurrentFileEol';
const COMMAND_SHOW = 'eol-guardian.showCurrentFileEol';
const COMMAND_TOGGLE = 'eol-guardian.toggleEnabled';
const COMMAND_FIX_WORKSPACE = 'eol-guardian.fixWorkspaceEol';
const COMMAND_SET_MODE = 'eol-guardian.setMode';

const CONVERT_ACTION = 'Convert';
const IGNORE_ACTION = 'Ignore';

const DEFAULT_EXCLUDE = '**/{node_modules,.git,dist,build,out}/**';

let sessionFixes = 0;

type Config = {
	enabled: boolean;
	expectedEOL: 'lf' | 'crlf' | 'auto';
	detectOnOpen: boolean;
	detectOnSave: boolean;
	mode: 'detectOnly' | 'askBeforeFix' | 'fixOnSave';
	cooldownSeconds: number;
	respectEditorConfig: boolean;
	finalNewlineOnly: boolean;
	overrides: OverrideConfig[];
	ignore: string[];
};

type OverrideConfig = {
	languageId?: string;
	pattern?: string;
	eol: 'lf' | 'crlf';
	description?: string;
};

type FileState = {
	lastNotifiedAt: number | null;
	ignored: boolean;
	pendingFixEol?: 'lf' | 'crlf';
	pendingFinalNewline?: boolean;
};

type ConversionResult = {
	status: 'changed' | 'unchanged' | 'failed';
};

type ExpectedEolInfo = {
	expected: 'lf' | 'crlf' | 'auto';
	source: 'editorconfig' | 'override' | 'settings' | 'auto';
	sourcePath?: string;
	sourceDetail?: string;
};

type StatusBarState = {
	text: string;
	tooltip?: vscode.MarkdownString | string;
};

type DecisionContext = {
	document: vscode.TextDocument;
	expectedEol: 'lf' | 'crlf';
	decision: ReturnType<typeof decideAction>;
	currentLabel: string;
	expectedLabel: string;
	key: string;
	state: FileState;
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
		if (!isTextDocument(document)) {
			return false;
		}
		if (isIgnored(document, config)) {
			return false;
		}
		return true;
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

	const applyDecision = async (context: DecisionContext, states: Map<string, FileState>): Promise<void> => {
		if (context.decision.action === 'warn') {
			await showMismatchWarning(context.currentLabel, context.expectedLabel);
			return;
		}

		if (context.decision.action === 'prompt') {
			const choice = await promptToFix(context.currentLabel, context.expectedLabel);
			if (choice === 'convert') {
				const result = await convertDocumentEol(context.document, context.expectedEol);
				await showConversionMessage(context.expectedEol, result.status);
				return;
			}
			if (choice === 'ignore') {
				states.set(context.key, { ...context.state, ignored: true });
			}
			return;
		}

		if (context.decision.action === 'fix') {
			const result = await convertDocumentEol(context.document, context.expectedEol);
			await showConversionMessage(context.expectedEol, result.status);
		}
	};

	const updateStatusBar = async (editor: vscode.TextEditor | undefined): Promise<void> => {
		const status = await buildStatusBarState(editor, getConfig());
		statusBar.text = status.text;
		statusBar.tooltip = status.tooltip;
	};

	const handleDocument = async (document: vscode.TextDocument, reason: 'open' | 'save'): Promise<void> => {
		const config = getConfig();
		if (!shouldProcessDocument(document, reason, config)) {
			await updateStatusBar(vscode.window.activeTextEditor);
			return;
		}
		if (config.finalNewlineOnly) {
			await handleFinalNewline(document, config, fileState);
			await updateStatusBar(vscode.window.activeTextEditor);
			return;
		}

		const expectedInfo = await getExpectedEolInfo(document, config);
		if (expectedInfo.expected === 'auto') {
			await updateStatusBar(vscode.window.activeTextEditor);
			return;
		}

		const decisionContext = buildDecisionContext(document, expectedInfo.expected, config, fileState);
		if (!decisionContext) {
			await updateStatusBar(vscode.window.activeTextEditor);
			return;
		}

		await applyDecision(decisionContext, fileState);
		await updateStatusBar(vscode.window.activeTextEditor);
	};

	const onOpen = vscode.workspace.onDidOpenTextDocument((document) => {
		void handleDocument(document, 'open');
	});

	const onSave = vscode.workspace.onDidSaveTextDocument((document) => {
		const config = getConfig();
		if (config.mode === 'fixOnSave') {
			const state = fileState.get(document.uri.toString());
			if (config.finalNewlineOnly && state?.pendingFinalNewline) {
				state.pendingFinalNewline = false;
				fileState.set(document.uri.toString(), state);
				void showFinalNewlineMessage('changed');
			}
			if (!config.finalNewlineOnly && state?.pendingFixEol) {
				const pending = state.pendingFixEol;
				state.pendingFixEol = undefined;
				fileState.set(document.uri.toString(), state);
				void showConversionMessage(pending, 'changed');
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
				if (config.finalNewlineOnly) {
					const edits = buildFinalNewlineEdits(event.document);
					if (edits.length > 0) {
						const key = event.document.uri.toString();
						const state = fileState.get(key) ?? { lastNotifiedAt: null, ignored: false };
						state.pendingFinalNewline = true;
						fileState.set(key, state);
					}
					return edits;
				}
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
		if (config.finalNewlineOnly) {
			const result = await ensureFinalNewline(editor.document);
			await showFinalNewlineMessage(result);
			await updateStatusBar(editor);
			return;
		}
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
		if (isIgnored(editor.document, config)) {
			await vscode.window.showInformationMessage(vscode.l10n.t('EOL Guardian ignored for this file.'));
			return;
		}
		if (config.finalNewlineOnly) {
			const missing = !hasFinalNewline(editor.document);
			await vscode.window.showInformationMessage(
				missing
					? vscode.l10n.t('Final newline: missing')
					: vscode.l10n.t('Final newline: present'),
			);
			return;
		}
		const current = mapEolEnum(editor.document.eol);
		const expectedInfo = await getExpectedEolInfo(editor.document, config);
		const sourceLabel = buildSourceLabel(
			expectedInfo.source,
			expectedInfo.sourceDetail,
			expectedInfo.sourcePath,
		);
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

	const setModeCommand = vscode.commands.registerCommand(COMMAND_SET_MODE, async () => {
		const config = vscode.workspace.getConfiguration('eolGuardian');
		const options = [
			{ label: 'detectOnly', description: vscode.l10n.t('Warn only'), value: 'detectOnly' as const },
			{ label: 'askBeforeFix', description: vscode.l10n.t('Ask before converting'), value: 'askBeforeFix' as const },
			{ label: 'fixOnSave', description: vscode.l10n.t('Fix automatically on save'), value: 'fixOnSave' as const },
		];
		const pick = await vscode.window.showQuickPick(options, {
			placeHolder: vscode.l10n.t('Choose EOL Guardian mode'),
		});
		if (!pick) {
			return;
		}
		await config.update('mode', pick.value, vscode.ConfigurationTarget.Global);
		await vscode.window.showInformationMessage(vscode.l10n.t('Mode set to {0}.', pick.label));
		await updateStatusBar(vscode.window.activeTextEditor);
	});

	const fixWorkspaceCommand = vscode.commands.registerCommand(COMMAND_FIX_WORKSPACE, async () => {
		const config = getConfig();
		if (!config.enabled) {
			await vscode.window.showInformationMessage(vscode.l10n.t('EOL Guardian is disabled.'));
			return;
		}
		const convertLabel = vscode.l10n.t(CONVERT_ACTION);
		const cancelLabel = vscode.l10n.t('Cancel');
		const confirm = await vscode.window.showWarningMessage(
			vscode.l10n.t('Fix EOL for all files in workspace?'),
			convertLabel,
			cancelLabel,
		);
		if (confirm !== convertLabel) {
			return;
		}

		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: vscode.l10n.t('EOL Guardian: Fixing workspace'),
				cancellable: true,
			},
			async (progress, token) => runWorkspaceFix(config, progress, token),
		);
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
		setModeCommand,
		fixWorkspaceCommand,
	);

	void updateStatusBar(vscode.window.activeTextEditor);
}

export function deactivate(): void {
	// No cleanup required.
}

async function buildStatusBarState(
	editor: vscode.TextEditor | undefined,
	config: Config,
): Promise<StatusBarState> {
	if (!config.enabled) {
		return { text: vscode.l10n.t('EOL: OFF') };
	}
	if (!editor) {
		return { text: vscode.l10n.t('EOL: --') };
	}
	const document = editor.document;
	const current = mapEolEnum(document.eol);
	if (isIgnored(document, config)) {
		return buildIgnoredStatusState(current);
	}
	if (config.finalNewlineOnly) {
		return buildFinalNewlineStatusState(current, document);
	}
	const expectedInfo = await getExpectedEolInfo(document, config);
	return buildActiveStatusState(current, expectedInfo);
}

function buildIgnoredStatusState(current: string): StatusBarState {
	return {
		text: vscode.l10n.t('EOL: {0} ({1})', current.toUpperCase(), vscode.l10n.t('ignored')),
		tooltip: vscode.l10n.t('Ignored by pattern'),
	};
}

function buildActiveStatusState(current: string, expectedInfo: ExpectedEolInfo): StatusBarState {
	const sourceLabel = buildSourceLabel(expectedInfo.source, expectedInfo.sourceDetail, expectedInfo.sourcePath);
	const mismatch = expectedInfo.expected !== 'auto' && current !== expectedInfo.expected;
	const currentLabel = current.toUpperCase();
	const expectedLabel = expectedInfo.expected.toUpperCase();
	return {
		text: mismatch
			? vscode.l10n.t('EOL: {0} ({1}) ⚠️', currentLabel, sourceLabel)
			: vscode.l10n.t('EOL: {0} ({1})', currentLabel, sourceLabel),
		tooltip: buildStatusTooltip(currentLabel, expectedLabel, sourceLabel, sessionFixes),
	};
}

function buildFinalNewlineStatusState(current: string, document: vscode.TextDocument): StatusBarState {
	const missing = !hasFinalNewline(document);
	const currentLabel = current.toUpperCase();
	return {
		text: missing
			? vscode.l10n.t('EOL: {0} ⚠️', currentLabel)
			: vscode.l10n.t('EOL: {0}', currentLabel),
		tooltip: buildFinalNewlineTooltip(missing),
	};
}

function buildFinalNewlineTooltip(missing: boolean): vscode.MarkdownString {
	const tooltip = new vscode.MarkdownString();
	tooltip.appendMarkdown(missing
		? `${vscode.l10n.t('Final newline: missing')}  \\n`
		: `${vscode.l10n.t('Final newline: present')}  \\n`);
	return tooltip;
}

async function handleFinalNewline(
	document: vscode.TextDocument,
	config: Config,
	fileState: Map<string, FileState>,
): Promise<void> {
	if (config.mode === 'fixOnSave') {
		return;
	}
	const missing = !hasFinalNewline(document);
	if (!missing) {
		return;
	}
	const key = document.uri.toString();
	const state = fileState.get(key) ?? { lastNotifiedAt: null, ignored: false };
	if (state.ignored) {
		return;
	}
	const now = Date.now();
	if (state.lastNotifiedAt !== null) {
		const elapsed = now - state.lastNotifiedAt;
		if (elapsed < config.cooldownSeconds * 1000) {
			return;
		}
	}
	state.lastNotifiedAt = now;
	fileState.set(key, state);
	if (config.mode === 'detectOnly') {
		await vscode.window.showWarningMessage(vscode.l10n.t('Missing final newline at end of file.'));
		return;
	}
	const addLabel = vscode.l10n.t('Add newline');
	const ignoreLabel = vscode.l10n.t('Ignore');
	const action = await vscode.window.showWarningMessage(
		vscode.l10n.t('Missing final newline at end of file.'),
		addLabel,
		ignoreLabel,
	);
	if (action === addLabel) {
		const result = await ensureFinalNewline(document);
		await showFinalNewlineMessage(result);
		return;
	}
	if (action === ignoreLabel) {
		fileState.set(key, { ...state, ignored: true });
	}
}

function buildDecisionContext(
	document: vscode.TextDocument,
	expectedEol: 'lf' | 'crlf',
	config: Config,
	states: Map<string, FileState>,
): DecisionContext | null {
	const currentEol = mapEolEnum(document.eol);
	const key = document.uri.toString();
	const state = states.get(key) ?? { lastNotifiedAt: null, ignored: false };
	const nowMs = Date.now();
	const decision = decideAction({
		currentEol,
		expected: expectedEol,
		mode: config.mode,
		cooldownSeconds: config.cooldownSeconds,
		nowMs,
		lastNotifiedAt: state.lastNotifiedAt,
		ignored: state.ignored,
	});
	if (decision.action === 'none') {
		return null;
	}
	state.lastNotifiedAt = nowMs;
	states.set(key, state);
	return {
		document,
		expectedEol,
		decision,
		currentLabel: currentEol.toUpperCase(),
		expectedLabel: expectedEol.toUpperCase(),
		key,
		state,
	};
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

function hasFinalNewline(document: vscode.TextDocument): boolean {
	const text = document.getText();
	return text.length === 0 || text.endsWith('\n');
}

function buildFinalNewlineEdits(document: vscode.TextDocument): vscode.TextEdit[] {
	if (hasFinalNewline(document)) {
		return [];
	}
	const eol = mapEolEnum(document.eol) === 'crlf' ? '\r\n' : '\n';
	const lastLine = document.lineCount > 0 ? document.lineCount - 1 : 0;
	const lastLineText = document.lineAt(lastLine).text;
	const position = new vscode.Position(lastLine, lastLineText.length);
	return [vscode.TextEdit.insert(position, eol)];
}

async function ensureFinalNewline(document: vscode.TextDocument): Promise<ConversionResult['status']> {
	const edits = buildFinalNewlineEdits(document);
	if (edits.length === 0) {
		return 'unchanged';
	}
	const editor = vscode.window.visibleTextEditors.find((item) => item.document.uri.toString() === document.uri.toString());
	if (editor) {
		const success = await editor.edit((edit) => {
			edit.insert(edits[0].range.start, edits[0].newText);
		});
		return success ? 'changed' : 'failed';
	}
	const edit = new vscode.WorkspaceEdit();
	edit.set(document.uri, edits);
	const applied = await vscode.workspace.applyEdit(edit);
	return applied ? 'changed' : 'failed';
}

async function getExpectedEolInfo(document: vscode.TextDocument, config: Config): Promise<ExpectedEolInfo> {
	let editorconfigValue: 'lf' | 'crlf' | null = null;
	let sourcePath: string | undefined;
	if (config.respectEditorConfig && document.uri.scheme === 'file') {
		const result = await findEditorConfigEol(document.uri.fsPath);
		if (result) {
			editorconfigValue = result.endOfLine;
			sourcePath = result.sourcePath;
		}
	}
	const override = resolveOverrideEol(document, config);
	const resolved = resolveExpectedEol(
		config.expectedEOL,
		editorconfigValue,
		config.respectEditorConfig,
		override?.eol,
	);
	return {
		expected: resolved.expected,
		source: resolved.source,
		sourcePath,
		sourceDetail: override?.detail,
	};
}

function getConfig(): Config {
	const config = vscode.workspace.getConfiguration('eolGuardian');
	const overridesRaw = config.get<OverrideConfig[]>('overrides', []);
	const ignoreRaw = config.get<string[]>('ignore', []);
	return {
		enabled: config.get<boolean>('enabled', true),
		expectedEOL: config.get<'lf' | 'crlf' | 'auto'>('expectedEOL', 'auto'),
		detectOnOpen: config.get<boolean>('detectOnOpen', true),
		detectOnSave: config.get<boolean>('detectOnSave', true),
		mode: config.get<'detectOnly' | 'askBeforeFix' | 'fixOnSave'>('mode', 'detectOnly'),
		cooldownSeconds: config.get<number>('cooldownSeconds', 60),
		respectEditorConfig: config.get<boolean>('respectEditorConfig', true),
		finalNewlineOnly: config.get<boolean>('finalNewlineOnly', false),
		overrides: sanitizeOverrides(overridesRaw),
		ignore: sanitizeIgnore(ignoreRaw),
	};
}

function sanitizeOverrides(overrides: OverrideConfig[]): OverrideConfig[] {
	return (overrides ?? [])
		.filter(Boolean)
		.filter((override) => override.eol === 'lf' || override.eol === 'crlf')
		.filter((override) => Boolean(override.languageId) || Boolean(override.pattern))
		.map((override) => ({
			languageId: override.languageId?.trim() || undefined,
			pattern: override.pattern?.trim() || undefined,
			eol: override.eol,
			description: override.description?.trim() || undefined,
		}));
}

function sanitizeIgnore(list: string[]): string[] {
	return (list ?? []).map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}

function resolveOverrideEol(
	document: vscode.TextDocument,
	config: Config,
): { eol: 'lf' | 'crlf'; detail?: string } | null {
	if (config.overrides.length === 0) {
		return null;
	}
	const pathForMatch = getPathForMatch(document);
	const matched = config.overrides.find((override) => matchesOverride(override, document, pathForMatch));
	if (!matched) {
		return null;
	}
	return { eol: matched.eol, detail: buildOverrideDetail(matched) };
}

function matchesOverride(
	override: OverrideConfig,
	document: vscode.TextDocument,
	pathForMatch: string | null,
): boolean {
	if (override.languageId && override.languageId !== document.languageId) {
		return false;
	}
	if (!override.pattern) {
		return true;
	}
	if (!pathForMatch) {
		return false;
	}
	return matchGlob(override.pattern, pathForMatch);
}

function buildOverrideDetail(override: OverrideConfig): string | undefined {
	const detailParts: string[] = [];
	if (override.languageId) {
		detailParts.push(`lang:${override.languageId}`);
	}
	if (override.pattern) {
		detailParts.push(override.pattern);
	}
	const detail = detailParts.join(', ');
	return detail.length > 0 ? detail : undefined;
}

function isIgnored(document: vscode.TextDocument, config: Config): boolean {
	if (config.ignore.length === 0) {
		return false;
	}
	const pathForMatch = getPathForMatch(document);
	if (!pathForMatch) {
		return false;
	}
	return config.ignore.some((pattern) => matchGlob(pattern, pathForMatch));
}

async function runWorkspaceFix(
	config: Config,
	progress: vscode.Progress<{ message?: string }>,
	token: vscode.CancellationToken,
): Promise<void> {
	const files = await vscode.workspace.findFiles('**/*', DEFAULT_EXCLUDE);
	let updated = 0;
	let processed = 0;
	for (const uri of files) {
		if (token.isCancellationRequested) {
			break;
		}
		const updatedFile = await safeProcessWorkspaceFile(uri, config);
		if (updatedFile) {
			updated += 1;
			sessionFixes += 1;
		}
		processed += 1;
		progress.report({
			message: vscode.l10n.t('Processed {0} files', processed),
		});
	}
	await vscode.window.showInformationMessage(
		vscode.l10n.t('Workspace EOL fix complete. {0} files updated.', updated),
	);
}

async function safeProcessWorkspaceFile(uri: vscode.Uri, config: Config): Promise<boolean> {
	try {
		return await processWorkspaceFile(uri, config);
	} catch {
		return false;
	}
}

async function processWorkspaceFile(uri: vscode.Uri, config: Config): Promise<boolean> {
	const document = await vscode.workspace.openTextDocument(uri);
	if (!shouldProcessWorkspaceDocument(document, config)) {
		return false;
	}
	if (config.finalNewlineOnly) {
		const edits = buildFinalNewlineEdits(document);
		if (edits.length === 0) {
			return false;
		}
		const edit = new vscode.WorkspaceEdit();
		edit.set(uri, edits);
		const applied = await vscode.workspace.applyEdit(edit);
		if (!applied) {
			return false;
		}
		await document.save();
		return true;
	}
	const expectedInfo = await getExpectedEolInfo(document, config);
	if (expectedInfo.expected === 'auto') {
		return false;
	}
	const original = document.getText();
	const converted = convertTextEol(original, expectedInfo.expected);
	if (converted === original) {
		return false;
	}
	const edit = new vscode.WorkspaceEdit();
	edit.replace(uri, getFullRange(document), converted);
	const applied = await vscode.workspace.applyEdit(edit);
	if (!applied) {
		return false;
	}
	await document.save();
	return true;
}

function shouldProcessWorkspaceDocument(document: vscode.TextDocument, config: Config): boolean {
	if (!isTextDocument(document)) {
		return false;
	}
	if (isIgnored(document, config)) {
		return false;
	}
	return true;
}

function getPathForMatch(document: vscode.TextDocument): string | null {
	if (document.uri.scheme === 'file') {
		const folder = vscode.workspace.getWorkspaceFolder(document.uri);
		const filePath = document.uri.fsPath;
		if (folder) {
			return normalizePath(path.relative(folder.uri.fsPath, filePath));
		}
		return normalizePath(filePath);
	}
	return document.fileName ? normalizePath(document.fileName) : null;
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

function buildSourceLabel(
	source: 'editorconfig' | 'override' | 'settings' | 'auto',
	detail?: string,
	sourcePath?: string,
): string {
	if (source === 'editorconfig') {
		return sourcePath
			? vscode.l10n.t('editorconfig ({0})', sourcePath)
			: vscode.l10n.t('editorconfig');
	}
	if (source === 'override') {
		return detail
			? vscode.l10n.t('override ({0})', detail)
			: vscode.l10n.t('override');
	}
	return vscode.l10n.t(source);
}

function buildStatusTooltip(current: string, expected: string, source: string, fixes: number): vscode.MarkdownString {
	const tooltip = new vscode.MarkdownString();
	tooltip.appendMarkdown(`${vscode.l10n.t('Current: {0}', current)}  \n`);
	tooltip.appendMarkdown(`${vscode.l10n.t('Expected: {0}', expected)}  \n`);
	tooltip.appendMarkdown(`${vscode.l10n.t('Source: {0}', source)}  \n`);
	tooltip.appendMarkdown(`${vscode.l10n.t('Fixes this session: {0}', fixes)}`);
	return tooltip;
}

async function showConversionMessage(target: 'lf' | 'crlf', status: ConversionResult['status']): Promise<void> {
	const label = target.toUpperCase();
	if (status === 'changed') {
		sessionFixes += 1;
		await vscode.window.showInformationMessage(vscode.l10n.t('EOL corrected to {0}.', label));
		return;
	}
	if (status === 'unchanged') {
		await vscode.window.showInformationMessage(vscode.l10n.t('EOL already {0}.', label));
		return;
	}
	await vscode.window.showWarningMessage(vscode.l10n.t('EOL update failed.'));
}

async function showFinalNewlineMessage(status: ConversionResult['status']): Promise<void> {
	if (status === 'changed') {
		sessionFixes += 1;
		await vscode.window.showInformationMessage(vscode.l10n.t('Final newline added.'));
		return;
	}
	if (status === 'unchanged') {
		await vscode.window.showInformationMessage(vscode.l10n.t('Final newline already present.'));
		return;
	}
	await vscode.window.showWarningMessage(vscode.l10n.t('Final newline update failed.'));
}
