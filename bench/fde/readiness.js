import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { privateAclCause } from './private-artifacts.js';

export function requireCI(records, revision) {
  for (const platform of ['linux', 'windows']) {
    if (!/^[a-f0-9]{40}$/.test(revision ?? '') || !records?.some((entry) => entry.platform === platform && entry.revision === revision && entry.status === 'passed' && entry.url && entry.at)) throw new Error(`CI_REQUIRED_${platform.toUpperCase()}`);
  }
}

export function checkMigrationDocument(file) {
  if (!fs.existsSync(file)) throw new Error('MIGRATION_DOCUMENT_MISSING');
  const text = fs.readFileSync(file, 'utf8');
  if (!/upgrade|migration/i.test(text) || !/rollback/i.test(text) || text.trim().length < 50) throw new Error('MIGRATION_DOCUMENT_BOUNDARIES_MISSING');
}

export function compatibility(repo, records) {
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
  requireCI(records, revision);
  checkMigrationDocument(path.join(repo, 'docs/check-consent.md'));
  return revision;
}

const readinessCodes = new Set(['CI_REQUIRED_LINUX', 'CI_REQUIRED_WINDOWS', 'MIGRATION_DOCUMENT_MISSING', 'MIGRATION_DOCUMENT_BOUNDARIES_MISSING']);
export const readinessCause = (error) => readinessCodes.has(error?.message) ? error.message : privateAclCause(error);
