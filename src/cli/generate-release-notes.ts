#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

import {
  createReleaseNotes,
  type ReleaseCommit,
  type ReleaseNotesInput,
  type ReleaseSpec,
  selectChangedSpecPaths,
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
  // pathspec 을 주지 않는 이유: `-- .vibe/specs` 로 제한하면 rename 의 **원본**이
  // pathspec 밖에 있을 때(예: `.claude/vibe/specs/` → `.vibe/specs/`) git 이 짝을
  // 찾지 못해 R100 대신 A 로 보고한다. 그러면 순수 이동이 신규 SPEC 으로 새어든다.
  // 전체 트리에서 rename 을 해석한 뒤 selectChangedSpecPaths 가 경로를 필터링한다.
  const nameStatus = git(['diff', '--name-status', '-M', '--diff-filter=AMR', range]);
  return selectChangedSpecPaths(nameStatus)
    .map((path): ReleaseSpec => ({ path, content: git(['show', `${currentTag}:${path}`]) }));
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
