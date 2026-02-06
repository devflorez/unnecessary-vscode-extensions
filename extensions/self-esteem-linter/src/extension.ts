import * as vscode from 'vscode';

import { createInitialState, resetStreak, StreakMessageKind, StreakState } from './core/streak';
import { DEFAULTS, getConfig } from './extension/config';
import { STATS_KEY } from './extension/constants';
import { createEvaluator, EvaluatorRuntime } from './extension/evaluator';
import { statusTooltip } from './extension/status';
import { EncouragementViewProvider } from './extension/view/encouragementView';
import { ExtensionConfig, HistoryEntry, Stats } from './extension/types';
import { formatLastMessageAt, getFileLabel } from './extension/utils';

export function activate(context: vscode.ExtensionContext): void {
	const fileStates = new Map<string, StreakState>();
	const history: HistoryEntry[] = [];
	const stats = context.globalState.get<Stats>(STATS_KEY, {
		totalRecoveries: 0,
		bestStreak: 0,
		totalMessages: 0,
	});
	const runtime: EvaluatorRuntime = {
		lastEnabled: getConfig().enabled,
		lastMessageAt: null,
	};

	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	statusBarItem.command = 'self-esteem-linter.showStatus';
	statusBarItem.show();

	const mediaProvider = new EncouragementViewProvider(context.extensionUri, {
		lastMessage: null,
		history,
		stats,
		currentStreak: 0,
		currentFile: null,
	});
	const mediaRegistration = vscode.window.registerWebviewViewProvider(
		EncouragementViewProvider.viewId,
		mediaProvider,
	);

	const updateStatusBar = (config: ExtensionConfig, state: StreakState): void => {
		statusBarItem.text = config.enabled
			? vscode.l10n.t('SEL: {0}', state.streak)
			: vscode.l10n.t('SEL: OFF');
		statusBarItem.tooltip = statusTooltip(config, state, stats);
	};

	const updateViewState = (
		currentStreak: number,
		currentFile: string | null,
		lastMessage: HistoryEntry | null,
	): void => {
		mediaProvider.update({
			lastMessage,
			history,
			stats,
			currentStreak,
			currentFile,
		});
	};

	const showMessage = async (
		kind: StreakMessageKind,
		message: string,
		config: ExtensionConfig,
	): Promise<void> => {
		const mediaLabel = config.showMedia ? vscode.l10n.t('View image') : '';
		if (kind === 'threshold1') {
			const choice = config.showMedia
				? await vscode.window.showWarningMessage(message, mediaLabel)
				: await vscode.window.showWarningMessage(message);
			if (choice === mediaLabel) {
				await mediaProvider.reveal();
			}
			return;
		}
		const choice = config.showMedia
			? await vscode.window.showInformationMessage(message, mediaLabel)
			: await vscode.window.showInformationMessage(message);
		if (choice === mediaLabel) {
			await mediaProvider.reveal();
		}
	};

	const evaluate = createEvaluator({
		context,
		fileStates,
		history,
		stats,
		mediaProvider,
		updateStatusBar,
		updateViewState,
		showMessage,
		runtime,
	});

	const toggleEnabled = vscode.commands.registerCommand('self-esteem-linter.toggleEnabled', async () => {
		const config = vscode.workspace.getConfiguration('selfEsteemLinter');
		const current = config.get<boolean>('enabled', DEFAULTS.enabled);
		await config.update('enabled', !current, vscode.ConfigurationTarget.Global);
	});

	const resetStreakCommand = vscode.commands.registerCommand('self-esteem-linter.resetStreak', () => {
		for (const [key, value] of fileStates.entries()) {
			fileStates.set(key, resetStreak(value));
		}
		updateStatusBar(getConfig(), createInitialState());
		updateViewState(0, getFileLabel(vscode.window.activeTextEditor), history[0] ?? null);
	});

	const showStatus = vscode.commands.registerCommand('self-esteem-linter.showStatus', () => {
		const config = getConfig();
		const editor = vscode.window.activeTextEditor;
		const fileKey = editor?.document.uri.toString();
		const state = fileKey ? (fileStates.get(fileKey) ?? createInitialState()) : createInitialState();
		const status = config.enabled
			? vscode.l10n.t('enabled, streak {0}', state.streak)
			: vscode.l10n.t('disabled');
		const lastMessage = formatLastMessageAt(runtime.lastMessageAt ?? state.lastMessageAt);
		const fileLabel = getFileLabel(editor) ?? vscode.l10n.t('No active editor');
		vscode.window.showInformationMessage(
			vscode.l10n.t(
				'Self Esteem Linter is {0}. File {1}. Thresholds {2}/{3}. Best streak {4}. Recoveries {5}. Last message: {6}.',
				status,
				fileLabel,
				config.threshold1,
				config.threshold2,
				stats.bestStreak,
				stats.totalRecoveries,
				lastMessage,
			),
		);
	});

	const onActiveEditorChange = vscode.window.onDidChangeActiveTextEditor(() => {
		evaluate();
	});

	const onDiagnosticsChange = vscode.languages.onDidChangeDiagnostics((event) => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}
		const activeUri = editor.document.uri.toString();
		if (event.uris.some((uri) => uri.toString() === activeUri)) {
			evaluate();
		}
	});

	const onConfigChange = vscode.workspace.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration('selfEsteemLinter')) {
			evaluate();
		}
	});

	context.subscriptions.push(
		statusBarItem,
		mediaRegistration,
		toggleEnabled,
		resetStreakCommand,
		showStatus,
		onActiveEditorChange,
		onDiagnosticsChange,
		onConfigChange,
	);

	evaluate();
}

export function deactivate(): void {
	// No cleanup required.
}
