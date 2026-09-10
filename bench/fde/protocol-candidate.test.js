import { it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { emptyState } from '../../dist/core/state.js';
import { reserveRun, writeRunEvidence } from '../../dist/core/run-id.js';
import { productHash, validateCandidate } from './protocol.js';

function candidateFixture(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-candidate-reservation-'));
  const repo = path.join(directory, 'project'), home = path.join(directory, 'home');
  for (const name of ['dist', 'skills', 'hooks', 'src', '.vibe']) fs.mkdirSync(path.join(repo, name), { recursive: true });
  fs.mkdirSync(home);
  const files = { 'package.json': '{"version":"4.1.26"}', 'card.md': '# Fixture', 'src/app.js': 'export const fixture = true;',
    '.vibe/intent.md': '# Fixed contract', '.vibe/scenarios.yaml': '[]' };
  for (const [file, content] of Object.entries(files)) fs.writeFileSync(path.join(repo, file), content);
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home,
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(home, 'no-global-config') } }).trim();
  try {
    git('init', '-q'); git('config', 'core.excludesFile', path.join(home, 'no-ignores'));
    git('add', '.'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture');
    run(repo, { candidateRevision: git('rev-parse', 'HEAD'), products: { candidate: productHash(repo) } });
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

it('accepts real exclusive run reservations and their evidence without changing the frozen product', () => {
  candidateFixture((repo, protocol) => {
    expect(() => validateCandidate(protocol, repo)).not.toThrow();
    const first = reserveRun(repo, emptyState());
    writeRunEvidence(repo, first, { fixture: true });
    const second = reserveRun(repo, emptyState());
    expect([first, second]).toEqual(['r-1', 'r-2']);
    expect(fs.readFileSync(path.join(repo, '.vibe/runs/r-1'), 'utf8')).toBe('');
    expect(() => validateCandidate(protocol, repo)).not.toThrow();
    fs.writeFileSync(path.join(repo, '.vibe/runs/r-2'), 'not a reservation');
    expect(() => validateCandidate(protocol, repo)).toThrow('run reservation must be an empty regular file');
  });
}, 60_000);

it('still rejects source, contract and unrelated files under the reservation directory', () => {
  candidateFixture((repo, protocol) => {
    for (const file of ['src/app.js', '.vibe/intent.md', '.vibe/scenarios.yaml', '.vibe/runs/script.js', '.vibe/runs/r-1.json', '.vibe/runs/r-1/nested.js']) {
      const target = path.join(repo, file), original = fs.existsSync(target) ? fs.readFileSync(target) : null;
      fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, 'changed');
      expect(() => validateCandidate(protocol, repo)).toThrow('candidate source has edits outside generated verification/cohort evidence');
      if (original) fs.writeFileSync(target, original); else fs.unlinkSync(target);
    }
    expect(() => validateCandidate(protocol, repo)).not.toThrow();
  });
}, 60_000);
