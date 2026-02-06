import * as path from 'node:path';
import * as vscode from 'vscode';

export function getActiveErrorCount(editor: vscode.TextEditor | undefined): number {
	if (!editor) {
		return 0;
	}
	const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
	return diagnostics.reduce((count, diagnostic) => {
		return count + (diagnostic.severity === vscode.DiagnosticSeverity.Error ? 1 : 0);
	}, 0);
}

export function formatLastMessageAt(timestamp: number | null): string {
	if (timestamp === null) {
		return vscode.l10n.t('never');
	}
	return new Date(timestamp).toLocaleString();
}

export function getFileLabel(editor: vscode.TextEditor | undefined): string | null {
	if (!editor) {
		return null;
	}
	return path.basename(editor.document.fileName);
}

export function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

export function createNonce(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let nonce = '';
	for (let i = 0; i < 16; i += 1) {
		nonce += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return nonce;
}
