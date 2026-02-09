import * as vscode from 'vscode';

import { DuckPanelAction, DuckPanelState } from './types';
import { escapeHtml, getNonce } from './utils';

export class DuckViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewId = 'rubberDuckCopilot.panel';
	private view: vscode.WebviewView | undefined;
	private state: DuckPanelState;

	public constructor(
		private readonly extensionUri: vscode.Uri,
		private readonly onAction: (action: DuckPanelAction) => void,
	) {
		this.state = {
			prompt: '',
			enabled: true,
			mutedUntil: null,
			promptsShown: 0,
			maxPrompts: 0,
		};
	}

	public resolveWebviewView(view: vscode.WebviewView): void {
		this.view = view;
		view.webview.options = {
			enableScripts: true,
		};
		view.webview.onDidReceiveMessage((message) => {
			const action = message?.type as DuckPanelAction | undefined;
			if (!action) {
				return;
			}
			this.onAction(action);
		});
		this.update(this.state);
	}

	public update(state: DuckPanelState): void {
		this.state = state;
		if (!this.view) {
			return;
		}
		this.view.webview.html = this.render(state, this.view.webview.cspSource);
	}

	public async reveal(): Promise<void> {
		await vscode.commands.executeCommand('workbench.view.extension.rubberDuckCopilot');
		await vscode.commands.executeCommand('rubberDuckCopilot.panel.focus');
		this.view?.show?.(true);
	}

	private render(state: DuckPanelState, cspSource: string): string {
		const nonce = getNonce();
		const title = vscode.l10n.t('Rubber Duck Copilot');
		const prompt = state.prompt.trim().length > 0 ? state.prompt : vscode.l10n.t('No prompt yet.');
		const mutedLabel = state.mutedUntil
			? vscode.l10n.t('Muted until {0}', new Date(state.mutedUntil).toLocaleTimeString())
			: vscode.l10n.t('Not muted');
		const sessionLabel = vscode.l10n.t('Session: {0}/{1}', state.promptsShown, state.maxPrompts);
		const statusLabel = state.enabled ? vscode.l10n.t('Duck: ON') : vscode.l10n.t('Duck: OFF');
		const newPromptLabel = vscode.l10n.t('New prompt');
		const copyPromptLabel = vscode.l10n.t('Copy prompt');
		const muteLabel = vscode.l10n.t('Mute 10 min');
		const lang = vscode.env.language;

		return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} data:; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
	<title>${escapeHtml(title)}</title>
	<style>
		:root { color-scheme: light dark; }
		body {
			margin: 0;
			padding: 16px;
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
			color: var(--vscode-foreground);
			background: var(--vscode-sideBar-background);
		}
		.card {
			padding: 14px;
			border-radius: 12px;
			background: var(--vscode-sideBarSectionHeader-background, rgba(0,0,0,0.05));
			border: 1px solid var(--vscode-sideBar-border);
		}
		.duck {
			display: flex;
			justify-content: center;
			margin-bottom: 10px;
		}
		.prompt {
			font-size: 14px;
			line-height: 1.5;
			margin: 8px 0 14px 0;
		}
		.meta {
			display: grid;
			gap: 6px;
			font-size: 11px;
			color: var(--vscode-descriptionForeground);
			margin-bottom: 12px;
		}
		.meta span {
			padding: 4px 8px;
			border-radius: 999px;
			background: var(--vscode-badge-background);
			color: var(--vscode-badge-foreground);
			width: fit-content;
		}
		.actions {
			display: grid;
			gap: 8px;
		}
		button {
			border: none;
			border-radius: 10px;
			padding: 8px 12px;
			font-size: 12px;
			cursor: pointer;
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
		}
		button.secondary {
			background: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
		}
	</style>
</head>
<body>
	<div class="card">
		<div class="duck">
			<svg width="110" height="110" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Duck">
				<defs>
					<linearGradient id="duckBody" x1="0" y1="0" x2="1" y2="1">
						<stop offset="0%" stop-color="#FFE47A" />
						<stop offset="100%" stop-color="#FFC107" />
					</linearGradient>
				</defs>
				<circle cx="60" cy="62" r="38" fill="url(#duckBody)" />
				<circle cx="40" cy="38" r="18" fill="#FFE082" />
				<circle cx="45" cy="36" r="4" fill="#2D2D2D" />
				<path d="M70 56c10 0 18 4 22 10-8 2-18 2-26 0 2-6 2-8 4-10z" fill="#FFB300" />
				<path d="M36 72c8 6 18 8 30 6" fill="none" stroke="#F6A000" stroke-width="4" stroke-linecap="round" />
			</svg>
		</div>
		<div class="prompt">${escapeHtml(prompt)}</div>
		<div class="meta">
			<span>${escapeHtml(statusLabel)}</span>
			<span>${escapeHtml(mutedLabel)}</span>
			<span>${escapeHtml(sessionLabel)}</span>
		</div>
		<div class="actions">
			<button data-action="newPrompt">${escapeHtml(newPromptLabel)}</button>
			<button class="secondary" data-action="copyPrompt">${escapeHtml(copyPromptLabel)}</button>
			<button class="secondary" data-action="mute">${escapeHtml(muteLabel)}</button>
		</div>
	</div>
	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		document.querySelectorAll('[data-action]').forEach((button) => {
			button.addEventListener('click', () => {
				const action = button.getAttribute('data-action');
				vscode.postMessage({ type: action });
			});
		});
	</script>
</body>
</html>`;
	}
}
