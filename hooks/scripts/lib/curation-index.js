/**
 * Phase 3 — Curation index loader
 *
 * `.vibe/recipes/*.md` 와 `.vibe/anti-patterns/*.md` 의 frontmatter 만 parse 해
 * 1줄 요약 인덱스를 만든다. 본문은 읽지 않음 (세션 컨텍스트 절약).
 *
 * SPEC 결정:
 *   - INDEX.jsonl 미사용. 디렉토리 스캔 + frontmatter parse 가 충분히 빠르다 (<100 파일).
 *   - 최근 N=5 상한 (created 내림차순).
 *
 * 의도적 제한:
 *   - 본격 YAML parser 의존성 추가 거부. 우리가 *직접 작성*한 frontmatter 만
 *     읽으므로 문법이 정해져 있다. 라인별 정규식이면 충분.
 */
import fs from 'fs';
import path from 'path';
import { projectVibeRoot } from '../utils.js';

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/;
// "key: value" 또는 'key: "quoted value"' (이스케이프 \\" 포함)
const FIELD_RE = /^([a-z][a-z0-9_-]*):\s*(?:"((?:[^"\\]|\\.)*)"|(.+?))\s*$/;

function parseFrontmatter(content) {
  const m = FRONTMATTER_RE.exec(content);
  if (!m) return null;
  const fields = {};
  for (const line of m[1].split('\n')) {
    const fm = FIELD_RE.exec(line);
    if (!fm) continue;
    const key = fm[1];
    const value = fm[2] !== undefined ? fm[2].replace(/\\"/g, '"') : fm[3];
    fields[key] = value;
  }
  return fields;
}

function readHead(filePath, bytes = 2048) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(bytes);
    const n = fs.readSync(fd, buf, 0, bytes, 0);
    return buf.toString('utf-8', 0, n);
  } finally {
    fs.closeSync(fd);
  }
}

function listMd(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_') && f !== 'README.md')
    .map((f) => path.join(dir, f));
}

function safeParse(filePath) {
  try {
    const head = readHead(filePath);
    const fields = parseFrontmatter(head);
    if (!fields || !fields.slug) return null;
    return fields;
  } catch {
    return null;
  }
}

function compareCreatedDesc(a, b) {
  // created 가 ISO 면 문자열 비교로 시간 정렬 가능, 아니면 mtime fallback
  return (b.created || '').localeCompare(a.created || '');
}

/**
 * 프로젝트의 recipes + anti-patterns 인덱스를 로드.
 * @returns { recipes: [{slug, summary}], antiPatterns: [{tag, summary}] }
 */
export function loadCurationIndex(projectDir, opts = {}) {
  const { recipeLimit = 5, antiPatternLimit = 5 } = opts;
  const root = projectVibeRoot(projectDir);

  const recipes = listMd(path.join(root, 'recipes'))
    .map(safeParse).filter(Boolean)
    .sort(compareCreatedDesc)
    .slice(0, recipeLimit)
    .map((f) => ({
      slug: f.slug,
      summary: f.recipe || f['symptom-context'] || '(no summary)',
    }));

  const antiPatterns = listMd(path.join(root, 'anti-patterns'))
    .map(safeParse).filter(Boolean)
    .sort(compareCreatedDesc)
    .slice(0, antiPatternLimit)
    .map((f) => ({
      tag: f['root-cause-tag'] || 'other',
      summary: f['suggested-stop'] || f['trigger-signature'] || '(no summary)',
    }));

  return { recipes, antiPatterns };
}

/** Test-only: frontmatter parser 노출 */
export const _internal = { parseFrontmatter };
