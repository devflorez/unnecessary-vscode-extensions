import * as assert from 'node:assert';

import { analyzeSource, formatTherapyMessage } from '../core/analyzer';

const baseOptions = {
	allowSingleLetterInLoops: true,
	ignoredNames: ['ok', 'id'],
	ignoredPrefixes: ['_', '$'],
	allowedLanguages: ['typescript', 'typescriptreact', 'javascript', 'javascriptreact'],
	enableRegexFallback: false,
	useDefaultNameLists: true,
	genericNames: [],
	genericPatterns: [],
	keyboardMashNames: [],
	versionedPatterns: [],
};

suite('Variable Name Therapist', () => {
	test('flags generic names', () => {
		const code = 'const data = 1;';
		const findings = analyzeSource(code, 'typescript', baseOptions);
		assert.ok(findings.some((f) => f.name === 'data'));
	});

	test('does not flag loop index i when allowed', () => {
		const code = 'for (let i = 0; i < 3; i++) { console.log(i); }';
		const findings = analyzeSource(code, 'typescript', baseOptions);
		assert.ok(!findings.some((f) => f.name === 'i'));
	});

	test('flags final2 and v2 patterns', () => {
		const code = 'const final2 = 1; const v3 = 2;';
		const findings = analyzeSource(code, 'typescript', baseOptions);
		assert.ok(findings.some((f) => f.name === 'final2'));
		assert.ok(findings.some((f) => f.name === 'v3'));
	});

	test('respects ignored names', () => {
		const code = 'const ok = true; const id = 1;';
		const findings = analyzeSource(code, 'typescript', baseOptions);
		assert.strictEqual(findings.length, 0);
	});

	test('respects ignored prefixes', () => {
		const code = 'const _cache = 1; const $tmp = 2;';
		const findings = analyzeSource(code, 'typescript', baseOptions);
		assert.strictEqual(findings.length, 0);
	});

	test('skips languages not in allow list', () => {
		const code = 'data = 1';
		const findings = analyzeSource(code, 'python', {
			...baseOptions,
			allowedLanguages: ['typescript'],
			enableRegexFallback: true,
		});
		assert.strictEqual(findings.length, 0);
	});

	test('can analyze python with regex fallback', () => {
		const code = 'data = 1\nfoo = 2';
		const findings = analyzeSource(code, 'python', {
			...baseOptions,
			allowedLanguages: ['python'],
			enableRegexFallback: true,
		});
		assert.ok(findings.some((f) => f.name === 'data'));
	});

	test('can analyze go with regex fallback', () => {
		const code = 'var data = 1\nthing := 2';
		const findings = analyzeSource(code, 'go', {
			...baseOptions,
			allowedLanguages: ['go'],
			enableRegexFallback: true,
		});
		assert.ok(findings.some((f) => f.name === 'data'));
	});

	test('flags composite generic names', () => {
		const code = 'const dataInfoMapList = 1;';
		const findings = analyzeSource(code, 'typescript', baseOptions);
		assert.ok(findings.some((f) => f.name === 'dataInfoMapList'));
	});

	test('supports custom name lists and disabling defaults', () => {
		const code = 'const config = 1; const special = 2;';
		const findings = analyzeSource(code, 'typescript', {
			...baseOptions,
			useDefaultNameLists: false,
			genericNames: ['special'],
		});
		assert.ok(!findings.some((f) => f.name === 'config'));
		assert.ok(findings.some((f) => f.name === 'special'));
	});

	test('deterministic output', () => {
		const code = 'const temp = 1;';
		const first = analyzeSource(code, 'typescript', baseOptions);
		const second = analyzeSource(code, 'typescript', baseOptions);
		assert.deepStrictEqual(first, second);
	});

	test('formats therapy message with name', () => {
		const message = formatTherapyMessage('data', 'generic', 'en');
		assert.ok(message.includes('data'));
	});

	test('supports Spanish messages', () => {
		const message = formatTherapyMessage('data', 'generic', 'es');
		assert.ok(message.toLowerCase().includes('data'));
	});
});
