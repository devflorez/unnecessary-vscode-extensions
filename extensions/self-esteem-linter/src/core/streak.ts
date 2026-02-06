export type StreakMessageKind = 'threshold1' | 'threshold2' | 'recovery';

export interface StreakState {
	streak: number;
	threshold1Fired: boolean;
	threshold2Fired: boolean;
	lastMessageAt: number | null;
	lastHadErrors: boolean;
	pendingRecovery: boolean;
}

export interface StreakUpdateInput {
	errorCount: number;
	nowMs: number;
	enabled: boolean;
	threshold1: number;
	threshold2: number;
	cooldownMs: number;
	celebrateOnRecovery: boolean;
}

export interface StreakUpdateResult {
	state: StreakState;
	message: StreakMessageKind | null;
}

export function createInitialState(): StreakState {
	return {
		streak: 0,
		threshold1Fired: false,
		threshold2Fired: false,
		lastMessageAt: null,
		lastHadErrors: false,
		pendingRecovery: false,
	};
}

export function resetStreak(state: StreakState): StreakState {
	return {
		...state,
		streak: 0,
		threshold1Fired: false,
		threshold2Fired: false,
		lastHadErrors: false,
		pendingRecovery: false,
	};
}

function canSendMessage(state: StreakState, nowMs: number, cooldownMs: number): boolean {
	if (cooldownMs <= 0) {
		return true;
	}
	if (state.lastMessageAt === null) {
		return true;
	}
	return nowMs - state.lastMessageAt >= cooldownMs;
}

export function updateStreak(
	state: StreakState,
	input: StreakUpdateInput,
): StreakUpdateResult {
	if (!input.enabled) {
		return { state, message: null };
	}

	const nowMs = input.nowMs;
	const cooldownMs = Math.max(0, input.cooldownMs);
	const canMessage = canSendMessage(state, nowMs, cooldownMs);
	const hasErrors = input.errorCount > 0;

	if (hasErrors) {
		const next: StreakState = {
			...state,
			streak: state.streak + 1,
			lastHadErrors: true,
			pendingRecovery: false,
		};

		let message: StreakMessageKind | null = null;
		if (canMessage) {
			if (next.streak >= input.threshold1 && !state.threshold1Fired) {
				message = 'threshold1';
				next.threshold1Fired = true;
				next.lastMessageAt = nowMs;
			} else if (next.streak >= input.threshold2 && !state.threshold2Fired) {
				message = 'threshold2';
				next.threshold2Fired = true;
				next.lastMessageAt = nowMs;
			}
		}

		return { state: next, message };
	}

	const next: StreakState = {
		...state,
		streak: 0,
		threshold1Fired: false,
		threshold2Fired: false,
		lastHadErrors: false,
		pendingRecovery: state.pendingRecovery,
	};

	if (!input.celebrateOnRecovery) {
		next.pendingRecovery = false;
	} else if (state.lastHadErrors && state.streak >= input.threshold1) {
		next.pendingRecovery = true;
	}

	let message: StreakMessageKind | null = null;
	if (next.pendingRecovery && canMessage) {
		message = 'recovery';
		next.pendingRecovery = false;
		next.lastMessageAt = nowMs;
	}

	return { state: next, message };
}
