import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VibeError } from './errors.js';
import { profileFile } from './profile.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-profile-'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('profile — anomalies first, with numbers', () => {
  it('profile: columns, types, missing, duplicates and at most three anomalies from a CSV', () => {
    fs.writeFileSync(path.join(root, 'orders.csv'), [
      'order_id,date,amount,status,memo',
      '1,2026-09-01,1200,paid,',
      '2,2026-09-01,,paid,',
      '3,2026-09-02,300,n/a,',
      '3,2026-09-02,300,n/a,',
      '4,2026-09-03,abc,paid,',
    ].join('\n'));
    const p = profileFile(root, 'orders.csv');
    expect(p).toMatchObject({ format: 'csv', rows: 5, duplicateRows: 1 });
    const by = Object.fromEntries(p.columns.map((c) => [c.name, c]));
    expect(by['order_id']).toMatchObject({ type: 'number', min: 1, max: 4, distinct: 4, missing: 0 });
    expect(by['date']?.type).toBe('date');
    expect(by['amount']).toMatchObject({ type: 'mixed', missing: 1 });
    expect(by['memo']?.type).toBe('empty');
    expect(p.anomalies).toHaveLength(3);
    expect(p.anomalies[0]).toBe('1 duplicate rows (identical in every column)');
    expect(p.anomalies).toContainEqual('column "amount" mixes number and string');
  });

  it('profile: JSONL gains columns as they appear; unknown extensions are refused with the CSV hint', () => {
    fs.writeFileSync(path.join(root, 'rows.jsonl'), '{"a":1}\n{"a":2,"b":true}\n');
    const p = profileFile(root, 'rows.jsonl');
    expect(p.columns.map((c) => c.name)).toEqual(['a', 'b']);
    expect(p.columns[1]).toMatchObject({ type: 'boolean', missing: 1 });
    fs.writeFileSync(path.join(root, 'orders.xlsx'), 'PK');
    expect(() => profileFile(root, 'orders.xlsx')).toThrowError(VibeError);
    expect(() => profileFile(root, 'orders.xlsx')).toThrowError(/export spreadsheets as CSV/);
  });
});
