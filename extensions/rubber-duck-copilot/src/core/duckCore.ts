import { Rng } from './random';

export type DuckPromptResultKind = 'prompt' | 'cooldown' | 'muted' | 'cap' | 'empty';

export type DuckPromptResult = {
	kind: DuckPromptResultKind;
	prompt: string | null;
};

export type DuckState = {
	lastPromptIndex: number | null;
	lastPrompt: string | null;
	lastPromptAt: number | null;
	promptsShown: number;
	mutedUntil: number | null;
};

export type DuckCoreConfig = {
	cooldownMs: number;
	maxPromptsPerSession: number;
};

export type DuckPromptRequest = {
	nowMs: number;
	config: DuckCoreConfig;
	userInitiated: boolean;
};

export class DuckCore {
	private readonly prompts: readonly string[];
	private readonly rng: Rng;
	private state: DuckState;

	public constructor(prompts: readonly string[], rng: Rng = Math.random) {
		this.prompts = prompts;
		this.rng = rng;
		this.state = {
			lastPromptIndex: null,
			lastPrompt: null,
			lastPromptAt: null,
			promptsShown: 0,
			mutedUntil: null,
		};
	}

	public getState(): DuckState {
		return { ...this.state };
	}

	public resetSessionCount(): void {
		this.state = {
			...this.state,
			promptsShown: 0,
		};
	}

	public muteFor(durationMs: number, nowMs: number): void {
		const until = nowMs + Math.max(0, durationMs);
		this.state = {
			...this.state,
			mutedUntil: until,
		};
	}

	public clearMute(): void {
		this.state = {
			...this.state,
			mutedUntil: null,
		};
	}

	public requestPrompt(request: DuckPromptRequest): DuckPromptResult {
		if (this.prompts.length === 0) {
			return { kind: 'empty', prompt: null };
		}

		if (this.state.mutedUntil !== null) {
			if (request.nowMs < this.state.mutedUntil) {
				return { kind: 'muted', prompt: null };
			}
			this.clearMute();
		}

		if (this.state.promptsShown >= request.config.maxPromptsPerSession) {
			return { kind: 'cap', prompt: null };
		}

		if (!request.userInitiated && this.state.lastPromptAt !== null) {
			const elapsed = request.nowMs - this.state.lastPromptAt;
			if (elapsed < request.config.cooldownMs) {
				return { kind: 'cooldown', prompt: null };
			}
		}

		const { prompt, index } = this.pickPrompt();
		this.state = {
			...this.state,
			lastPromptIndex: index,
			lastPrompt: prompt,
			lastPromptAt: request.nowMs,
			promptsShown: this.state.promptsShown + 1,
		};

		return { kind: 'prompt', prompt };
	}

	private pickPrompt(): { prompt: string; index: number } {
		const count = this.prompts.length;
		let index = Math.floor(this.rng() * count);
		if (count > 1 && index === this.state.lastPromptIndex) {
			index = (index + 1) % count;
		}
		return { prompt: this.prompts[index], index };
	}
}
