import * as ts from 'typescript';

export type ReasonCode = 'generic' | 'versioned' | 'single-letter' | 'keyboard-mash';
export type Locale = 'en' | 'es';

export type Finding = {
	name: string;
	start: number;
	end: number;
	reasonCode: ReasonCode;
};

export type AnalyzeOptions = {
	allowSingleLetterInLoops: boolean;
	ignoredNames: string[];
	ignoredPrefixes: string[];
	allowedLanguages: string[];
	enableRegexFallback: boolean;
	useDefaultNameLists: boolean;
	genericNames: string[];
	genericPatterns: string[];
	keyboardMashNames: string[];
	versionedPatterns: string[];
};

const DEFAULT_LANGUAGES = [
	'typescript',
	'typescriptreact',
	'javascript',
	'javascriptreact',
];

const DEFAULT_GENERIC_NAMES = new Set([
	'data',
	'item',
	'items',
	'list',
	'arr',
	'array',
	'obj',
	'object',
	'map',
	'dict',
	'record',
	'value',
	'values',
	'result',
	'results',
	'info',
	'config',
	'settings',
	'state',
	'resp',
	'response',
	'req',
	'request',
	'ctx',
	'context',
	'props',
	'prop',
	'meta',
	'payload',
	'body',
	'temp',
	'tmp',
	'var',
	'param',
	'params',
	'arg',
	'args',
	'misc',
	'foo',
	'bar',
	'baz',
	'test',
	'dummy',
	'thing',
	'stuff',
]);

const DEFAULT_GENERIC_PATTERNS = [
	/^data(_?\d+)?$/i,
	/^temp(_?\d+)?$/i,
	/^tmp(_?\d+)?$/i,
	/^item(_?\d+)?$/i,
	/^list(_?\d+)?$/i,
	/^array(_?\d+)?$/i,
	/^arr(_?\d+)?$/i,
	/^obj(_?\d+)?$/i,
	/^value(_?\d+)?$/i,
	/^result(_?\d+)?$/i,
	/^info(_?\d+)?$/i,
	/^var(_?\d+)?$/i,
	/^param(_?\d+)?$/i,
	/^arg(_?\d+)?$/i,
];

const DEFAULT_KEYBOARD_MASH = new Set([
	'asdf',
	'qwer',
	'zxcv',
	'asdfgh',
	'qwerty',
	'zxcvb',
	'poiuy',
	'lkjh',
]);

const DEFAULT_VERSIONED_PATTERNS = [
	/^final\d*$/i,
	/^final_+$/i,
	/\bfinal_final\b/i,
	/^v\d+$/i,
	/^(new|old)[A-Z_]/,
	/^(new|old|legacy|backup|copy)\d*$/i,
	/^(new|old|legacy|backup|copy)[A-Z_]/,
	/_[Vv]\d+$/,
	/_(old|new|legacy|backup|copy)$/,
	/^(draft|wip)\d*$/i,
];

const REPEAT_LETTER = /^(.)\1{2,}$/i;

const MESSAGE_TEMPLATES: Record<Locale, Record<ReasonCode, string[]>> = {
	en: {
		generic: [
			"Let's talk about this name: '{name}' — what is it really?",
			"'{name}' feels a bit vague. Can we make it more specific?",
			"'{name}' is doing a lot of work. A clearer name might help.",
			"'{name}' is a little mysterious. What does it represent?",
			"'{name}' is generic. Can we name it by intent?",
			"'{name}' is a classic placeholder. What's the real role here?",
			"'{name}' could mean anything. What would a teammate expect?",
			"'{name}' feels like a container. What's inside, specifically?",
			"'{name}' is broad. Can we name the outcome or purpose?",
			"'{name}' reads like a category. What's the actual thing?",
			"'{name}' is vague on purpose. Can we be precise instead?",
			"'{name}' feels like a catch-all. What's the true meaning?",
		],
		versioned: [
			"'{name}' sounds temporary. What would a final name be?",
			"Versioned names like '{name}' tend to stick forever.",
			"'{name}' hints at a timeline. Is there a clearer intent?",
			"'{name}' looks like a rename later. Maybe now is later?",
			"'{name}' feels like a draft. Can we make it the real name?",
			"'{name}' is wearing a band-aid. What should it really be?",
			"'{name}' implies history. Can we name it by behavior?",
			"'{name}' feels like a stopgap. What's the true concept?",
			"'{name}' suggests a sequel. Can we name the real role?",
			"'{name}' sounds like a temporary fix. What's the stable name?",
			"'{name}' hints at a migration. Can we name it by intent?",
		],
		'single-letter': [
			"One-letter names like '{name}' are shy. Give it some meaning?",
			"'{name}' is very short. A few more letters could help.",
			"'{name}' is hard to remember. Want to be kinder to future-you?",
			"'{name}' is a little cryptic. What's the story here?",
			"'{name}' might be quick to type, but costly to read.",
			"'{name}' is tiny. A clearer name could save future time.",
		],
		'keyboard-mash': [
			"'{name}' looks like keyboard warm-up. Want a real name?",
			"'{name}' feels accidental. Let's give it a purpose.",
			"'{name}' is a vibe, not a variable. Let's rename it.",
			"'{name}' reads like a test. What should it really be?",
			"'{name}' feels improvised. A clearer name would help.",
			"'{name}' looks like a placeholder. Want something meaningful?",
		],
	},
	es: {
		generic: [
			"Hablemos de este nombre: '{name}' — ¿qué es realmente?",
			"'{name}' suena muy genérico. ¿Podemos ser más específicos?",
			"'{name}' es un poco misterioso. ¿Qué representa?",
			"'{name}' está haciendo mucho trabajo. Un nombre más claro ayudaría.",
			"'{name}' es amplio. ¿Podemos nombrar la intención?",
			"'{name}' parece un placeholder. ¿Cuál es su rol real?",
			"'{name}' podría ser cualquier cosa. ¿Qué esperaría un teammate?",
			"'{name}' suena a contenedor. ¿Qué hay dentro?",
			"'{name}' es genérico. ¿Podemos nombrar el propósito?",
			"'{name}' parece una categoría. ¿Cuál es la cosa real?",
			"'{name}' es vago a propósito. ¿Podemos ser precisos?",
			"'{name}' suena a comodín. ¿Cuál es el significado real?",
		],
		versioned: [
			"'{name}' suena temporal. ¿Cuál sería el nombre final?",
			"Los nombres versionados como '{name}' suelen quedarse para siempre.",
			"'{name}' sugiere una línea de tiempo. ¿Hay un nombre más claro?",
			"'{name}' parece un renombrar-luego. ¿Y si es ahora?",
			"'{name}' huele a borrador. ¿Podemos hacerlo definitivo?",
			"'{name}' es un parche. ¿Cómo debería llamarse?",
			"'{name}' implica historia. ¿Podemos nombrarlo por su comportamiento?",
			"'{name}' suena a solución temporal. ¿Cuál es el concepto real?",
			"'{name}' suena a secuela. ¿Cuál es el rol real?",
			"'{name}' parece un arreglo momentáneo. ¿Nombre estable?",
			"'{name}' sugiere migración. ¿Podemos nombrar la intención?",
		],
		'single-letter': [
			"Los nombres de una letra como '{name}' son tímidos. ¿Le damos significado?",
			"'{name}' es muy corto. Un par de letras más ayudarían.",
			"'{name}' es difícil de recordar. ¿Te ayudamos a tu yo futuro?",
			"'{name}' es críptico. ¿Cuál es la historia aquí?",
			"'{name}' se escribe rápido, pero se lee lento.",
			"'{name}' es diminuto. Un nombre claro ahorra tiempo después.",
		],
		'keyboard-mash': [
			"'{name}' parece calentamiento de teclado. ¿Un nombre real?",
			"'{name}' suena accidental. Démosle un propósito.",
			"'{name}' es un mood, no una variable. Renombrémoslo.",
			"'{name}' parece de prueba. ¿Qué debería decir realmente?",
			"'{name}' suena improvisado. Un nombre claro ayudaría.",
			"'{name}' parece un placeholder. ¿Nombre con sentido?",
		],
	},
};

type NameConfig = {
	genericNames: Set<string>;
	genericPatterns: RegExp[];
	keyboardMash: Set<string>;
	versionedPatterns: RegExp[];
};

function buildNameConfig(options: AnalyzeOptions): NameConfig {
	const useDefaults = options.useDefaultNameLists;
	const genericNames = new Set<string>();
	if (useDefaults) {
		for (const name of DEFAULT_GENERIC_NAMES) {
			genericNames.add(name);
		}
	}
	for (const name of options.genericNames) {
		genericNames.add(name.toLowerCase());
	}

	const genericPatterns = [
		...(useDefaults ? DEFAULT_GENERIC_PATTERNS : []),
		...compilePatterns(options.genericPatterns),
	];

	const keyboardMash = new Set<string>();
	if (useDefaults) {
		for (const name of DEFAULT_KEYBOARD_MASH) {
			keyboardMash.add(name);
		}
	}
	for (const name of options.keyboardMashNames) {
		keyboardMash.add(name.toLowerCase());
	}

	const versionedPatterns = [
		...(useDefaults ? DEFAULT_VERSIONED_PATTERNS : []),
		...compilePatterns(options.versionedPatterns),
	];

	return {
		genericNames,
		genericPatterns,
		keyboardMash,
		versionedPatterns,
	};
}

function compilePatterns(patterns: string[]): RegExp[] {
	const compiled: RegExp[] = [];
	for (const raw of patterns) {
		const pattern = raw.trim();
		if (!pattern) {
			continue;
		}
		const parsed = parseRegexLiteral(pattern);
		if (parsed) {
			compiled.push(parsed);
			continue;
		}
		try {
			compiled.push(new RegExp(pattern, 'i'));
		} catch {
			// Ignore invalid patterns
		}
	}
	return compiled;
}

function parseRegexLiteral(value: string): RegExp | null {
	if (!value.startsWith('/')) {
		return null;
	}
	const lastSlash = value.lastIndexOf('/');
	if (lastSlash <= 0) {
		return null;
	}
	const body = value.slice(1, lastSlash);
	const flags = value.slice(lastSlash + 1);
	try {
		return new RegExp(body, flags || 'i');
	} catch {
		return null;
	}
}

export function analyzeSource(
	text: string,
	languageId: string,
	options: AnalyzeOptions,
): Finding[] {
	const normalizedLanguage = languageId.toLowerCase();
	const allowedLanguages = options.allowedLanguages.length > 0
		? options.allowedLanguages.map((lang) => lang.toLowerCase())
		: DEFAULT_LANGUAGES;
	const allowedSet = new Set(allowedLanguages);
	const isJsLike = DEFAULT_LANGUAGES.includes(normalizedLanguage);
	if (!allowedSet.has(normalizedLanguage)) {
		return [];
	}
	const nameConfig = buildNameConfig(options);
	if (!isJsLike) {
		return options.enableRegexFallback
			? analyzeWithRegex(text, normalizedLanguage, options, nameConfig)
			: [];
	}

	const scriptKind = normalizedLanguage.includes('typescript')
		? ts.ScriptKind.TS
		: ts.ScriptKind.JS;
	const sourceFile = ts.createSourceFile(
		'input',
		text,
		ts.ScriptTarget.Latest,
		true,
		scriptKind,
	);

	const findings: Finding[] = [];
	const ignored = new Set(options.ignoredNames.map((name) => name.toLowerCase()));
	const ignoredPrefixes = options.ignoredPrefixes.filter((prefix) => prefix.length > 0);

	const visit = (node: ts.Node): void => {
		if (ts.isVariableDeclaration(node)) {
			collectFromBindingName(
				node.name,
				node,
				findings,
				ignored,
				ignoredPrefixes,
				options,
				nameConfig,
			);
		}
		if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
			const name = node.name.text;
			const reason = evaluateName(name, node, ignored, ignoredPrefixes, options, nameConfig);
			if (reason) {
				findings.push({
					name,
					start: node.name.getStart(sourceFile),
					end: node.name.getEnd(),
					reasonCode: reason,
				});
			}
		}
		ts.forEachChild(node, visit);
	};

	visit(sourceFile);
	return findings;
}

export function formatTherapyMessage(
	name: string,
	reasonCode: ReasonCode,
	locale: string = 'en',
): string {
	const resolvedLocale = normalizeLocale(locale);
	const options = MESSAGE_TEMPLATES[resolvedLocale][reasonCode];
	const index = stableHash(`${reasonCode}:${name}`) % options.length;
	return options[index].replace('{name}', name);
}

function collectFromBindingName(
	name: ts.BindingName,
	owner: ts.Node,
	findings: Finding[],
	ignored: Set<string>,
	ignoredPrefixes: string[],
	options: AnalyzeOptions,
	nameConfig: NameConfig,
): void {
	if (ts.isIdentifier(name)) {
		const reason = evaluateName(name.text, owner, ignored, ignoredPrefixes, options, nameConfig);
		if (reason) {
			findings.push({
				name: name.text,
				start: name.getStart(),
				end: name.getEnd(),
				reasonCode: reason,
			});
		}
		return;
	}
	if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
		for (const element of name.elements) {
			if (ts.isBindingElement(element)) {
				collectFromBindingName(
					element.name,
					element,
					findings,
					ignored,
					ignoredPrefixes,
					options,
					nameConfig,
				);
			}
		}
	}
}

function evaluateName(
	name: string,
	node: ts.Node,
	ignored: Set<string>,
	ignoredPrefixes: string[],
	options: AnalyzeOptions,
	nameConfig: NameConfig,
): ReasonCode | null {
	const lower = name.toLowerCase();
	if (ignored.has(lower)) {
		return null;
	}
	if (ignoredPrefixes.some((prefix) => name.startsWith(prefix))) {
		return null;
	}
	if (isCommonParamName(name, node)) {
		return null;
	}
	if (isSingleLetter(name)) {
		if (options.allowSingleLetterInLoops && isAllowedLoopIndex(name, node)) {
			return null;
		}
		return 'single-letter';
	}
	if (isGenericName(name, lower, nameConfig)) {
		return 'generic';
	}
	if (nameConfig.keyboardMash.has(lower) || REPEAT_LETTER.test(name)) {
		return 'keyboard-mash';
	}
	if (nameConfig.versionedPatterns.some((pattern) => pattern.test(name))) {
		return 'versioned';
	}
	return null;
}

function isSingleLetter(name: string): boolean {
	return /^[a-zA-Z]$/.test(name);
}

function normalizeLocale(locale: string): Locale {
	const normalized = locale.toLowerCase();
	if (normalized.startsWith('es')) {
		return 'es';
	}
	return 'en';
}

function isGenericName(name: string, lower: string, nameConfig: NameConfig): boolean {
	if (nameConfig.genericNames.has(lower)) {
		return true;
	}
	if (nameConfig.genericPatterns.some((pattern) => pattern.test(lower))) {
		return true;
	}
	return isCompositeGeneric(name, nameConfig);
}

function isCompositeGeneric(name: string, nameConfig: NameConfig): boolean {
	const tokens = splitNameTokens(name);
	if (tokens.length < 2) {
		return false;
	}
	let genericCount = 0;
	for (const token of tokens) {
		if (
			nameConfig.genericNames.has(token)
			|| nameConfig.genericPatterns.some((pattern) => pattern.test(token))
		) {
			genericCount += 1;
		}
	}
	return genericCount >= 2 && genericCount === tokens.length;
}

function splitNameTokens(name: string): string[] {
	const withSpaces = name
		.replaceAll(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replaceAll(/[_\-\s]+/g, ' ')
		.trim()
		.toLowerCase();
	if (!withSpaces) {
		return [];
	}
	return withSpaces.split(' ').filter(Boolean);
}

function isAllowedLoopIndex(name: string, node: ts.Node): boolean {
	if (!['i', 'j', 'k'].includes(name)) {
		return false;
	}
	let current: ts.Node | undefined = node;
	while (current) {
		if (ts.isForStatement(current) || ts.isForInStatement(current) || ts.isForOfStatement(current)) {
			return true;
		}
		current = current.parent;
	}
	return false;
}

function isCommonParamName(name: string, node: ts.Node): boolean {
	if (!ts.isParameter(node)) {
		return false;
	}
	return name === 'err' || name === 'e';
}

function analyzeWithRegex(
	text: string,
	languageId: string,
	options: AnalyzeOptions,
	nameConfig: NameConfig,
): Finding[] {
	const findings: Finding[] = [];
	const ignored = new Set(options.ignoredNames.map((name) => name.toLowerCase()));
	const ignoredPrefixes = options.ignoredPrefixes.filter((prefix) => prefix.length > 0);
	const scrubbed = stripCommentsAndStrings(text);
	const regexes = buildRegexes(languageId);
	for (const regex of regexes) {
		let match: RegExpExecArray | null = null;
		while ((match = regex.exec(scrubbed)) !== null) {
			const name = match[1];
			const reason = evaluateName(
				name,
				createFakeNode(),
				ignored,
				ignoredPrefixes,
				options,
				nameConfig,
			);
			if (!reason) {
				continue;
			}
			const start = match.index + match[0].lastIndexOf(name);
			findings.push({ name, start, end: start + name.length, reasonCode: reason });
		}
	}
	return findings;
}

function stripCommentsAndStrings(text: string): string {
	return text
		.replaceAll(/\/\*[\s\S]*?\*\//g, ' ')
		.replaceAll(/\/\/.*$/gm, ' ')
		.replaceAll(/(['"`])(?:\\.|(?!\1)[^\\])*(\1)/g, ' ');
}

function createFakeNode(): ts.Node {
	return { kind: ts.SyntaxKind.Unknown } as ts.Node;
}

function buildRegexes(languageId: string): RegExp[] {
	switch (languageId) {
		case 'python':
			return [/^\s*([a-zA-Z_]\w*)\s*=(?!=)/gm];
		case 'go':
			return [
				/\bvar\s+([a-zA-Z_]\w*)/g,
				/\bconst\s+([a-zA-Z_]\w*)/g,
				/\b([a-zA-Z_]\w*)\s*:=/g,
			];
		default:
			return [/\b(?:const|let|var)\s+([a-zA-Z_$][\w$]*)/g];
	}
}

function stableHash(value: string): number {
	let hash = 5381;
	for (let i = 0; i < value.length; i += 1) {
		hash = (hash * 33) ^ (value.codePointAt(i) ?? 0);
	}
	return Math.abs(hash);
}
