import * as assert from 'node:assert';

import { DuckCore } from '../core/duckCore';
import { createSeededRng } from '../core/random';

suite('DuckCore', () => {
	test('respects cooldown for automatic prompts', () => {
		const core = new DuckCore(['A', 'B'], () => 0.1);
		const config = { cooldownMs: 1000, maxPromptsPerSession: 5 };

		const first = core.requestPrompt({ nowMs: 0, config, userInitiated: false });
		assert.strictEqual(first.kind, 'prompt');

		const second = core.requestPrompt({ nowMs: 500, config, userInitiated: false });
		assert.strictEqual(second.kind, 'cooldown');

		const third = core.requestPrompt({ nowMs: 1000, config, userInitiated: false });
		assert.strictEqual(third.kind, 'prompt');
	});

	test('never repeats the same prompt twice in a row', () => {
		const core = new DuckCore(['A', 'B'], () => 0);
		const config = { cooldownMs: 0, maxPromptsPerSession: 5 };

		const first = core.requestPrompt({ nowMs: 0, config, userInitiated: true });
		const second = core.requestPrompt({ nowMs: 1, config, userInitiated: true });

		assert.strictEqual(first.kind, 'prompt');
		assert.strictEqual(second.kind, 'prompt');
		assert.notStrictEqual(first.prompt, second.prompt);
	});

	test('enforces session cap', () => {
		const core = new DuckCore(['A', 'B', 'C'], () => 0.2);
		const config = { cooldownMs: 0, maxPromptsPerSession: 2 };

		const first = core.requestPrompt({ nowMs: 0, config, userInitiated: true });
		const second = core.requestPrompt({ nowMs: 1, config, userInitiated: true });
		const third = core.requestPrompt({ nowMs: 2, config, userInitiated: true });

		assert.strictEqual(first.kind, 'prompt');
		assert.strictEqual(second.kind, 'prompt');
		assert.strictEqual(third.kind, 'cap');
	});

	test('blocks prompts during mute window', () => {
		const core = new DuckCore(['A', 'B'], () => 0.1);
		const config = { cooldownMs: 0, maxPromptsPerSession: 5 };

		core.muteFor(10 * 60 * 1000, 0);

		const muted = core.requestPrompt({ nowMs: 0, config, userInitiated: true });
		assert.strictEqual(muted.kind, 'muted');

		const afterMute = core.requestPrompt({ nowMs: 10 * 60 * 1000, config, userInitiated: true });
		assert.strictEqual(afterMute.kind, 'prompt');
	});

	test('is deterministic with a seeded RNG', () => {
		const prompts = ['A', 'B', 'C', 'D'];
		const coreA = new DuckCore(prompts, createSeededRng(42));
		const coreB = new DuckCore(prompts, createSeededRng(42));
		const config = { cooldownMs: 0, maxPromptsPerSession: 10 };

		const seqA = [0, 1, 2].map((time) => {
			const result = coreA.requestPrompt({ nowMs: time, config, userInitiated: true });
			return result.prompt;
		});
		const seqB = [0, 1, 2].map((time) => {
			const result = coreB.requestPrompt({ nowMs: time, config, userInitiated: true });
			return result.prompt;
		});

		assert.deepStrictEqual(seqA, seqB);
	});
});
