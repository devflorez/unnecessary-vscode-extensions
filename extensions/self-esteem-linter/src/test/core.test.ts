import * as assert from 'node:assert';

import { createInitialState, updateStreak } from '../core/streak';

suite('Self Esteem Linter core', () => {
	test('increments streak on errors and resets on clean', () => {
		let state = createInitialState();
		let result = updateStreak(state, {
			errorCount: 1,
			nowMs: 0,
			enabled: true,
			threshold1: 3,
			threshold2: 5,
			cooldownMs: 0,
			celebrateOnRecovery: true,
		});
		state = result.state;
		assert.strictEqual(state.streak, 1);

		result = updateStreak(state, {
			errorCount: 2,
			nowMs: 1000,
			enabled: true,
			threshold1: 3,
			threshold2: 5,
			cooldownMs: 0,
			celebrateOnRecovery: true,
		});
		state = result.state;
		assert.strictEqual(state.streak, 2);

		result = updateStreak(state, {
			errorCount: 0,
			nowMs: 2000,
			enabled: true,
			threshold1: 3,
			threshold2: 5,
			cooldownMs: 0,
			celebrateOnRecovery: true,
		});
		state = result.state;
		assert.strictEqual(state.streak, 0);
	});

	test('fires thresholds once per streak', () => {
		let state = createInitialState();
		let result = updateStreak(state, {
			errorCount: 1,
			nowMs: 0,
			enabled: true,
			threshold1: 2,
			threshold2: 4,
			cooldownMs: 0,
			celebrateOnRecovery: true,
		});
		state = result.state;
		assert.strictEqual(result.message, null);

		result = updateStreak(state, {
			errorCount: 1,
			nowMs: 1000,
			enabled: true,
			threshold1: 2,
			threshold2: 4,
			cooldownMs: 0,
			celebrateOnRecovery: true,
		});
		state = result.state;
		assert.strictEqual(result.message, 'threshold1');

		result = updateStreak(state, {
			errorCount: 1,
			nowMs: 2000,
			enabled: true,
			threshold1: 2,
			threshold2: 4,
			cooldownMs: 0,
			celebrateOnRecovery: true,
		});
		state = result.state;
		assert.strictEqual(result.message, null);

		result = updateStreak(state, {
			errorCount: 1,
			nowMs: 3000,
			enabled: true,
			threshold1: 2,
			threshold2: 4,
			cooldownMs: 0,
			celebrateOnRecovery: true,
		});
		state = result.state;
		assert.strictEqual(result.message, 'threshold2');

		result = updateStreak(state, {
			errorCount: 1,
			nowMs: 4000,
			enabled: true,
			threshold1: 2,
			threshold2: 4,
			cooldownMs: 0,
			celebrateOnRecovery: true,
		});
		assert.strictEqual(result.message, null);
	});

	test('respects cooldown across messages', () => {
		let state = createInitialState();
		let result = updateStreak(state, {
			errorCount: 1,
			nowMs: 0,
			enabled: true,
			threshold1: 1,
			threshold2: 2,
			cooldownMs: 10000,
			celebrateOnRecovery: true,
		});
		state = result.state;
		assert.strictEqual(result.message, 'threshold1');

		result = updateStreak(state, {
			errorCount: 1,
			nowMs: 1000,
			enabled: true,
			threshold1: 1,
			threshold2: 2,
			cooldownMs: 10000,
			celebrateOnRecovery: true,
		});
		state = result.state;
		assert.strictEqual(result.message, null);

		result = updateStreak(state, {
			errorCount: 1,
			nowMs: 11000,
			enabled: true,
			threshold1: 1,
			threshold2: 2,
			cooldownMs: 10000,
			celebrateOnRecovery: true,
		});
		assert.strictEqual(result.message, 'threshold2');
	});

	test('celebrates recovery once after a qualifying streak', () => {
		let state = createInitialState();
		let result = updateStreak(state, {
			errorCount: 1,
			nowMs: 0,
			enabled: true,
			threshold1: 2,
			threshold2: 5,
			cooldownMs: 0,
			celebrateOnRecovery: true,
		});
		state = result.state;

		result = updateStreak(state, {
			errorCount: 1,
			nowMs: 1000,
			enabled: true,
			threshold1: 2,
			threshold2: 5,
			cooldownMs: 0,
			celebrateOnRecovery: true,
		});
		state = result.state;

		result = updateStreak(state, {
			errorCount: 0,
			nowMs: 2000,
			enabled: true,
			threshold1: 2,
			threshold2: 5,
			cooldownMs: 0,
			celebrateOnRecovery: true,
		});
		assert.strictEqual(result.message, 'recovery');
		assert.strictEqual(result.state.streak, 0);
	});

	test('recovery waits for cooldown when needed', () => {
		let state = createInitialState();
		let result = updateStreak(state, {
			errorCount: 1,
			nowMs: 0,
			enabled: true,
			threshold1: 1,
			threshold2: 5,
			cooldownMs: 10000,
			celebrateOnRecovery: true,
		});
		state = result.state;

		result = updateStreak(state, {
			errorCount: 0,
			nowMs: 1000,
			enabled: true,
			threshold1: 1,
			threshold2: 5,
			cooldownMs: 10000,
			celebrateOnRecovery: true,
		});
		state = result.state;
		assert.strictEqual(result.message, null);

		result = updateStreak(state, {
			errorCount: 0,
			nowMs: 11000,
			enabled: true,
			threshold1: 1,
			threshold2: 5,
			cooldownMs: 10000,
			celebrateOnRecovery: true,
		});
		assert.strictEqual(result.message, 'recovery');
	});
});
