import * as vscode from 'vscode';

import { DuckConfig } from './types';

export const DEFAULTS: DuckConfig = {
	enabled: true,
	triggerOnSave: true,
	triggerOnErrors: true,
	cooldownSeconds: 30,
	maxPromptsPerSession: 5,
	muteMinutesDefault: 10,
};

export function getConfig(): DuckConfig {
	const config = vscode.workspace.getConfiguration('rubberDuckCopilot');
	const cooldownSeconds = Math.max(0, config.get<number>('cooldownSeconds', DEFAULTS.cooldownSeconds));
	const maxPrompts = Math.max(1, config.get<number>('maxPromptsPerSession', DEFAULTS.maxPromptsPerSession));
	const muteMinutes = Math.max(1, config.get<number>('muteMinutesDefault', DEFAULTS.muteMinutesDefault));

	return {
		enabled: config.get<boolean>('enabled', DEFAULTS.enabled),
		triggerOnSave: config.get<boolean>('triggerOnSave', DEFAULTS.triggerOnSave),
		triggerOnErrors: config.get<boolean>('triggerOnErrors', DEFAULTS.triggerOnErrors),
		cooldownSeconds,
		maxPromptsPerSession: maxPrompts,
		muteMinutesDefault: muteMinutes,
	};
}
