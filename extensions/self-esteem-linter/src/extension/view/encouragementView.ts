import * as vscode from 'vscode';

import { StreakMessageKind } from '../../core/streak';
import { ViewState } from '../types';
import { createNonce, escapeHtml } from '../utils';

export class EncouragementViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewId = 'selfEsteemLinter.mediaView';
	private view: vscode.WebviewView | undefined;
	private state: ViewState;

	public constructor(private readonly extensionUri: vscode.Uri, state: ViewState) {
		this.state = state;
	}

	public resolveWebviewView(view: vscode.WebviewView): void {
		this.view = view;
		view.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
		};
		this.updateView();
	}

	public update(state: ViewState): void {
		this.state = state;
		this.updateView();
	}

	public async reveal(): Promise<void> {
		await vscode.commands.executeCommand('workbench.view.extension.selfEsteemLinter');
		await vscode.commands.executeCommand('selfEsteemLinter.mediaView.focus');
		this.view?.show?.(true);
	}

	public playSound(): void {
		if (!this.view) {
			return;
		}
		void this.view.webview.postMessage({ type: 'playSound' });
	}

	private updateView(): void {
		if (!this.view) {
			return;
		}
		const { history, lastMessage, stats, currentFile, currentStreak } = this.state;
		const message = lastMessage?.message ?? vscode.l10n.t('No encouragement yet.');
		const subtitle = lastMessage
			? vscode.l10n.t('Encouragement')
			: vscode.l10n.t('Trigger some errors to see encouragement.');
		const fileMap: Record<StreakMessageKind, string> = {
			threshold1: 'threshold1.svg',
			threshold2: 'threshold2.svg',
			recovery: 'recovery.svg',
		};
		const fallbackKind: StreakMessageKind = lastMessage?.kind ?? 'threshold1';
		const imageUri = this.view.webview.asWebviewUri(
			vscode.Uri.joinPath(this.extensionUri, 'media', fileMap[fallbackKind]),
		);
		const title = vscode.l10n.t('Self Esteem Linter: Encouragement');
		const locale = vscode.env.language;
		const nonce = createNonce();

		const historyItems = history.map((entry) => {
			const time = new Date(entry.timestamp).toLocaleTimeString();
			const fileLabel = entry.fileName ? ` • ${entry.fileName}` : '';
			return `<li><strong>${escapeHtml(time)}</strong>${escapeHtml(fileLabel)}<br />${escapeHtml(
				entry.message,
			)}</li>`;
		});
		const historyHtml = historyItems.length > 0
			? `<ul>${historyItems.join('')}</ul>`
			: `<p class="muted">${escapeHtml(vscode.l10n.t('No history yet.'))}</p>`;

		const fileLabel = currentFile ?? vscode.l10n.t('No active editor');
		const statsHtml = `
			<div class="stats">
				<div><span>${escapeHtml(vscode.l10n.t('Current file'))}</span><strong>${escapeHtml(
					fileLabel,
				)}</strong></div>
				<div><span>${escapeHtml(vscode.l10n.t('Current streak'))}</span><strong>${currentStreak}</strong></div>
				<div><span>${escapeHtml(vscode.l10n.t('Best streak'))}</span><strong>${stats.bestStreak}</strong></div>
				<div><span>${escapeHtml(vscode.l10n.t('Recoveries'))}</span><strong>${stats.totalRecoveries}</strong></div>
				<div><span>${escapeHtml(vscode.l10n.t('Total messages'))}</span><strong>${stats.totalMessages}</strong></div>
			</div>
		`;

		this.view.webview.html = `<!DOCTYPE html>
<html lang="${locale}">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${this.view.webview.cspSource} data:; style-src ${this.view.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
	<title>${title}</title>
	<style>
		body {
			margin: 0;
			padding: 16px;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
			color: var(--vscode-foreground);
			background: var(--vscode-sideBar-background);
		}
		.card {
			padding: 14px;
			border-radius: 12px;
			background: var(--vscode-sideBarSectionHeader-background, rgba(0,0,0,0.05));
			border: 1px solid var(--vscode-sideBar-border);
			margin-bottom: 12px;
		}
		.card h1 {
			font-size: 14px;
			margin: 0 0 8px 0;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			color: var(--vscode-descriptionForeground);
		}
		.card p {
			font-size: 13px;
			margin: 0 0 12px 0;
			line-height: 1.4;
		}
		.card img {
			width: 100%;
			height: auto;
			border-radius: 10px;
			border: 1px solid var(--vscode-panel-border);
			background: #ffffff;
		}
		.stats {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 8px;
		}
		.stats div {
			display: flex;
			flex-direction: column;
			gap: 2px;
			padding: 8px;
			background: var(--vscode-editorWidget-background);
			border-radius: 10px;
			border: 1px solid var(--vscode-editorWidget-border);
		}
		.stats span {
			font-size: 11px;
			color: var(--vscode-descriptionForeground);
		}
		.stats strong {
			font-size: 13px;
		}
		section h2 {
			font-size: 13px;
			margin: 16px 0 8px 0;
		}
		ul {
			list-style: none;
			padding: 0;
			margin: 0;
			display: grid;
			gap: 8px;
		}
		li {
			padding: 8px;
			border-radius: 10px;
			background: var(--vscode-editorWidget-background);
			border: 1px solid var(--vscode-editorWidget-border);
			font-size: 12px;
			line-height: 1.4;
		}
		.muted {
			color: var(--vscode-descriptionForeground);
			font-size: 12px;
		}
	</style>
</head>
<body>
	<div class="card">
		<h1>${escapeHtml(subtitle)}</h1>
		<p>${escapeHtml(message)}</p>
		<img src="${imageUri}" alt="${escapeHtml(subtitle)}" />
	</div>
	${statsHtml}
	<section>
		<h2>${escapeHtml(vscode.l10n.t('History'))}</h2>
		${historyHtml}
	</section>
	<script nonce="${nonce}">
		const playSound = () => {
			const AudioContext = window.AudioContext || window.webkitAudioContext;
			if (!AudioContext) {
				return;
			}
			const ctx = new AudioContext();
			const oscillator = ctx.createOscillator();
			const gain = ctx.createGain();
			oscillator.type = 'sine';
			oscillator.frequency.value = 440;
			gain.gain.value = 0.04;
			oscillator.connect(gain);
			gain.connect(ctx.destination);
			oscillator.start();
			oscillator.stop(ctx.currentTime + 0.12);
			oscillator.onended = () => ctx.close();
		};
		window.addEventListener('message', (event) => {
			if (event.data && event.data.type === 'playSound') {
				playSound();
			}
		});
	</script>
</body>
</html>`;
	}
}
