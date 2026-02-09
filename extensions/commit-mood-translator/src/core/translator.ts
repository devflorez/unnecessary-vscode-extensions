export type Mood = {
	id: string;
	label: string;
	template: string;
	description?: string;
};

export type MoodConfig = {
	label: string;
	template: string;
	description?: string;
};

export const DEFAULT_MOODS_EN: readonly Mood[] = [
	{
		id: 'corporate',
		label: 'Corporate',
		template: '[Corporate] 📈 {message} (aligned with priorities)',
		description: 'Polished, formal tone',
	},
	{
		id: 'honest',
		label: 'Honest',
		template: '[Honest] 😅 {message} (no promises)',
		description: 'Candid and direct',
	},
	{
		id: 'panic',
		label: 'Panic',
		template: '[Panic] 😬 {message} (send help)',
		description: 'Urgent and stressed',
	},
	{
		id: 'optimistic',
		label: 'Optimistic',
		template: '[Optimistic] ✨ {message} (should be smoother now)',
		description: 'Hopeful and upbeat',
	},
	{
		id: 'passive-aggressive',
		label: 'Passive Aggressive',
		template: '[Passive Aggressive] 🙃 {message} (as expected)',
		description: 'Dry and pointed',
	},
];

export const DEFAULT_MOODS_ES: readonly Mood[] = [
	{
		id: 'corporate',
		label: 'Corporativo',
		template: '[Corporativo] 📈 {message} (alineado con prioridades)',
		description: 'Tono formal y pulido',
	},
	{
		id: 'honest',
		label: 'Honesto',
		template: '[Honesto] 😅 {message} (sin prometer milagros)',
		description: 'Directo y sincero',
	},
	{
		id: 'panic',
		label: 'Pánico',
		template: '[Pánico] 😬 {message} (ayuda urgente)',
		description: 'Urgente y estresado',
	},
	{
		id: 'optimistic',
		label: 'Optimista',
		template: '[Optimista] ✨ {message} (debería ir mejor ahora)',
		description: 'Esperanzado y positivo',
	},
	{
		id: 'passive-aggressive',
		label: 'Pasivo agresivo',
		template: '[Pasivo agresivo] 🙃 {message} (como era de esperarse)',
		description: 'Seco y sarcástico',
	},
];

export function normalizeMessage(message: string): string {
	const trimmed = message.trim().replaceAll(/\s+/g, ' ');
	if (!trimmed) {
		return '';
	}
	return trimmed[0].toUpperCase() + trimmed.slice(1);
}

export function applyTemplate(template: string, message: string): string {
	if (template.includes('{message}')) {
		return template.replace('{message}', message);
	}
	return `${template} ${message}`.trim();
}

export function translateCommitMessage(message: string, mood: Mood): string {
	const normalized = normalizeMessage(message);
	return applyTemplate(mood.template, normalized).trim();
}

export function getDefaultMoods(language: string): readonly Mood[] {
	const normalized = language.toLowerCase();
	if (normalized.startsWith('es')) {
		return DEFAULT_MOODS_ES;
	}
	return DEFAULT_MOODS_EN;
}

export function resolveMoods(
	custom: MoodConfig[] | undefined,
	fallback: readonly Mood[] = DEFAULT_MOODS_EN,
): Mood[] {
	if (!custom || custom.length === 0) {
		return [...fallback];
	}

	const filtered = custom
		.map((entry) => ({
			label: entry.label?.trim() ?? '',
			template: entry.template?.trim() ?? '',
			description: entry.description?.trim() || undefined,
		}))
		.filter((entry) => entry.label.length > 0 && entry.template.length > 0)
		.map((entry) => ({
			id: buildMoodId(entry.label),
			label: entry.label,
			template: entry.template,
			description: entry.description,
		}));

	return filtered.length > 0 ? filtered : [...fallback];
}

function buildMoodId(label: string): string {
	return label
		.toLowerCase()
		.replaceAll(/\s+/g, '-')
		.replaceAll(/[^a-z0-9-]/g, '')
		.replaceAll(/-+/g, '-');
}
