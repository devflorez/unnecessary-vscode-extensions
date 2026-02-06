import * as assert from 'node:assert';

import { buildMessage } from '../extension/messages';

suite('Message templates', () => {
	test('replaces {streak} and {file} tokens', () => {
		const templates = {
			threshold1: 'Hola {file}, llevas {streak}.',
			threshold2: 'Sigue {streak} en {file}.',
			recovery: 'Listo {file} con {streak}.',
		};

		const message = buildMessage('threshold1', 3, 'index.ts', templates);
		assert.strictEqual(message, 'Hola index.ts, llevas 3.');

		const message2 = buildMessage('threshold2', 5, 'main.ts', templates);
		assert.strictEqual(message2, 'Sigue 5 en main.ts.');

		const message3 = buildMessage('recovery', 2, 'app.ts', templates);
		assert.strictEqual(message3, 'Listo app.ts con 2.');
	});

	test('uses default messages when templates are empty', () => {
		const templates = {
			threshold1: '',
			threshold2: '',
			recovery: '',
		};

		const message = buildMessage('threshold1', 2, 'index.ts', templates);
		assert.match(message, /Self Esteem Linter:/);
		assert.match(message, /2/);
	});
});
