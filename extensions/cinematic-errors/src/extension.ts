import * as vscode from 'vscode';

import { formatCinematicMessage, matchCinematicMessage } from './core/translator';

const COMMAND_TOGGLE = 'cinematic-errors.toggleEnabled';
const COMMAND_SHOW_LAST = 'cinematic-errors.showLastTrailer';
const COMMAND_RESET_COOLDOWN = 'cinematic-errors.resetCooldown';

const STATUS_ON = '🎬 Cinematic Errors: ON';
const STATUS_OFF = '🎬 Cinematic Errors: OFF';

type Config = {
	enabled: boolean;
	cooldownSeconds: number;
	showOnEveryError: boolean;
	useWebview: boolean;
	showInlineHover: boolean;
	showGutterIcon: boolean;
	showInlineMessage: boolean;
	viewLocation: 'sidebar' | 'panel';
	autoRevealView: boolean;
};

type ErrorCandidate = {
	key: string;
	diagnostic: vscode.Diagnostic;
};

let lastShownAt = 0;
let lastTrailerText: string | null = null;
let lastTrailerTitle: string | null = null;
let lastActiveUri: string | null = null;
let lastActiveKeys = new Set<string>();
const seenErrorKeys = new Set<string>();
let trailerViewProvider: TrailerViewProvider | null = null;
let trailerPanelProvider: TrailerViewProvider | null = null;
const trailerHistory: TrailerEntry[] = [];
const MAX_HISTORY = 5;

type TrailerEntry = {
	title: string;
	message: string;
	timestamp: number;
};

export function activate(context: vscode.ExtensionContext): void {
	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	statusBar.command = COMMAND_TOGGLE;
	const hoverDecoration = vscode.window.createTextEditorDecorationType({});
	const hoverIconDecoration = vscode.window.createTextEditorDecorationType({
		gutterIconPath: vscode.Uri.joinPath(context.extensionUri, 'media', 'cinematic-errors-icon.png'),
		gutterIconSize: 'contain',
	});
	const inlineMessageDecoration = vscode.window.createTextEditorDecorationType({
		isWholeLine: true,
	});
	const codeLensEmitter = new vscode.EventEmitter<void>();

	trailerViewProvider = new TrailerViewProvider(context.extensionUri);
	trailerPanelProvider = new TrailerViewProvider(context.extensionUri);
	const sidebarView = vscode.window.registerWebviewViewProvider('cinematicErrors.trailerView', trailerViewProvider);
	const panelView = vscode.window.registerWebviewViewProvider('cinematicErrors.panelView', trailerPanelProvider);
	const codeLensProvider = vscode.languages.registerCodeLensProvider(
		[{ scheme: 'file' }, { scheme: 'untitled' }],
		new CinematicCodeLensProvider(codeLensEmitter, getLocale),
	);
	context.subscriptions.push(
		statusBar,
		hoverDecoration,
		hoverIconDecoration,
		inlineMessageDecoration,
		codeLensEmitter,
		sidebarView,
		panelView,
		codeLensProvider,
	);

	const updateStatusBar = (enabled: boolean): void => {
		statusBar.text = enabled ? vscode.l10n.t(STATUS_ON) : vscode.l10n.t(STATUS_OFF);
		statusBar.show();
	};

	const toggleCommand = vscode.commands.registerCommand(COMMAND_TOGGLE, async () => {
		const config = vscode.workspace.getConfiguration('cinematicErrors');
		const current = config.get<boolean>('enabled', true);
		await config.update('enabled', !current, vscode.ConfigurationTarget.Global);
		updateStatusBar(!current);
	});

	const showLastCommand = vscode.commands.registerCommand(COMMAND_SHOW_LAST, async () => {
		const config = getConfig();
		if (!lastTrailerText) {
			await vscode.window.showInformationMessage(vscode.l10n.t('No cinematic errors yet.'));
			return;
		}
		showTrailer(lastTrailerText, lastTrailerTitle ?? vscode.l10n.t('Cinematic Errors'), config);
	});

	const resetCooldownCommand = vscode.commands.registerCommand(COMMAND_RESET_COOLDOWN, async () => {
		lastShownAt = 0;
		await vscode.window.showInformationMessage(vscode.l10n.t('Cinematic Errors cooldown reset.'));
	});

	context.subscriptions.push(toggleCommand, showLastCommand, resetCooldownCommand);

	const onActiveEditor = vscode.window.onDidChangeActiveTextEditor((editor) => {
		if (!editor) {
			lastActiveUri = null;
			lastActiveKeys = new Set<string>();
			return;
		}
		const { keys } = collectErrorKeys(editor.document);
		lastActiveUri = editor.document.uri.toString();
		lastActiveKeys = keys;
		updateInlineHover(editor, getConfig(), hoverDecoration, hoverIconDecoration);
		updateInlineMessage(editor, getConfig(), inlineMessageDecoration);
		codeLensEmitter.fire();
	});

	const onConfigChange = vscode.workspace.onDidChangeConfiguration((event) => {
		if (!event.affectsConfiguration('cinematicErrors')) {
			return;
		}
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			updateInlineHover(editor, getConfig(), hoverDecoration, hoverIconDecoration);
			updateInlineMessage(editor, getConfig(), inlineMessageDecoration);
		}
		codeLensEmitter.fire();
	});

	const onDiagnostics = vscode.languages.onDidChangeDiagnostics((event) => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}
		const activeUri = editor.document.uri.toString();
		if (!event.uris.some((uri) => uri.toString() === activeUri)) {
			return;
		}
		void handleDiagnostics(editor.document, hoverDecoration, hoverIconDecoration);
		updateInlineMessage(editor, getConfig(), inlineMessageDecoration);
		codeLensEmitter.fire();
	});

	context.subscriptions.push(onActiveEditor, onConfigChange, onDiagnostics);

	updateStatusBar(getConfig().enabled);
	const activeEditor = vscode.window.activeTextEditor;
	if (activeEditor) {
		updateInlineHover(activeEditor, getConfig(), hoverDecoration, hoverIconDecoration);
		updateInlineMessage(activeEditor, getConfig(), inlineMessageDecoration);
	}
	codeLensEmitter.fire();
}

export function deactivate(): void {
	trailerViewProvider = null;
}

async function handleDiagnostics(
	document: vscode.TextDocument,
	hoverDecoration: vscode.TextEditorDecorationType,
	hoverIconDecoration: vscode.TextEditorDecorationType,
): Promise<void> {
	const config = getConfig();
	if (!config.enabled) {
		return;
	}
	const now = Date.now();
	if (!canShowTrailer(now, config.cooldownSeconds)) {
		return;
	}
	const activeUri = document.uri.toString();
	const { keys, candidates } = collectErrorKeys(document);
	const previousKeys = lastActiveUri === activeUri ? lastActiveKeys : new Set<string>();
	const newKeys = difference(keys, previousKeys);
	lastActiveUri = activeUri;
	lastActiveKeys = keys;

	const activeEditor = vscode.window.activeTextEditor;
	if (activeEditor?.document.uri.toString() === activeUri) {
		updateInlineHover(activeEditor, config, hoverDecoration, hoverIconDecoration);
	}

	const candidate = selectCandidate(candidates, newKeys, config.showOnEveryError);
	if (!candidate) {
		return;
	}
	if (seenErrorKeys.has(candidate.key)) {
		return;
	}

	const cinematic = matchCinematicMessage(candidate.diagnostic.message, getLocale());
	const trailerText = formatCinematicMessage(cinematic);

	seenErrorKeys.add(candidate.key);
	lastShownAt = now;
	lastTrailerText = trailerText;
	lastTrailerTitle = vscode.l10n.t('Cinematic Errors');
	addToHistory({ title: lastTrailerTitle, message: trailerText, timestamp: now });

	showTrailer(trailerText, lastTrailerTitle, config);
}

function getConfig(): Config {
	const config = vscode.workspace.getConfiguration('cinematicErrors');
	return {
		enabled: config.get<boolean>('enabled', true),
		cooldownSeconds: config.get<number>('cooldownSeconds', 30),
		showOnEveryError: config.get<boolean>('showOnEveryError', false),
		useWebview: config.get<boolean>('useWebview', false),
		showInlineHover: config.get<boolean>('showInlineHover', false),
		showGutterIcon: config.get<boolean>('showGutterIcon', true),
		showInlineMessage: config.get<boolean>('showInlineMessage', false),
		viewLocation: config.get<'sidebar' | 'panel'>('viewLocation', 'sidebar'),
		autoRevealView: config.get<boolean>('autoRevealView', false),
	};
}

function canShowTrailer(nowMs: number, cooldownSeconds: number): boolean {
	if (lastShownAt === 0) {
		return true;
	}
	return nowMs - lastShownAt >= cooldownSeconds * 1000;
}

function collectErrorKeys(document: vscode.TextDocument): { keys: Set<string>; candidates: ErrorCandidate[] } {
	const diagnostics = vscode.languages.getDiagnostics(document.uri);
	const errors = diagnostics.filter((diag) => diag.severity === vscode.DiagnosticSeverity.Error);
	const keys = new Set<string>();
	const candidates: ErrorCandidate[] = [];
	for (const diagnostic of errors) {
		const key = buildErrorKey(document.uri, diagnostic);
		keys.add(key);
		candidates.push({ key, diagnostic });
	}
	return { keys, candidates };
}

function buildErrorKey(uri: vscode.Uri, diagnostic: vscode.Diagnostic): string {
	const range = `${diagnostic.range.start.line}:${diagnostic.range.start.character}`;
	let code = '';
	if (diagnostic.code !== undefined) {
		if (typeof diagnostic.code === 'string' || typeof diagnostic.code === 'number') {
			code = String(diagnostic.code);
		} else if (typeof diagnostic.code === 'object' && 'value' in diagnostic.code) {
			code = String(diagnostic.code.value);
		}
	}
	return `${uri.toString()}|${diagnostic.message}|${range}|${code}`;
}

function difference(current: Set<string>, previous: Set<string>): Set<string> {
	const diff = new Set<string>();
	for (const value of current) {
		if (!previous.has(value)) {
			diff.add(value);
		}
	}
	return diff;
}

function selectCandidate(
	candidates: ErrorCandidate[],
	newKeys: Set<string>,
	showOnEveryError: boolean,
): ErrorCandidate | null {
	if (candidates.length === 0) {
		return null;
	}
	if (showOnEveryError) {
		return candidates.find((candidate) => !seenErrorKeys.has(candidate.key)) ?? null;
	}
	for (const candidate of candidates) {
		if (newKeys.has(candidate.key) && !seenErrorKeys.has(candidate.key)) {
			return candidate;
		}
	}
	return null;
}

function showTrailer(message: string, title: string, config: Config): void {
	if (config.useWebview) {
		showWebviewTrailer(message, title);
		return;
	}
	void vscode.window.showInformationMessage(message);
}

function showWebviewTrailer(message: string, title: string): void {
	if (!trailerViewProvider) {
		return;
	}
	const config = getConfig();
	const location = config.viewLocation;
	if (location === 'panel') {
		trailerPanelProvider?.update(message, title, trailerHistory);
		if (config.autoRevealView) {
			void vscode.commands.executeCommand('workbench.view.extension.cinematicErrorsPanel');
		}
		return;
	}
	trailerViewProvider.update(message, title, trailerHistory);
	if (config.autoRevealView) {
		void vscode.commands.executeCommand('workbench.view.extension.cinematicErrors');
	}
}

function updateInlineHover(
	editor: vscode.TextEditor,
	config: Config,
	hoverDecoration: vscode.TextEditorDecorationType,
	hoverIconDecoration: vscode.TextEditorDecorationType,
): void {
	const hoverEnabled = config.enabled && config.showInlineHover;
	const iconEnabled = config.enabled && config.showGutterIcon;
	if (!hoverEnabled && !iconEnabled) {
		editor.setDecorations(hoverDecoration, []);
		editor.setDecorations(hoverIconDecoration, []);
		return;
	}
	const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
	const errors = diagnostics.filter((diag) => diag.severity === vscode.DiagnosticSeverity.Error);
	if (errors.length === 0) {
		editor.setDecorations(hoverDecoration, []);
		editor.setDecorations(hoverIconDecoration, []);
		return;
	}
	const locale = getLocale();
	const hoverDecorations = hoverEnabled
		? errors.map((diagnostic) => {
			const cinematic = matchCinematicMessage(diagnostic.message, locale);
			const markdown = buildHoverMarkdown(cinematic.lines);
			return { range: diagnostic.range, hoverMessage: markdown };
		})
		: [];
	const iconDecorations = iconEnabled
		? errors.map((diagnostic) => ({ range: diagnostic.range }))
		: [];
	editor.setDecorations(hoverDecoration, hoverDecorations);
	editor.setDecorations(hoverIconDecoration, iconDecorations);
}

function updateInlineMessage(
	editor: vscode.TextEditor,
	config: Config,
	inlineMessageDecoration: vscode.TextEditorDecorationType,
): void {
	if (!config.enabled || !config.showInlineMessage) {
		editor.setDecorations(inlineMessageDecoration, []);
		return;
	}
	const codeLensEnabled = vscode.workspace.getConfiguration('editor').get<boolean>('codeLens', true);
	if (codeLensEnabled) {
		editor.setDecorations(inlineMessageDecoration, []);
		return;
	}
	const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
	const errors = diagnostics.filter((diag) => diag.severity === vscode.DiagnosticSeverity.Error);
	if (errors.length === 0) {
		editor.setDecorations(inlineMessageDecoration, []);
		return;
	}
	const primary = pickPrimaryError(errors);
	if (!primary) {
		editor.setDecorations(inlineMessageDecoration, []);
		return;
	}
	const cinematic = matchCinematicMessage(primary.message, getLocale());
	const lineText = truncateInlineMessage(cinematic.lines.join(' • '));
	const range = new vscode.Range(primary.range.start.line, 0, primary.range.start.line, 0);
	const decoration: vscode.DecorationOptions = {
		range,
		renderOptions: {
			before: {
				contentText: `🎬 ${lineText}`,
				margin: '0 0 0 20px',
				color: 'var(--vscode-descriptionForeground)',
				fontStyle: 'italic',
			},
		},
	};
	editor.setDecorations(inlineMessageDecoration, [decoration]);
}

function truncateInlineMessage(text: string): string {
	const max = 140;
	if (text.length <= max) {
		return text;
	}
	return `${text.slice(0, max - 1)}…`;
}

function buildHoverMarkdown(lines: string[]): vscode.MarkdownString {
	const markdown = new vscode.MarkdownString();
	markdown.appendMarkdown(`**${vscode.l10n.t('Cinematic Errors')}**  \n`);
	for (const line of lines) {
		markdown.appendText(line);
		markdown.appendMarkdown('  \n');
	}
	return markdown;
}

function buildWebviewHtml(message: string, history: TrailerEntry[]): string {
	const lines = message ? message.split('\n').map((line) => escapeHtml(line)) : [];
	const historyItems = history.length
		? history
			.map((entry, index) => buildHistoryItem(entry, index))
			.join('')
		: `<div class="history-empty">${escapeHtml(vscode.l10n.t('No cinematic errors yet.'))}</div>`;
	const latestTime = history.length ? new Date(history[0].timestamp).toLocaleTimeString() : '--';
	const historyCount = history.length.toString();
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(vscode.l10n.t('Cinematic Errors'))}</title>
<style>
	:root {
		color-scheme: light dark;
		--bg-primary: #0a0d16;
		--bg-secondary: #141a2b;
		--card: rgba(255, 255, 255, 0.06);
		--card-strong: rgba(255, 255, 255, 0.12);
		--text: #f6f0e6;
		--muted: #9aa4b2;
		--accent: #f3c969;
		--accent-2: #7bdff6;
	}
	body {
		margin: 0;
		padding: 24px 32px 40px;
		font-family: "Georgia", "Palatino Linotype", "Times New Roman", serif;
		background:
			radial-gradient(circle at 20% 20%, rgba(123, 223, 246, 0.2), transparent 45%),
			radial-gradient(circle at 80% 0%, rgba(243, 201, 105, 0.2), transparent 50%),
			linear-gradient(180deg, var(--bg-secondary), var(--bg-primary));
		color: var(--text);
		min-height: 100vh;
	}
	.shell {
		max-width: 980px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 24px;
	}
	.mast {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 16px;
	}
	.brand {
		text-transform: uppercase;
		letter-spacing: 0.45em;
		font-size: 12px;
		color: var(--muted);
	}
	.stats {
		display: flex;
		gap: 12px;
		font-size: 12px;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.2em;
	}
	.hero {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(220px, 1fr);
		gap: 18px;
		align-items: stretch;
	}
	.hero-card,
	.poster {
		padding: 24px;
		border-radius: 18px;
		background: var(--card);
		border: 1px solid rgba(255, 255, 255, 0.08);
		box-shadow: 0 18px 35px rgba(0,0,0,0.35);
	}
	.hero-card {
		position: relative;
		overflow: hidden;
	}
	.hero-card::after {
		content: "";
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 4px;
		background: linear-gradient(90deg, var(--accent), transparent);
		opacity: 0.8;
	}
	.hero-lines {
		font-size: 22px;
		line-height: 1.5;
		animation: rise 0.5s ease;
	}
	.hero-line {
		margin-bottom: 12px;
	}
	.poster {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 12px;
		background: linear-gradient(160deg, rgba(243, 201, 105, 0.18), rgba(255, 255, 255, 0));
	}
	.poster-title {
		font-size: 14px;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.poster-icon {
		font-size: 42px;
		color: var(--accent);
	}
	.section-title {
		font-size: 12px;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.history-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 16px;
	}
	.history-item {
		padding: 16px;
		border-radius: 16px;
		background: var(--card);
		border: 1px solid rgba(255, 255, 255, 0.08);
		animation: fadeUp 0.4s ease;
		animation-delay: var(--delay);
		animation-fill-mode: both;
	}
	.history-meta {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.18em;
		color: var(--muted);
		margin-bottom: 8px;
	}
	.history-empty {
		color: var(--muted);
		font-style: italic;
		margin-top: 12px;
	}
	.history-line {
		font-size: 16px;
		line-height: 1.4;
		margin: 0 0 6px;
	}
	@media (max-width: 760px) {
		.hero {
			grid-template-columns: 1fr;
		}
	}
	@keyframes rise {
		from { transform: translateY(6px); opacity: 0; }
		to { transform: translateY(0); opacity: 1; }
	}
	@keyframes fadeUp {
		from { transform: translateY(10px); opacity: 0; }
		to { transform: translateY(0); opacity: 1; }
	}
</style>
</head>
<body>
	<div class="shell">
		<div class="mast">
			<div class="brand">${escapeHtml(vscode.l10n.t('Cinematic Errors'))}</div>
			<div class="stats">
				<span>${escapeHtml(vscode.l10n.t('History'))}: ${historyCount}</span>
				<span>${escapeHtml(latestTime)}</span>
			</div>
		</div>
		<div class="hero">
			<div class="hero-card">
				<div class="hero-lines">
					${lines.length ? lines.map((line) => `<div class="hero-line">${line}</div>`).join('') : `<div class="history-empty">${escapeHtml(vscode.l10n.t('No cinematic errors yet.'))}</div>`}
				</div>
			</div>
			<div class="poster">
				<div class="poster-title">${escapeHtml(vscode.l10n.t('Now Screening'))}</div>
				<div class="poster-icon">🎬</div>
				<div class="history-line">${escapeHtml(vscode.l10n.t('Cinematic Errors'))}</div>
			</div>
		</div>
		<div class="section-title">${escapeHtml(vscode.l10n.t('History'))}</div>
		<div class="history-grid">
			${historyItems}
		</div>
	</div>
</body>
</html>`;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function getLocale(): string {
	return vscode.env.language ?? 'en';
}

class CinematicCodeLensProvider implements vscode.CodeLensProvider {
	constructor(
		private readonly onDidChangeEmitter: vscode.EventEmitter<void>,
		private readonly getLocaleValue: () => string,
	) {}

	get onDidChangeCodeLenses(): vscode.Event<void> {
		return this.onDidChangeEmitter.event;
	}

	provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
		const config = getConfig();
		if (!config.enabled || !config.showInlineMessage) {
			return [];
		}
		const diagnostics = vscode.languages.getDiagnostics(document.uri);
		const errors = diagnostics.filter((diag) => diag.severity === vscode.DiagnosticSeverity.Error);
		if (errors.length === 0) {
			return [];
		}
		const primary = pickPrimaryError(errors);
		if (!primary) {
			return [];
		}
		const cinematic = matchCinematicMessage(primary.message, this.getLocaleValue());
		const range = new vscode.Range(primary.range.start.line, 0, primary.range.start.line, 0);
		return cinematic.lines.map((line) => new vscode.CodeLens(range, {
			title: `🎬 ${line}`,
			command: COMMAND_SHOW_LAST,
		}));
	}
}

function pickPrimaryError(diagnostics: vscode.Diagnostic[]): vscode.Diagnostic | null {
	if (diagnostics.length === 0) {
		return null;
	}
	const sorted = [...diagnostics].sort((a, b) => {
		if (a.range.start.line !== b.range.start.line) {
			return a.range.start.line - b.range.start.line;
		}
		return a.range.start.character - b.range.start.character;
	});
	return sorted[0];
}

class TrailerViewProvider implements vscode.WebviewViewProvider {
	private view: vscode.WebviewView | null = null;
	private lastMessage: string | null = null;
	private lastTitle: string | null = null;
	private history: TrailerEntry[] = [];

	constructor(private readonly extensionUri: vscode.Uri) {}

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		this.view = webviewView;
		webviewView.webview.options = {
			enableScripts: false,
			localResourceRoots: [this.extensionUri],
		};
		const message = this.lastMessage ?? '';
		const title = this.lastTitle ?? vscode.l10n.t('Cinematic Errors');
		webviewView.title = title;
		webviewView.webview.html = buildWebviewHtml(message, this.history);
	}

	update(message: string, title: string, history: TrailerEntry[]): void {
		this.lastMessage = message;
		this.lastTitle = title;
		this.history = history;
		if (!this.view) {
			return;
		}
		this.view.title = title;
		this.view.webview.html = buildWebviewHtml(message, history);
	}
}

function addToHistory(entry: TrailerEntry): void {
	trailerHistory.unshift(entry);
	if (trailerHistory.length > MAX_HISTORY) {
		trailerHistory.length = MAX_HISTORY;
	}
}

function buildHistoryItem(entry: TrailerEntry, index: number): string {
	const lines = entry.message
		.split('\n')
		.map((line) => `<div class="history-line">${escapeHtml(line)}</div>`)
		.join('');
	const timeLabel = new Date(entry.timestamp).toLocaleTimeString();
	return `
<div class="history-item" style="--delay:${Math.min(index * 0.05, 0.3)}s">
	<div class="history-meta">${escapeHtml(timeLabel)}</div>
	${lines}
</div>`;
}
