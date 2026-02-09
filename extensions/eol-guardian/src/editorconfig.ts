import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { matchGlob } from './core/glob';

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

export async function findEditorConfigEol(filePath: string): Promise<EditorConfigResult | null> {
	const configPaths = await collectEditorConfigPaths(path.dirname(filePath));
	let result: EditorConfigResult | null = null;

	for (const configPath of configPaths) {
		const contents = await readFileSafe(configPath);
		if (contents === null) {
			continue;
		}
		const relativePath = path.relative(path.dirname(configPath), filePath);
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
	state.sectionMatches = patterns.some((pattern) => matchGlob(pattern, state.relativePath));
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
