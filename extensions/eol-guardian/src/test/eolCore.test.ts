import * as assert from 'node:assert';

import {
	convertTextEol,
	decideAction,
	mapEolEnum,
	resolveExpectedEol,
} from '../core/eolCore';

suite('EOL Core', () => {
	test('maps EOL enum correctly', () => {
		assert.strictEqual(mapEolEnum(1), 'lf');
		assert.strictEqual(mapEolEnum(2), 'crlf');
	});

	test('converts to LF', () => {
		const input = 'a\r\nb\r\n';
		const output = convertTextEol(input, 'lf');
		assert.strictEqual(output, 'a\nb\n');
	});

	test('converts to CRLF', () => {
		const input = 'a\nb\n';
		const output = convertTextEol(input, 'crlf');
		assert.strictEqual(output, 'a\r\nb\r\n');
	});

	test('resolves expected EOL with editorconfig priority', () => {
		const resolved = resolveExpectedEol('lf', 'crlf', true);
		assert.strictEqual(resolved.expected, 'crlf');
		assert.strictEqual(resolved.source, 'editorconfig');
	});

	test('resolves expected EOL to auto', () => {
		const resolved = resolveExpectedEol('auto', null, true);
		assert.strictEqual(resolved.expected, 'auto');
		assert.strictEqual(resolved.source, 'auto');
	});

	test('decides to warn when mismatch and detectOnly', () => {
		const decision = decideAction({
			currentEol: 'lf',
			expected: 'crlf',
			mode: 'detectOnly',
			cooldownSeconds: 60,
			nowMs: 1000,
			lastNotifiedAt: null,
			ignored: false,
		});
		assert.strictEqual(decision.action, 'warn');
	});

	test('suppresses warn during cooldown', () => {
		const decision = decideAction({
			currentEol: 'lf',
			expected: 'crlf',
			mode: 'detectOnly',
			cooldownSeconds: 60,
			nowMs: 1000,
			lastNotifiedAt: 900,
			ignored: false,
		});
		assert.strictEqual(decision.action, 'none');
	});

	test('suppresses warn when ignored', () => {
		const decision = decideAction({
			currentEol: 'lf',
			expected: 'crlf',
			mode: 'detectOnly',
			cooldownSeconds: 60,
			nowMs: 1000,
			lastNotifiedAt: null,
			ignored: true,
		});
		assert.strictEqual(decision.action, 'none');
	});
});
