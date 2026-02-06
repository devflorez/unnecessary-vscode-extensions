import * as assert from 'node:assert';

import { createInitialState } from '../core/streak';
import { DEFAULTS } from '../extension/config';
import { statusTooltip } from '../extension/status';

suite('Status tooltip', () => {
	test('includes thresholds and cooldown', () => {
		const tooltip = statusTooltip(DEFAULTS, createInitialState(), {
			bestStreak: 3,
			totalRecoveries: 1,
			totalMessages: 2,
		});
		assert.match(tooltip, /Thresholds/);
		assert.match(tooltip, /Cooldown/);
		assert.match(tooltip, /Best streak/);
	});
});
