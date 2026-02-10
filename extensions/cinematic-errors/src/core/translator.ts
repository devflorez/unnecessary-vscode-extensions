export type CinematicMessage = {
	id: string;
	lines: string[];
};

export type CinematicLocale = 'en' | 'es';

type CinematicRule = {
	id: string;
	patterns: RegExp[];
	variants: string[][];
};

const CINEMATIC_RULES_EN: CinematicRule[] = [
	{
		id: 'null-undefined',
		patterns: [
			/\bnull\b/i,
			/\bundefined\b/i,
			/cannot read .* of (null|undefined)/i,
			/is not an object \(evaluating .*\)/i,
		],
		variants: [
			[
				'In a world where null was never checked...',
				'One missing guard would bring it all down.',
				'This is that moment.',
			],
			[
				'Somewhere between null and undefined...',
				'The hero forgot the check.',
				'The runtime remembers.',
			],
			[
				'They said it could never be null.',
				'They were wrong.',
			],
		],
	},
	{
		id: 'reference-error',
		patterns: [
			/\bnot defined\b/i,
			/cannot find name/i,
			/referenceerror/i,
		],
		variants: [
			[
				'A name whispered in the code...',
				'But no one ever defined it.',
			],
			[
				'The symbol never showed up.',
				'The runtime noticed.',
			],
		],
	},
	{
		id: 'type-mismatch',
		patterns: [
			/type .* is not assignable to type/i,
			/type mismatch/i,
			/cannot assign.*to/i,
			/argument of type .* is not assignable to parameter of type/i,
		],
		variants: [
			[
				'Two types. One impossible romance.',
				'They were never meant to compile.',
			],
			[
				'The compiler watched in silence...',
				'And then refused the union.',
			],
			[
				'A string entered the scene.',
				'A number walked out.',
			],
		],
	},
	{
		id: 'syntax-error',
		patterns: [
			/syntaxerror/i,
			/unexpected token/i,
			/unexpected identifier/i,
			/unexpected end of input/i,
		],
		variants: [
			[
				'One bracket fell out of place.',
				'The parser refused to continue.',
			],
			[
				'A single token entered...',
				'And the whole script stopped.',
			],
		],
	},
	{
		id: 'missing-property',
		patterns: [
			/property .* does not exist/i,
			/is missing the following properties/i,
			/missing property/i,
			/key .* not found/i,
		],
		variants: [
			[
				'A key was promised.',
				'It never arrived.',
				'Now the plot collapses.',
			],
			[
				'A property went missing.',
				'The object refuses to talk.',
			],
			[
				'They searched every field...',
				'But the property was never there.',
			],
		],
	},
	{
		id: 'module-not-found',
		patterns: [
			/cannot find module/i,
			/module not found/i,
			/failed to resolve module/i,
			/cannot find package/i,
		],
		variants: [
			[
				'A module vanished in the night.',
				'No import could track it down.',
			],
			[
				'The dependency never arrived.',
				'The build moved on without it.',
			],
		],
	},
	{
		id: 'index-out-of-bounds',
		patterns: [
			/index out of range/i,
			/out of bounds/i,
			/index .* out of/i,
		],
		variants: [
			[
				'Beyond the last index lies only chaos.',
				'The array draws its final line.',
			],
			[
				'The index stepped too far.',
				'The bounds closed behind it.',
			],
			[
				'One step past the array...',
				'And the world went dark.',
			],
		],
	},
	{
		id: 'file-not-found',
		patterns: [
			/enoent/i,
			/no such file or directory/i,
			/file not found/i,
		],
		variants: [
			[
				'The file was supposed to be here.',
				'It never was.',
			],
			[
				'A path without a destination...',
				'And the story ends early.',
			],
		],
	},
	{
		id: 'permission-denied',
		patterns: [
			/eacces/i,
			/permission denied/i,
			/eperm/i,
		],
		variants: [
			[
				'Access was denied at the gates.',
				'The system held its ground.',
			],
			[
				'The door was locked.',
				'No keys were provided.',
			],
		],
	},
	{
		id: 'network-error',
		patterns: [
			/econnrefused/i,
			/enotfound/i,
			/econnreset/i,
			/network error/i,
			/failed to fetch/i,
		],
		variants: [
			[
				'The network went silent.',
				'No response returned.',
			],
			[
				'Packets vanished in the dark.',
				'The request never came back.',
			],
		],
	},
	{
		id: 'timeout',
		patterns: [
			/timeout/i,
			/timed out/i,
			/etimedout/i,
		],
		variants: [
			[
				'The clock kept ticking.',
				'The answer never arrived.',
			],
			[
				'Time ran out.',
				'The request stood still.',
			],
		],
	},
	{
		id: 'stack-overflow',
		patterns: [
			/maximum call stack size exceeded/i,
			/stack overflow/i,
		],
		variants: [
			[
				'One call became two...',
				'And the stack grew without end.',
			],
			[
				'A loop within a loop within a loop.',
				'The stack could not survive.',
			],
		],
	},
];

const CINEMATIC_RULES_ES: CinematicRule[] = [
	{
		id: 'null-undefined',
		patterns: [
			/\bnull\b/i,
			/\bundefined\b/i,
			/cannot read .* of (null|undefined)/i,
			/is not an object \(evaluating .*\)/i,
		],
		variants: [
			[
				'En un mundo donde nadie validó null...',
				'Un solo acceso lo derrumbó todo.',
				'Esta es esa escena.',
			],
			[
				'Entre null y undefined...',
				'El héroe olvidó la validación.',
				'El runtime no perdona.',
			],
			[
				'Dijeron que jamás sería null.',
				'La historia dijo otra cosa.',
			],
		],
	},
	{
		id: 'reference-error',
		patterns: [
			/\bnot defined\b/i,
			/cannot find name/i,
			/referenceerror/i,
		],
		variants: [
			[
				'Un nombre se dijo en el código...',
				'Pero nadie lo definió.',
			],
			[
				'El símbolo nunca apareció.',
				'El runtime sí lo notó.',
			],
		],
	},
	{
		id: 'type-mismatch',
		patterns: [
			/type .* is not assignable to type/i,
			/type mismatch/i,
			/cannot assign.*to/i,
			/argument of type .* is not assignable to parameter of type/i,
		],
		variants: [
			[
				'Dos tipos. Un romance imposible.',
				'Jamás debieron compilar.',
			],
			[
				'El compilador guardó silencio...',
				'Y luego dijo que no.',
			],
			[
				'Entró un string.',
				'Salió un error.',
			],
		],
	},
	{
		id: 'syntax-error',
		patterns: [
			/syntaxerror/i,
			/unexpected token/i,
			/unexpected identifier/i,
			/unexpected end of input/i,
		],
		variants: [
			[
				'Un paréntesis fuera de lugar.',
				'El parser se negó a seguir.',
			],
			[
				'Un token entró en escena...',
				'Y todo se detuvo.',
			],
		],
	},
	{
		id: 'missing-property',
		patterns: [
			/property .* does not exist/i,
			/is missing the following properties/i,
			/missing property/i,
			/key .* not found/i,
		],
		variants: [
			[
				'Se prometió una propiedad.',
				'Nunca apareció.',
				'Y el guion se rompe.',
			],
			[
				'Falta una clave en el reparto.',
				'El objeto no tiene respuestas.',
			],
			[
				'Buscaron en todos los campos...',
				'La propiedad nunca existió.',
			],
		],
	},
	{
		id: 'module-not-found',
		patterns: [
			/cannot find module/i,
			/module not found/i,
			/failed to resolve module/i,
			/cannot find package/i,
		],
		variants: [
			[
				'Un módulo desapareció en la noche.',
				'Ningún import pudo encontrarlo.',
			],
			[
				'La dependencia nunca llegó.',
				'El build siguió sin ella.',
			],
		],
	},
	{
		id: 'index-out-of-bounds',
		patterns: [
			/index out of range/i,
			/out of bounds/i,
			/index .* out of/i,
		],
		variants: [
			[
				'Más allá del último índice, solo hay caos.',
				'El arreglo trazó su límite final.',
			],
			[
				'El índice dio un paso de más.',
				'Los límites se cerraron.',
			],
			[
				'Un paso fuera del arreglo...',
				'Y todo se apagó.',
			],
		],
	},
	{
		id: 'file-not-found',
		patterns: [
			/enoent/i,
			/no such file or directory/i,
			/file not found/i,
		],
		variants: [
			[
				'El archivo debía estar aquí.',
				'Pero nunca existió.',
			],
			[
				'Una ruta sin destino...',
				'Y la historia termina temprano.',
			],
		],
	},
	{
		id: 'permission-denied',
		patterns: [
			/eacces/i,
			/permission denied/i,
			/eperm/i,
		],
		variants: [
			[
				'Acceso denegado en la puerta.',
				'El sistema no cedió.',
			],
			[
				'La puerta estaba cerrada.',
				'No había llaves.',
			],
		],
	},
	{
		id: 'network-error',
		patterns: [
			/econnrefused/i,
			/enotfound/i,
			/econnreset/i,
			/network error/i,
			/failed to fetch/i,
		],
		variants: [
			[
				'La red quedó en silencio.',
				'No hubo respuesta.',
			],
			[
				'Los paquetes se perdieron.',
				'La petición no regresó.',
			],
		],
	},
	{
		id: 'timeout',
		patterns: [
			/timeout/i,
			/timed out/i,
			/etimedout/i,
		],
		variants: [
			[
				'El reloj siguió corriendo.',
				'La respuesta nunca llegó.',
			],
			[
				'Se acabó el tiempo.',
				'La petición quedó quieta.',
			],
		],
	},
	{
		id: 'stack-overflow',
		patterns: [
			/maximum call stack size exceeded/i,
			/stack overflow/i,
		],
		variants: [
			[
				'Una llamada se volvió dos...',
				'Y la pila creció sin fin.',
			],
			[
				'Un bucle dentro de otro bucle.',
				'La pila no sobrevivió.',
			],
		],
	},
];

const FALLBACK_VARIANTS_EN: string[][] = [
	[
		'In a world of quiet code...',
		'One unexpected error rises.',
		'This debug session begins.',
	],
	[
		'The build was green...',
		'Until one line changed everything.',
	],
	[
		'No one saw it coming.',
		'The error did.',
	],
];

const FALLBACK_VARIANTS_ES: string[][] = [
	[
		'En un mundo de código en calma...',
		'Un error inesperado despierta.',
		'Y empieza la depuración.',
	],
	[
		'Todo estaba en verde...',
		'Hasta que una línea lo cambió todo.',
	],
	[
		'Nadie lo vio venir.',
		'El error sí.',
	],
];

export const CINEMATIC_RULES = {
	en: CINEMATIC_RULES_EN,
	es: CINEMATIC_RULES_ES,
} satisfies Record<CinematicLocale, CinematicRule[]>;

export function getCinematicRules(locale: string): CinematicRule[] {
	return locale.toLowerCase().startsWith('es') ? CINEMATIC_RULES_ES : CINEMATIC_RULES_EN;
}

export function matchCinematicMessage(errorText: string, locale: string): CinematicMessage {
	const normalized = errorText.trim();
	const rules = getCinematicRules(locale);
	for (const rule of rules) {
		if (rule.patterns.some((pattern) => pattern.test(normalized))) {
			const lines = pickVariant(rule.variants, `${rule.id}:${normalized}`);
			return { id: rule.id, lines };
		}
	}
	if (locale.toLowerCase().startsWith('es')) {
		return { id: 'fallback', lines: pickVariant(FALLBACK_VARIANTS_ES, normalized) };
	}
	return { id: 'fallback', lines: pickVariant(FALLBACK_VARIANTS_EN, normalized) };
}

function pickVariant(variants: string[][], seed: string): string[] {
	if (variants.length === 0) {
		return [];
	}
	const index = stableHash(seed) % variants.length;
	return [...variants[index]];
}

function stableHash(value: string): number {
	let hash = 5381;
	for (let i = 0; i < value.length; i += 1) {
		hash = (hash * 33) ^ (value.codePointAt(i) ?? 0);
	}
	return Math.abs(hash);
}

export function formatCinematicMessage(message: CinematicMessage): string {
	return message.lines.join('\n');
}
