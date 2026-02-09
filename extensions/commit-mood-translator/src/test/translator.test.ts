import * as assert from 'node:assert';

import {
	applyTemplate,
	DEFAULT_MOODS_EN,
	normalizeMessage,
	resolveMoods,
	translateCommitMessage,
} from '../core/translator';

suite('Commit Mood Translator', () => {
	test('normalizes messages', () => {
		assert.strictEqual(normalizeMessage('  fix   login  '), 'Fix login');
	});

	test('applies templates with placeholder', () => {
		assert.strictEqual(applyTemplate('[Mood] {message}', 'Test'), '[Mood] Test');
	});

	test('translates with default mood', () => {
		const mood = DEFAULT_MOODS_EN.find((entry) => entry.id === 'panic');
		assert.ok(mood);
		const result = translateCommitMessage('fix auth', mood);
		assert.ok(result.startsWith('[Panic]'));
		assert.ok(result.includes('Fix auth'));
		assert.ok(result.includes('😬'));
	});

	test('falls back to default moods when custom is empty', () => {
		const moods = resolveMoods([]);
		assert.strictEqual(moods.length, DEFAULT_MOODS_EN.length);
	});

	test('accepts custom moods', () => {
		const moods = resolveMoods([
			{ label: 'Chill', template: '[Chill] {message}' },
		]);
		assert.strictEqual(moods.length, 1);
		assert.strictEqual(moods[0].label, 'Chill');
	});
});
