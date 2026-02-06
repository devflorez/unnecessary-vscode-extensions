import { StreakMessageKind } from '../core/streak';

export type MessageTemplates = {
	threshold1: string;
	threshold2: string;
	recovery: string;
};

export type ExtensionConfig = {
	enabled: boolean;
	threshold1: number;
	threshold2: number;
	cooldownSeconds: number;
	celebrateOnRecovery: boolean;
	showMedia: boolean;
	focusModeEnabled: boolean;
	focusIntervalMinutes: number;
	soundOnRecovery: boolean;
	messages: MessageTemplates;
};

export type HistoryEntry = {
	kind: StreakMessageKind;
	message: string;
	streak: number;
	fileName: string | null;
	timestamp: number;
};

export type Stats = {
	totalRecoveries: number;
	bestStreak: number;
	totalMessages: number;
};

export type ViewState = {
	lastMessage: HistoryEntry | null;
	history: HistoryEntry[];
	stats: Stats;
	currentStreak: number;
	currentFile: string | null;
};
