import * as assert from 'node:assert';

import { CINEMATIC_RULES, formatCinematicMessage, matchCinematicMessage } from '../core/translator';

suite('Cinematic Errors Translator', () => {
	test('matches null or undefined errors', () => {
		const message = matchCinematicMessage('Cannot read properties of undefined', 'en');
		assert.strictEqual(message.id, 'null-undefined');
	});

	test('matches type mismatch errors', () => {
		const message = matchCinematicMessage("Type 'string' is not assignable to type 'number'", 'en');
		assert.strictEqual(message.id, 'type-mismatch');
	});

	test('matches missing property errors', () => {
		const message = matchCinematicMessage("Property 'name' does not exist on type", 'en');
		assert.strictEqual(message.id, 'missing-property');
	});

	test('matches index out of bounds errors', () => {
		const message = matchCinematicMessage('Index out of range', 'en');
		assert.strictEqual(message.id, 'index-out-of-bounds');
	});

	test('matches module not found errors', () => {
		const message = matchCinematicMessage('Cannot find module \"react\"', 'en');
		assert.strictEqual(message.id, 'module-not-found');
	});

	test('matches syntax errors', () => {
		const message = matchCinematicMessage('SyntaxError: Unexpected token', 'en');
		assert.strictEqual(message.id, 'syntax-error');
	});

	test('matches network errors', () => {
		const message = matchCinematicMessage('connect ECONNREFUSED 127.0.0.1', 'en');
		assert.strictEqual(message.id, 'network-error');
	});

	test('falls back to generic message', () => {
		const message = matchCinematicMessage('Unexpected token', 'en');
		assert.strictEqual(message.id, 'fallback');
	});

	test('formats message as multiple lines', () => {
		const message = matchCinematicMessage('Type mismatch', 'en');
		const formatted = formatCinematicMessage(message);
		assert.ok(formatted.includes('\n'));
	});

	test('rules stay deterministic', () => {
		const input = 'Cannot read properties of null';
		const first = matchCinematicMessage(input, 'en');
		const second = matchCinematicMessage(input, 'en');
		assert.deepStrictEqual(first, second);
	});

	test('each rule variant has 2-4 lines', () => {
		for (const rule of CINEMATIC_RULES.en) {
			for (const variant of rule.variants) {
				assert.ok(variant.length >= 2 && variant.length <= 4);
			}
		}
		for (const rule of CINEMATIC_RULES.es) {
			for (const variant of rule.variants) {
				assert.ok(variant.length >= 2 && variant.length <= 4);
			}
		}
	});

	test('supports Spanish locale', () => {
		const message = matchCinematicMessage('Cannot read properties of null', 'es');
		assert.strictEqual(message.id, 'null-undefined');
		assert.ok(message.lines[0].startsWith('En un mundo'));
	});
});
