import * as assert from 'node:assert';

import { createNonce, escapeHtml } from '../extension/utils';

suite('Extension utils', () => {
	test('escapeHtml encodes special characters', () => {
		const value = `Tom & Jerry <script>"'`;
		const escaped = escapeHtml(value);
		assert.strictEqual(escaped, 'Tom &amp; Jerry &lt;script&gt;&quot;&#39;');
	});

	test('createNonce returns a 16-char alphanumeric string', () => {
		const nonce = createNonce();
		assert.strictEqual(nonce.length, 16);
		assert.match(nonce, /^[A-Za-z0-9]+$/);
	});
});
