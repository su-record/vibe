import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cmdMap } from '../cli/map.js';
import { detectCapabilities, proposeTools } from './capabilities.js';

let root: string;
let home: string;
const savedPath = process.env['PATH'];
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-cap-'));
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-cap-home-'));
  fs.writeFileSync(path.join(root, 'a.ts'), 'export function a(): number { return 1; }\n');
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(home, { recursive: true, force: true });
  process.env['PATH'] = savedPath;
  delete process.env['VIBE_HOME_DIR'];
});

/** A PATH holding only node and a fake `graft` that answers --version and `map`. */
function fakeGraftOnly(): void {
  const bin = path.join(home, 'bin');
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, 'graft'), `#!${process.execPath}\nconst a = process.argv.slice(2);\nif (a[0] === '--version') { process.stdout.write('graft 0.17.0\\n'); process.exit(0); }\nprocess.stdout.write('GRAFT-MAP ' + a.join(' ') + '\\n');\n`, { mode: 0o755 });
  process.env['PATH'] = `${bin}${path.delimiter}${path.dirname(process.execPath)}`;
  process.env['VIBE_HOME_DIR'] = home;
}

describe('capabilities — one convention for other harnesses', () => {
  it('detection: graft present with what it serves and pdftotext absent with the fallback; vibe map says it used graft', () => {
    fakeGraftOnly();
    const all = detectCapabilities(root, home);
    const graft = all.find((c) => c.tool === 'graft')!;
    expect(graft.present).toBe(true);
    expect(graft.detail).toContain('graft 0.17.0');
    expect(graft.serves).toEqual(['map', 'callers', 'blast']);
    const pdf = all.find((c) => c.tool === 'pdftotext')!;
    expect(pdf.present).toBe(false);
    expect(pdf.fallback).toContain('built-in');
    const out = cmdMap(root, ['.'], {});
    expect(out.text.startsWith('(via graft)')).toBe(true);
    expect(out.text).toContain('GRAFT-MAP map .');
  });

  it('proposals: a large repository without a graph proposes graft; a design review without a screenshot tool proposes agent-browser; both quiet when present', () => {
    process.env['VIBE_NO_TOOLS'] = '1'; // this machine may hold a screenshot tool next to node
    process.env['VIBE_HOME_DIR'] = home;
    const other = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-cap-other-'));
    const proposals = proposeTools(other, { files: 500, design: true });
    expect(proposals.map((p) => p.tool)).toEqual(['graft', 'agent-browser']);
    expect(proposals[0]?.why).toContain('500 source files');
    expect(proposals[0]?.install).toContain('graft init');
    expect(proposeTools(other, { files: 20, design: false })).toEqual([]);
    fs.rmSync(other, { recursive: true, force: true });
    delete process.env['VIBE_NO_TOOLS'];
  });
});
