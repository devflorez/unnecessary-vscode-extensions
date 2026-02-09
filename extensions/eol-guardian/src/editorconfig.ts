import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export type EditorConfigResult = {
	endOfLine: 'lf' | 'crlf';
	sourcePath: string;
};

type ParsedEditorConfig = {
	endOfLine?: 'lf' | 'crlf';
	root: boolean;
};

type ParseState = {
	endOfLine?: 'lf' | 'crlf';
	root: boolean;
	inGlobal: boolean;
	sectionMatches: boolean;
	relativePath: string;
};

type TokenRead = { pattern: string; nextIndex: number };

const ESCAPE_REGEX = /[-/\\^$+?.()|[\]{}]/g;

export async function findEditorConfigEol(filePath: string): Promise<EditorConfigResult | null> {
	const configPaths = await collectEditorConfigPaths(path.dirname(filePath));
	let result: EditorConfigResult | null = null;

	for (const configPath of configPaths) {
		const contents = await readFileSafe(configPath);
		if (contents === null) {
			continue;
		}
		const relativePath = toPosix(path.relative(path.dirname(configPath), filePath));
		const parsed = parseEditorConfig(contents, relativePath);
		if (parsed.endOfLine) {
			result = { endOfLine: parsed.endOfLine, sourcePath: configPath };
		}
		if (parsed.root) {
			break;
		}
	}

	return result;
}

async function collectEditorConfigPaths(startDir: string): Promise<string[]> {
	const paths: string[] = [];
	let current = startDir;
	let last = '';
	while (current !== last) {
		const candidate = path.join(current, '.editorconfig');
		try {
			const stat = await fs.stat(candidate);
			if (stat.isFile()) {
				paths.push(candidate);
			}
		} catch {
			// ignore
		}
		last = current;
		current = path.dirname(current);
	}
	return paths.reverse();
}

async function readFileSafe(filePath: string): Promise<string | null> {
	try {
		return await fs.readFile(filePath, 'utf8');
	} catch {
		return null;
	}
}

function parseEditorConfig(contents: string, relativePath: string): ParsedEditorConfig {
	const state: ParseState = {
		endOfLine: undefined,
		root: false,
		inGlobal: true,
		sectionMatches: true,
		relativePath,
	};

	for (const rawLine of contents.split(/\r?\n/)) {
		processLine(state, rawLine);
	}

	return { endOfLine: state.endOfLine, root: state.root };
}

function processLine(state: ParseState, rawLine: string): void {
	const line = rawLine.trim();
	if (!line || line.startsWith('#') || line.startsWith(';')) {
		return;
	}
	if (line.startsWith('[') && line.endsWith(']')) {
		applySectionHeader(state, line);
		return;
	}
	const entry = parseKeyValue(line);
	if (!entry) {
		return;
	}
	applyKeyValue(state, entry.key, entry.value);
}

function applySectionHeader(state: ParseState, line: string): void {
	state.inGlobal = false;
	const patternBody = line.slice(1, -1).trim();
	const patterns = patternBody
		.split(',')
		.map((pattern) => pattern.trim())
		.filter(Boolean);
	state.sectionMatches = patterns.some((pattern) => matchPattern(pattern, state.relativePath));
}

function parseKeyValue(line: string): { key: string; value: string } | null {
	const parts = line.split('=');
	if (parts.length < 2) {
		return null;
	}
	const key = parts[0].trim().toLowerCase();
	const value = parts.slice(1).join('=').trim().toLowerCase();
	return { key, value };
}

function applyKeyValue(state: ParseState, key: string, value: string): void {
	const isApplicable = state.inGlobal || state.sectionMatches;
	if (key === 'root' && state.inGlobal) {
		state.root = value === 'true';
		return;
	}
	if (key === 'end_of_line' && isApplicable) {
		if (value === 'lf' || value === 'crlf') {
			state.endOfLine = value;
		}
	}
}

function matchPattern(pattern: string, relativePath: string): boolean {
	const normalized = toPosix(relativePath);
	const target = pattern.includes('/') ? normalized : path.posix.basename(normalized);
	let normalizedPattern = pattern.trim();
	if (normalizedPattern.startsWith('/')) {
		normalizedPattern = normalizedPattern.slice(1);
	}
	const expanded = expandBraces(normalizedPattern);
	return expanded.some((entry) => globToRegExp(entry).test(target));
}

function globToRegExp(pattern: string): RegExp {
	let regex = '^';
	let index = 0;
	while (index < pattern.length) {
		const token = readToken(pattern, index);
		regex += token.pattern;
		index = token.nextIndex;
	}
	regex += '$';
	return new RegExp(regex);
}

function readToken(pattern: string, index: number): TokenRead {
	const char = pattern[index];
	if (char === '\\') {
		return readEscaped(pattern, index);
	}
	if (char === '*') {
		return readWildcard(pattern, index);
	}
	if (char === '?') {
		return { pattern: '[^/]', nextIndex: index + 1 };
	}
	if (char === '[') {
		const closing = findClosingBracket(pattern, index + 1);
		if (closing !== -1) {
			const raw = pattern.slice(index + 1, closing);
			return { pattern: buildCharClass(raw), nextIndex: closing + 1 };
		}
	}
	return { pattern: escapeRegExp(char), nextIndex: index + 1 };
}

function readEscaped(pattern: string, index: number): TokenRead {
	const next = pattern[index + 1];
	if (next) {
		return { pattern: escapeRegExp(next), nextIndex: index + 2 };
	}
	return { pattern: escapeRegExp('\\'), nextIndex: index + 1 };
}

function readWildcard(pattern: string, index: number): TokenRead {
	if (pattern[index + 1] === '*') {
		return { pattern: '.*', nextIndex: index + 2 };
	}
	return { pattern: '[^/]*', nextIndex: index + 1 };
}

function escapeRegExp(value: string): string {
	return value.replaceAll(ESCAPE_REGEX, String.raw`\\$&`);
}

function toPosix(value: string): string {
	return value.replaceAll(String.raw`\\`, '/');
}

function expandBraces(pattern: string): string[] {
	const start = findBraceStart(pattern);
	if (start === -1) {
		return [pattern];
	}
	const end = findMatchingBrace(pattern, start);
	if (end === -1) {
		return [pattern];
	}
	const body = pattern.slice(start + 1, end);
	const parts = splitBraceParts(body);
	const prefix = pattern.slice(0, start);
	const suffix = pattern.slice(end + 1);
	const expanded: string[] = [];
	for (const part of parts) {
		for (const rest of expandBraces(prefix + part + suffix)) {
			expanded.push(rest);
		}
	}
	return expanded;
}

function findBraceStart(pattern: string): number {
	let index = 0;
	while (index < pattern.length) {
		const char = pattern[index];
		if (char === '\\') {
			index += 2;
			continue;
		}
		if (char === '{') {
			return index;
		}
		index += 1;
	}
	return -1;
}

function findMatchingBrace(pattern: string, start: number): number {
	let depth = 0;
	let index = start;
	while (index < pattern.length) {
		const char = pattern[index];
		if (char === '\\') {
			index += 2;
			continue;
		}
		if (char === '{') {
			depth += 1;
		} else if (char === '}') {
			depth -= 1;
			if (depth === 0) {
				return index;
			}
		}
		index += 1;
	}
	return -1;
}

function splitBraceParts(body: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let last = 0;
	let index = 0;
	while (index < body.length) {
		const char = body[index];
		if (char === '\\') {
			index += 2;
			continue;
		}
		if (char === '{') {
			depth += 1;
			index += 1;
			continue;
		}
		if (char === '}') {
			depth -= 1;
			index += 1;
			continue;
		}
		if (char === ',' && depth === 0) {
			parts.push(body.slice(last, index));
			last = index + 1;
		}
		index += 1;
	}
	parts.push(body.slice(last));
	return parts;
}

function findClosingBracket(pattern: string, start: number): number {
	let index = start;
	while (index < pattern.length) {
		const char = pattern[index];
		if (char === '\\') {
			index += 2;
			continue;
		}
		if (char === ']') {
			return index;
		}
		index += 1;
	}
	return -1;
}

function buildCharClass(raw: string): string {
	if (raw.length === 0) {
		return String.raw`\\[\\]`;
	}
	let content = raw;
	let negate = false;
	if (content.startsWith('!') || content.startsWith('^')) {
		negate = true;
		content = content.slice(1);
	}
	const escaped = content
		.replaceAll(String.raw`\\`, String.raw`\\\\`)
		.replaceAll(']', String.raw`\\]`);
	return `[${negate ? '^' : ''}${escaped}]`;
}
