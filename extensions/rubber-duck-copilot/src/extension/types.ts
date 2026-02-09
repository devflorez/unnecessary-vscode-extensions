export type DuckConfig = {
	enabled: boolean;
	triggerOnSave: boolean;
	triggerOnErrors: boolean;
	cooldownSeconds: number;
	maxPromptsPerSession: number;
	muteMinutesDefault: number;
};

export type DuckPanelState = {
	prompt: string;
	enabled: boolean;
	mutedUntil: number | null;
	promptsShown: number;
	maxPrompts: number;
};

export type DuckPanelAction = 'newPrompt' | 'copyPrompt' | 'mute';
