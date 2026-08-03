/**
 * 복잡도 부채의 결정론적 라쳇 게이트.
 *
 * CLAUDE.md 는 함수 ≤50줄 · 중첩 ≤3 · 복잡도 ≤10 을 하드룰로 선언하지만
 * 저장소에는 이미 수백 건의 위반이 있다. 전부 고치는 것은 별개의 대형 작업이므로,
 * 여기서는 **부채가 늘어나지 않는 것**만 기계로 강제한다.
 *
 * - 규칙별 위반 건수가 baseline 을 넘으면 exit 1 (회귀 차단)
 * - baseline 아래로 내려가면 통과하고, baseline 을 조일 것을 안내한다
 * - `--update` 로 baseline 을 현재 수치로 다시 쓴다 (감소 방향으로만 의미 있음)
 *
 * "선언은 있는데 게이트가 없다" 는 상태를 없애는 것이 목적이므로,
 * 규칙을 끄는 것이 아니라 세는 것으로 해결한다.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = join(REPO_ROOT, '.oxlint-baseline.json');

/** 라쳇이 추적하는 규칙 — CLAUDE.md 복잡도 한계와 1:1 대응한다. */
const RATCHETED_RULES = [
  'eslint(complexity)',
  'eslint(max-depth)',
  'eslint(max-lines-per-function)',
] as const;

interface OxlintDiagnostic {
  code: string;
  severity: string;
}

interface Baseline {
  _comment: string;
  counts: Record<string, number>;
}

function collectCounts(): Record<string, number> {
  let raw: string;
  try {
    raw = execFileSync('./node_modules/.bin/oxlint', ['--format=json'], {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    // oxlint 는 위반이 있으면 비정상 종료하지만 stdout 에 JSON 을 남긴다.
    const stdout = (error as { stdout?: string }).stdout;
    if (!stdout) throw error;
    raw = stdout;
  }

  const parsed = JSON.parse(raw) as { diagnostics: OxlintDiagnostic[] };
  const counts: Record<string, number> = {};
  for (const rule of RATCHETED_RULES) counts[rule] = 0;
  for (const diagnostic of parsed.diagnostics) {
    if (diagnostic.code in counts) counts[diagnostic.code] += 1;
  }
  return counts;
}

function readBaseline(): Baseline | null {
  if (!existsSync(BASELINE_PATH)) return null;
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')) as Baseline;
}

function writeBaseline(counts: Record<string, number>): void {
  const baseline: Baseline = {
    _comment:
      'CLAUDE.md 복잡도 한계 위반의 상한선. scripts/lint-ratchet.ts 가 강제한다. 숫자는 줄이는 방향으로만 갱신한다 — 늘리려면 그 이유가 리뷰에서 정당화돼야 한다.',
    counts,
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
}

function main(): void {
  const counts = collectCounts();
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  if (process.argv.includes('--update')) {
    writeBaseline(counts);
    console.log(`✓ baseline updated — ${total} complexity violations recorded.`);
    for (const [rule, count] of Object.entries(counts)) console.log(`    ${rule}: ${count}`);
    return;
  }

  const baseline = readBaseline();
  if (!baseline) {
    console.error('✗ .oxlint-baseline.json is missing. Run: pnpm lint:ratchet --update');
    process.exit(1);
  }

  const regressions: string[] = [];
  const improvements: string[] = [];
  for (const rule of RATCHETED_RULES) {
    const now = counts[rule];
    const allowed = baseline.counts[rule] ?? 0;
    if (now > allowed) regressions.push(`    ${rule}: ${allowed} → ${now} (+${now - allowed})`);
    else if (now < allowed) improvements.push(`    ${rule}: ${allowed} → ${now} (-${allowed - now})`);
  }

  if (regressions.length > 0) {
    console.error('✗ complexity ratchet: new violations introduced.\n');
    console.error(regressions.join('\n'));
    console.error(
      '\n  CLAUDE.md limits: function ≤50 lines · nesting ≤3 · cyclomatic ≤10.',
    );
    console.error('  Fix the new violations, or justify raising the baseline in review.');
    process.exit(1);
  }

  if (improvements.length > 0) {
    console.log('✓ complexity ratchet passed — debt decreased.\n');
    console.log(improvements.join('\n'));
    console.log('\n  Tighten the baseline: pnpm lint:ratchet --update');
    return;
  }

  console.log(`✓ complexity ratchet passed — ${total} known violations, none new.`);
}

main();
