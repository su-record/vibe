import { expect, it } from 'vitest';
import { isHandoffOnly } from './handoff-results.js';

it('only handoffs and their blocked dependents qualify for a handoff-only next step', () => {
  expect(isHandoffOnly([])).toBe(false);
  expect(isHandoffOnly([{ id: 'deployment', last: 'blocked' }])).toBe(false);
  expect(isHandoffOnly([{ id: 'input', last: 'handoff' }, { id: 'deployment', last: 'blocked' }])).toBe(false);
  expect(isHandoffOnly([{ id: 'input', last: 'handoff' }, { id: 'build', needs: ['input'], last: 'blocked' }, { id: 'proof', needs: ['build'], last: 'blocked' }])).toBe(true);
  expect(isHandoffOnly([{ id: 'input', last: 'handoff' }, { id: 'build', needs: ['input'], last: 'pending' }])).toBe(false);
});
