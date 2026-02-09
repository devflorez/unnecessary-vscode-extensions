export type EolKind = 'lf' | 'crlf' | 'auto';
export type Mode = 'detectOnly' | 'askBeforeFix' | 'fixOnSave';
export type ExpectedEolSource = 'editorconfig' | 'settings' | 'auto';

export type ExpectedEolResult = {
	expected: EolKind;
	source: ExpectedEolSource;
};

export type DecisionInput = {
	currentEol: 'lf' | 'crlf';
	expected: EolKind;
	mode: Mode;
	cooldownSeconds: number;
	nowMs: number;
	lastNotifiedAt: number | null;
	ignored: boolean;
};

export type DecisionResult = {
	action: 'none' | 'warn' | 'prompt' | 'fix';
	reason?: string;
};

export function mapEolEnum(eolEnum: 1 | 2): 'lf' | 'crlf' {
	return eolEnum === 2 ? 'crlf' : 'lf';
}

export function resolveExpectedEol(
	settingsExpected: EolKind,
	editorconfigEol: 'lf' | 'crlf' | null | undefined,
	respectEditorConfig: boolean,
): ExpectedEolResult {
	if (respectEditorConfig && editorconfigEol) {
		return { expected: editorconfigEol, source: 'editorconfig' };
	}
	if (settingsExpected === 'auto') {
		return { expected: 'auto', source: 'auto' };
	}
	return { expected: settingsExpected, source: 'settings' };
}

export function convertTextEol(text: string, target: 'lf' | 'crlf'): string {
	const normalized = text.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
	if (target === 'lf') {
		return normalized;
	}
	return normalized.replaceAll('\n', '\r\n');
}

export function decideAction(input: DecisionInput): DecisionResult {
	if (input.expected === 'auto') {
		return { action: 'none', reason: 'auto' };
	}
	if (input.currentEol === input.expected) {
		return { action: 'none', reason: 'match' };
	}

	if (input.mode === 'fixOnSave') {
		return { action: 'fix', reason: 'fixOnSave' };
	}

	if (input.ignored) {
		return { action: 'none', reason: 'ignored' };
	}

	if (input.lastNotifiedAt !== null) {
		const elapsed = input.nowMs - input.lastNotifiedAt;
		if (elapsed < input.cooldownSeconds * 1000) {
			return { action: 'none', reason: 'cooldown' };
		}
	}

	return {
		action: input.mode === 'askBeforeFix' ? 'prompt' : 'warn',
	};
}
