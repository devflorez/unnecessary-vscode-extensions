const ESCAPE_REGEX = /[-/\\^$+?.()|[\]{}]/g;

type TokenRead = { pattern: string; nextIndex: number };

export function matchGlob(pattern: string, targetPath: string): boolean {
	const trimmed = pattern.trim();
	if (!trimmed) {
		return false;
	}
	const normalizedPath = normalizePath(targetPath);
	const target = trimmed.includes('/') ? normalizedPath : basename(normalizedPath);
	let normalizedPattern = trimmed;
	if (normalizedPattern.startsWith('/')) {
		normalizedPattern = normalizedPattern.slice(1);
	}
	const expanded = expandBraces(normalizedPattern);
	return expanded.some((entry) => globToRegExp(entry).test(target));
}

export function normalizePath(value: string): string {
	return value.replaceAll(String.raw`\\`, '/');
}

function basename(value: string): string {
	const normalized = normalizePath(value);
	const index = normalized.lastIndexOf('/');
	return index === -1 ? normalized : normalized.slice(index + 1);
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
