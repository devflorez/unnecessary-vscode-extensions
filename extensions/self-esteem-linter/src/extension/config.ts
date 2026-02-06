import * as vscode from 'vscode';

import { ExtensionConfig } from './types';

export const DEFAULTS: ExtensionConfig = {
	enabled: true,
	threshold1: 3,
	threshold2: 5,
	cooldownSeconds: 10,
	celebrateOnRecovery: true,
	showMedia: false,
	focusModeEnabled: false,
	focusIntervalMinutes: 5,
	soundOnRecovery: false,
	messages: {
		threshold1: '',
		threshold2: '',
		recovery: '',
	},
};

export function getConfig(): ExtensionConfig {
	const config = vscode.workspace.getConfiguration('selfEsteemLinter');
	const threshold1 = Math.max(1, Math.floor(config.get<number>('streakThreshold1', DEFAULTS.threshold1)));
	const threshold2Raw = Math.max(1, Math.floor(config.get<number>('streakThreshold2', DEFAULTS.threshold2)));
	const threshold2 = Math.max(threshold1, threshold2Raw);
	const cooldownSeconds = Math.max(
		0,
		Math.floor(config.get<number>('cooldownSeconds', DEFAULTS.cooldownSeconds)),
	);
	const focusIntervalMinutes = Math.max(
		1,
		Math.floor(config.get<number>('focusMode.intervalMinutes', DEFAULTS.focusIntervalMinutes)),
	);

	return {
		enabled: config.get<boolean>('enabled', DEFAULTS.enabled),
		threshold1,
		threshold2,
		cooldownSeconds,
		celebrateOnRecovery: config.get<boolean>('celebrateOnRecovery', DEFAULTS.celebrateOnRecovery),
		showMedia: config.get<boolean>('showMedia', DEFAULTS.showMedia),
		focusModeEnabled: config.get<boolean>('focusMode.enabled', DEFAULTS.focusModeEnabled),
		focusIntervalMinutes,
		soundOnRecovery: config.get<boolean>('soundOnRecovery', DEFAULTS.soundOnRecovery),
		messages: {
			threshold1: config.get<string>('messages.threshold1', DEFAULTS.messages.threshold1),
			threshold2: config.get<string>('messages.threshold2', DEFAULTS.messages.threshold2),
			recovery: config.get<string>('messages.recovery', DEFAULTS.messages.recovery),
		},
	};
}
