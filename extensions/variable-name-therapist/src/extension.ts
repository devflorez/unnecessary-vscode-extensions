import * as vscode from 'vscode';

import {
	AnalyzeOptions,
	analyzeSource,
	formatTherapyMessage,
} from './core/analyzer';

const COMMAND_TOGGLE = 'variable-name-therapist.toggleEnabled';
const COMMAND_ANALYZE = 'variable-name-therapist.analyzeNow';
const COMMAND_SUMMARY = 'variable-name-therapist.showSummary';

const STATUS_PREFIX = '🧠 Names';

type Config = {
	enabled: boolean;
	severity: 'warning' | 'info';
	debounceMs: number;
	allowSingleLetterInLoops: boolean;
	ignoredNames: string[];
	ignoredPrefixes: string[];
	allowedLanguages: string[];
	enableRegexFallback: boolean;
	locale: 'auto' | 'en' | 'es';
	useDefaultNameLists: boolean;
	genericNames: string[];
	genericPatterns: string[];
	keyboardMashNames: string[];
	versionedPatterns: string[];
};

let debounceTimer: NodeJS.Timeout | undefined;
let lastCount = 0;

export function activate(context: vscode.ExtensionContext): void {
	const diagnostics = vscode.languages.createDiagnosticCollection('variable-name-therapist');
	context.subscriptions.push(diagnostics);

	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	statusBar.command = COMMAND_SUMMARY;
	context.subscriptions.push(statusBar);

	const updateStatusBar = (count: number, enabled: boolean): void => {
		if (!enabled) {
			statusBar.text = `${STATUS_PREFIX}: OFF`;
			statusBar.show();
			return;
		}
		statusBar.text = count > 0 ? `${STATUS_PREFIX}: ${count} ⚠️` : `${STATUS_PREFIX}: ${count}`;
		statusBar.show();
	};

	const analyzeDocument = async (document: vscode.TextDocument): Promise<void> => {
		const config = getConfig();
		if (!config.enabled) {
			diagnostics.delete(document.uri);
			lastCount = 0;
			updateStatusBar(lastCount, config.enabled);
			return;
		}
		if (!shouldAnalyze(document, config)) {
			diagnostics.delete(document.uri);
			lastCount = 0;
			updateStatusBar(lastCount, config.enabled);
			return;
		}
		const findings = analyzeSource(document.getText(), document.languageId, toAnalyzeOptions(config));
		const severity = config.severity === 'info'
			? vscode.DiagnosticSeverity.Information
			: vscode.DiagnosticSeverity.Warning;
		const diags = findings.map((finding) => new vscode.Diagnostic(
			new vscode.Range(
				document.positionAt(finding.start),
				document.positionAt(finding.end),
			),
			formatTherapyMessage(
				finding.name,
				finding.reasonCode,
				resolveLocale(getConfig().locale),
			),
			severity,
		));
		diagnostics.set(document.uri, diags);
		lastCount = diags.length;
		updateStatusBar(lastCount, config.enabled);
	};

	const scheduleAnalysis = (document: vscode.TextDocument): void => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		const config = getConfig();
		debounceTimer = setTimeout(() => {
			void analyzeDocument(document);
		}, config.debounceMs);
	};

	const onActiveEditor = vscode.window.onDidChangeActiveTextEditor((editor) => {
		if (!editor) {
			return;
		}
		void analyzeDocument(editor.document);
	});

	const onChange = vscode.workspace.onDidChangeTextDocument((event) => {
		const editor = vscode.window.activeTextEditor;
		if (editor?.document.uri.toString() !== event.document.uri.toString()) {
			return;
		}
		scheduleAnalysis(event.document);
	});

	const onSave = vscode.workspace.onDidSaveTextDocument((document) => {
		const editor = vscode.window.activeTextEditor;
		if (editor?.document.uri.toString() !== document.uri.toString()) {
			return;
		}
		void analyzeDocument(document);
	});

	const onConfigChange = vscode.workspace.onDidChangeConfiguration((event) => {
		if (!event.affectsConfiguration('variableNameTherapist')) {
			return;
		}
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			void analyzeDocument(editor.document);
		}
	});

	const toggleCommand = vscode.commands.registerCommand(COMMAND_TOGGLE, async () => {
		const config = vscode.workspace.getConfiguration('variableNameTherapist');
		const current = config.get<boolean>('enabled', true);
		await config.update('enabled', !current, vscode.ConfigurationTarget.Global);
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			void analyzeDocument(editor.document);
		} else {
			updateStatusBar(0, !current);
		}
	});

	const analyzeCommand = vscode.commands.registerCommand(COMMAND_ANALYZE, async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}
		await analyzeDocument(editor.document);
	});

	const summaryCommand = vscode.commands.registerCommand(COMMAND_SUMMARY, async () => {
		const config = getConfig();
		if (!config.enabled) {
			await vscode.window.showInformationMessage('Variable Name Therapist is disabled.');
			return;
		}
		await vscode.window.showInformationMessage(getSummaryMessage(lastCount));
	});

	context.subscriptions.push(
		onActiveEditor,
		onChange,
		onSave,
		onConfigChange,
		toggleCommand,
		analyzeCommand,
		summaryCommand,
	);

	const activeEditor = vscode.window.activeTextEditor;
	if (activeEditor) {
		void analyzeDocument(activeEditor.document);
	} else {
		updateStatusBar(0, getConfig().enabled);
	}
}

export function deactivate(): void {
	if (debounceTimer) {
		clearTimeout(debounceTimer);
	}
}

function getConfig(): Config {
	const config = vscode.workspace.getConfiguration('variableNameTherapist');
	return {
		enabled: config.get<boolean>('enabled', true),
		severity: config.get<'warning' | 'info'>('severity', 'warning'),
		debounceMs: config.get<number>('debounceMs', 500),
		allowSingleLetterInLoops: config.get<boolean>('allowSingleLetterInLoops', true),
		ignoredNames: config.get<string[]>('ignoredNames', ['ok', 'id']),
		ignoredPrefixes: config.get<string[]>('ignoredPrefixes', ['_', '$']),
		allowedLanguages: config.get<string[]>('allowedLanguages', [
			'typescript',
			'typescriptreact',
			'javascript',
			'javascriptreact',
		]),
		enableRegexFallback: config.get<boolean>('enableRegexFallback', false),
		locale: config.get<'auto' | 'en' | 'es'>('locale', 'auto'),
		useDefaultNameLists: config.get<boolean>('useDefaultNameLists', true),
		genericNames: config.get<string[]>('genericNames', []),
		genericPatterns: config.get<string[]>('genericPatterns', []),
		keyboardMashNames: config.get<string[]>('keyboardMashNames', []),
		versionedPatterns: config.get<string[]>('versionedPatterns', []),
	};
}

function toAnalyzeOptions(config: Config): AnalyzeOptions {
	return {
		allowSingleLetterInLoops: config.allowSingleLetterInLoops,
		ignoredNames: config.ignoredNames,
		ignoredPrefixes: config.ignoredPrefixes,
		allowedLanguages: config.allowedLanguages,
		enableRegexFallback: config.enableRegexFallback,
		useDefaultNameLists: config.useDefaultNameLists,
		genericNames: config.genericNames,
		genericPatterns: config.genericPatterns,
		keyboardMashNames: config.keyboardMashNames,
		versionedPatterns: config.versionedPatterns,
	};
}

function shouldAnalyze(document: vscode.TextDocument, config: Config): boolean {
	if (!config.enabled) {
		return false;
	}
	return true;
}

function getSummaryMessage(count: number): string {
	const locale = resolveLocale(getConfig().locale);
	if (locale === 'es') {
		return `Se encontraron ${count} nombre(s) de variable.`;
	}
	return `Flagged ${count} variable name(s).`;
}

function resolveLocale(setting: 'auto' | 'en' | 'es'): 'en' | 'es' {
	if (setting !== 'auto') {
		return setting;
	}
	return vscode.env.language.toLowerCase().startsWith('es') ? 'es' : 'en';
}
