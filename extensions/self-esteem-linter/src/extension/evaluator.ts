import * as vscode from 'vscode';

import { createInitialState, resetStreak, updateStreak, StreakState } from '../core/streak';
import { getConfig } from './config';
import { HISTORY_LIMIT, STATS_KEY } from './constants';
import { buildMessage } from './messages';
import { HistoryEntry, Stats } from './types';
import { getActiveErrorCount, getFileLabel } from './utils';
import { EncouragementViewProvider } from './view/encouragementView';

export type EvaluatorRuntime = {
	lastEnabled: boolean;
	lastMessageAt: number | null;
};

type EvaluatorDeps = {
	context: vscode.ExtensionContext;
	fileStates: Map<string, StreakState>;
	history: HistoryEntry[];
	stats: Stats;
	mediaProvider: EncouragementViewProvider;
	updateStatusBar: (config: ReturnType<typeof getConfig>, state: StreakState) => void;
	updateViewState: (currentStreak: number, currentFile: string | null, lastMessage: HistoryEntry | null) => void;
	showMessage: (kind: HistoryEntry['kind'], message: string, config: ReturnType<typeof getConfig>) => Promise<void>;
	runtime: EvaluatorRuntime;
};

type EditorContext = {
	editor: vscode.TextEditor | undefined;
	fileKey: string | undefined;
	fileName: string | null;
	state: StreakState;
	streak: number;
};

function resetAllStreaks(fileStates: Map<string, StreakState>): void {
	for (const [key, value] of fileStates.entries()) {
		fileStates.set(key, resetStreak(value));
	}
}

function syncEnabledState(
	config: ReturnType<typeof getConfig>,
	runtime: EvaluatorRuntime,
	fileStates: Map<string, StreakState>,
): void {
	if (config.enabled === runtime.lastEnabled) {
		return;
	}
	if (config.enabled && !runtime.lastEnabled) {
		resetAllStreaks(fileStates);
	}
	runtime.lastEnabled = config.enabled;
}

function getEditorContext(fileStates: Map<string, StreakState>): EditorContext {
	const editor = vscode.window.activeTextEditor;
	const fileKey = editor?.document.uri.toString();
	const fileName = getFileLabel(editor);
	const state = fileKey ? (fileStates.get(fileKey) ?? createInitialState()) : createInitialState();
	return {
		editor,
		fileKey,
		fileName,
		state,
		streak: state.streak,
	};
}

function effectiveCooldownSeconds(config: ReturnType<typeof getConfig>): number {
	return config.focusModeEnabled
		? Math.max(config.cooldownSeconds, config.focusIntervalMinutes * 60)
		: config.cooldownSeconds;
}

function updateBestStreak(stats: Stats, streak: number): boolean {
	if (streak <= stats.bestStreak) {
		return false;
	}
	stats.bestStreak = streak;
	return true;
}

type RecordMessageInput = {
	kind: HistoryEntry['kind'];
	resultStreak: number;
	previousStreak: number;
	fileName: string | null;
	config: ReturnType<typeof getConfig>;
	history: HistoryEntry[];
	stats: Stats;
	runtime: EvaluatorRuntime;
	mediaProvider: EncouragementViewProvider;
};

function recordMessage(input: RecordMessageInput): { entry: HistoryEntry; statsChanged: boolean } {
	const displayStreak = input.kind === 'recovery' ? input.previousStreak : input.resultStreak;
	const message = buildMessage(input.kind, displayStreak, input.fileName, input.config.messages);
	input.runtime.lastMessageAt = Date.now();
	const entry: HistoryEntry = {
		kind: input.kind,
		message,
		streak: displayStreak,
		fileName: input.fileName,
		timestamp: input.runtime.lastMessageAt,
	};
	input.history.unshift(entry);
	input.history.splice(HISTORY_LIMIT);

	input.stats.totalMessages += 1;
	let statsChanged = true;
	if (input.kind === 'recovery') {
		input.stats.totalRecoveries += 1;
		if (input.config.soundOnRecovery) {
			input.mediaProvider.playSound();
		}
	}
	return { entry, statsChanged };
}

export function createEvaluator(deps: EvaluatorDeps): () => void {
	return () => {
		const config = getConfig();
		syncEnabledState(config, deps.runtime, deps.fileStates);

		const context = getEditorContext(deps.fileStates);
		if (!config.enabled) {
			deps.updateStatusBar(config, context.state);
			deps.updateViewState(context.streak, context.fileName, deps.history[0] ?? null);
			return;
		}

		if (!context.fileKey || !context.editor) {
			deps.updateStatusBar(config, context.state);
			deps.updateViewState(0, null, deps.history[0] ?? null);
			return;
		}

		const result = updateStreak(context.state, {
			errorCount: getActiveErrorCount(context.editor),
			nowMs: Date.now(),
			enabled: config.enabled,
			threshold1: config.threshold1,
			threshold2: config.threshold2,
			cooldownMs: effectiveCooldownSeconds(config) * 1000,
			celebrateOnRecovery: config.celebrateOnRecovery,
		});

		deps.fileStates.set(context.fileKey, result.state);
		let statsChanged = updateBestStreak(deps.stats, result.state.streak);

		let lastEntry: HistoryEntry | null = deps.history[0] ?? null;
		if (result.message) {
			const recorded = recordMessage({
				kind: result.message,
				resultStreak: result.state.streak,
				previousStreak: context.streak,
				fileName: context.fileName,
				config,
				history: deps.history,
				stats: deps.stats,
				runtime: deps.runtime,
				mediaProvider: deps.mediaProvider,
			});
			lastEntry = recorded.entry;
			statsChanged = statsChanged || recorded.statsChanged;
			void deps.showMessage(result.message, recorded.entry.message, config);
		}

		if (statsChanged) {
			void deps.context.globalState.update(STATS_KEY, deps.stats);
		}

		deps.updateStatusBar(config, result.state);
		deps.updateViewState(result.state.streak, context.fileName, lastEntry);
	};
}
