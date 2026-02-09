import * as vscode from 'vscode';

import { DuckCore } from './core/duckCore';
import { getDuckPrompts } from './core/prompts';
import { DEFAULTS, getConfig } from './extension/config';
import { DuckViewProvider } from './extension/duckView';
import { DuckPanelAction, DuckPanelState } from './extension/types';

function getActiveErrorCount(editor: vscode.TextEditor | undefined): number {
	if (!editor) {
		return 0;
	}
	const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
	return diagnostics.reduce((count, diagnostic) => {
		return count + (diagnostic.severity === vscode.DiagnosticSeverity.Error ? 1 : 0);
	}, 0);
}

function buildPanelState(
	core: DuckCore,
	config: ReturnType<typeof getConfig>,
	latestPrompt: string,
): DuckPanelState {
	const state = core.getState();
	return {
		prompt: latestPrompt,
		enabled: config.enabled,
		mutedUntil: state.mutedUntil,
		promptsShown: state.promptsShown,
		maxPrompts: config.maxPromptsPerSession,
	};
}

export function activate(context: vscode.ExtensionContext): void {
	const core = new DuckCore(getDuckPrompts(vscode.env.language));
	let latestPrompt = core.getState().lastPrompt ?? '';

	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	statusBarItem.command = 'rubber-duck-copilot.openDuckPanel';
	statusBarItem.show();

	const duckView = new DuckViewProvider(context.extensionUri, (action) => {
		handlePanelAction(action);
	});
	const duckViewRegistration = vscode.window.registerWebviewViewProvider(
		DuckViewProvider.viewId,
		duckView,
	);

	const updateStatusBar = (config: ReturnType<typeof getConfig>): void => {
		statusBarItem.text = config.enabled
			? `🦆 ${vscode.l10n.t('Duck: ON')}`
			: `🦆 ${vscode.l10n.t('Duck: OFF')}`;
	};

	const updatePanel = (config: ReturnType<typeof getConfig>): void => {
		duckView.update(buildPanelState(core, config, latestPrompt));
	};

	const showPromptNotification = async (prompt: string): Promise<void> => {
		const openPanelLabel = vscode.l10n.t('Open Duck Panel');
		const action = await vscode.window.showInformationMessage(prompt, openPanelLabel);
		if (action === openPanelLabel) {
			await duckView.reveal();
		}
	};

	const tryPrompt = async (userInitiated: boolean): Promise<void> => {
		const config = getConfig();
		if (!config.enabled) {
			updateStatusBar(config);
			updatePanel(config);
			return;
		}

		const result = core.requestPrompt({
			nowMs: Date.now(),
			config: {
				cooldownMs: config.cooldownSeconds * 1000,
				maxPromptsPerSession: config.maxPromptsPerSession,
			},
			userInitiated,
		});

		if (result.kind === 'prompt' && result.prompt) {
			latestPrompt = result.prompt;
			void showPromptNotification(result.prompt);
		} else if (userInitiated && result.kind === 'muted') {
			void vscode.window.showInformationMessage(vscode.l10n.t('Duck is muted for now.'));
		} else if (userInitiated && result.kind === 'cap') {
			void vscode.window.showInformationMessage(vscode.l10n.t('Duck session limit reached.'));
		}

		updateStatusBar(config);
		updatePanel(config);
	};

	const handlePanelAction = (action: DuckPanelAction): void => {
		const config = getConfig();
		switch (action) {
			case 'newPrompt':
				void tryPrompt(true);
				return;
			case 'copyPrompt':
				if (latestPrompt) {
					void vscode.env.clipboard.writeText(latestPrompt);
				}
				return;
			case 'mute':
				core.muteFor(config.muteMinutesDefault * 60 * 1000, Date.now());
				updatePanel(config);
				return;
		}
	};

	const toggleEnabled = vscode.commands.registerCommand('rubber-duck-copilot.toggleEnabled', async () => {
		const config = vscode.workspace.getConfiguration('rubberDuckCopilot');
		const current = config.get<boolean>('enabled', DEFAULTS.enabled);
		await config.update('enabled', !current, vscode.ConfigurationTarget.Global);
		updateStatusBar(getConfig());
	});

	const newPromptCommand = vscode.commands.registerCommand('rubber-duck-copilot.newPrompt', () => {
		void tryPrompt(true);
	});

	const openPanel = vscode.commands.registerCommand('rubber-duck-copilot.openDuckPanel', () => {
		const config = getConfig();
		duckView.update(buildPanelState(core, config, latestPrompt));
		void duckView.reveal();
	});

	const muteCommand = vscode.commands.registerCommand('rubber-duck-copilot.mute', () => {
		const config = getConfig();
		core.muteFor(config.muteMinutesDefault * 60 * 1000, Date.now());
		updatePanel(config);
	});

	const resetSessionCommand = vscode.commands.registerCommand('rubber-duck-copilot.resetSessionCount', () => {
		core.resetSessionCount();
		updatePanel(getConfig());
	});

	const onSave = vscode.workspace.onDidSaveTextDocument((document) => {
		const config = getConfig();
		if (!config.enabled || !config.triggerOnSave) {
			return;
		}
		if (vscode.window.activeTextEditor?.document.uri.toString() !== document.uri.toString()) {
			return;
		}
		void tryPrompt(false);
	});

	const onDiagnostics = vscode.languages.onDidChangeDiagnostics((event) => {
		const config = getConfig();
		if (!config.enabled || !config.triggerOnErrors) {
			return;
		}
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}
		const activeUri = editor.document.uri.toString();
		if (!event.uris.some((uri) => uri.toString() === activeUri)) {
			return;
		}
		if (getActiveErrorCount(editor) > 0) {
			void tryPrompt(false);
		}
	});

	const onConfigChange = vscode.workspace.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration('rubberDuckCopilot')) {
			updateStatusBar(getConfig());
			updatePanel(getConfig());
		}
	});

	context.subscriptions.push(
		statusBarItem,
		duckViewRegistration,
		toggleEnabled,
		newPromptCommand,
		openPanel,
		muteCommand,
		resetSessionCommand,
		onSave,
		onDiagnostics,
		onConfigChange,
	);

	updateStatusBar(getConfig());
	updatePanel(getConfig());
}

export function deactivate(): void {
	// No cleanup required.
}
