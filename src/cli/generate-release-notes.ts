#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

import {
  createReleaseNotes,
  type ReleaseCommit,
  type ReleaseNotesInput,
  type ReleaseSpec,
  selectPreviousSemanticTag,
} from '../tools/release/releaseNotes.js';

const FIELD_SEPARATOR = '\u001f';
const RECORD_SEPARATOR = '\u001e';

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function parseCommits(raw: string): ReleaseCommit[] {
  return raw.split(RECORD_SEPARATOR)
    .map((record): string => record.trim())
    .filter((record): boolean => Boolean(record))
    .map((record): ReleaseCommit => {
    const [subject = '', body = ''] = record.split(FIELD_SEPARATOR);
    return { subject: subject.trim(), body: body.trim() };
  });
}

function loadSpecs(range: string, currentTag: string): ReleaseSpec[] {
  const paths = git(['diff', '--name-only', '--diff-filter=AMR', range, '--', '.vibe/specs'])
    .split('\n')
    .map((path): string => path.trim())
    .filter((path): boolean => path.endsWith('.md'));
  return paths.map((path): ReleaseSpec => ({ path, content: git(['show', `${currentTag}:${path}`]) }));
}

function validatePackageVersion(currentTag: string): void {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { version?: unknown };
  if (packageJson.version !== currentTag.slice(1)) {
    throw new Error(`Tag ${currentTag} does not match package version ${String(packageJson.version)}`);
  }
}

function loadReleaseInput(currentTag: string): ReleaseNotesInput {
  validatePackageVersion(currentTag);
  const tags = git(['tag', '--merged', currentTag]).split('\n').filter((tag): boolean => Boolean(tag));
  const previousTag = selectPreviousSemanticTag(tags, currentTag);
  const range = `${previousTag}..${currentTag}`;
  const rawCommits = git(['log', range, `--format=%s${FIELD_SEPARATOR}%b${RECORD_SEPARATOR}`]);
  return { currentTag, previousTag, specs: loadSpecs(range, currentTag), commits: parseCommits(rawCommits) };
}

function main(args: string[]): void {
  const [currentTag, outputPath] = args;
  if (!currentTag || !outputPath) throw new Error('Usage: generate-release-notes <tag> <output-file>');
  writeFileSync(outputPath, createReleaseNotes(loadReleaseInput(currentTag)), 'utf8');
}

main(process.argv.slice(2));
