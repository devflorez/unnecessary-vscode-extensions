import * as vscode from 'vscode';

import { StreakState } from '../core/streak';
import { ExtensionConfig, Stats } from './types';
import { formatLastMessageAt } from './utils';

export function statusTooltip(config: ExtensionConfig, state: StreakState, stats: Stats): string {
	const focusLine = config.focusModeEnabled
		? vscode.l10n.t('Focus mode: {0}m', config.focusIntervalMinutes)
		: vscode.l10n.t('Focus mode: off');
	return [
		vscode.l10n.t('Thresholds: {0} / {1}', config.threshold1, config.threshold2),
		vscode.l10n.t('Cooldown: {0}s', config.cooldownSeconds),
		focusLine,
		vscode.l10n.t('Best streak: {0}', stats.bestStreak),
		vscode.l10n.t('Recoveries: {0}', stats.totalRecoveries),
		vscode.l10n.t('Last message: {0}', formatLastMessageAt(state.lastMessageAt)),
	].join('\n');
}
