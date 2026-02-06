import * as vscode from 'vscode';

import { StreakMessageKind } from '../core/streak';
import { MessageTemplates } from './types';

function applyTemplate(template: string, replacements: Record<string, string>): string {
	let result = template;
	for (const [key, value] of Object.entries(replacements)) {
		result = result.replaceAll(`{${key}}`, value);
	}
	return result;
}

export function buildMessage(
	kind: StreakMessageKind,
	streak: number,
	fileName: string | null,
	templates: MessageTemplates,
): string {
	const rawTemplate = templates[kind].trim();
	if (rawTemplate.length > 0) {
		return applyTemplate(rawTemplate, {
			streak: `${streak}`,
			file: fileName ?? vscode.l10n.t('this file'),
		});
	}
	if (kind === 'threshold1') {
		return vscode.l10n.t('Self Esteem Linter: Rough patch. {0} checks in a row. Keep going.', streak);
	}
	if (kind === 'threshold2') {
		return vscode.l10n.t('Self Esteem Linter: Still in it. {0} checks. Breathe and continue.', streak);
	}
	return vscode.l10n.t('Self Esteem Linter: Errors cleared. Nice recovery.');
}
