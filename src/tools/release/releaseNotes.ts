export interface ReleaseCommit {
  subject: string;
  body: string;
}

export interface ReleaseSpec {
  path: string;
  content: string;
}

export interface ReleaseNotesInput {
  currentTag: string;
  previousTag: string;
  specs: ReleaseSpec[];
  commits: ReleaseCommit[];
}

type ReleaseSection = 'Breaking' | 'Added' | 'Fixed' | 'Changed' | 'Documentation' | 'Internal';
export type ClassifiedCommits = Record<ReleaseSection, string[]>;

const SEMANTIC_TAG = /^v(\d+)\.(\d+)\.(\d+)$/;
const VERSION_COMMIT = /^(?:v?\d+\.\d+\.\d+|chore(?:\(release\))?:\s*v?\d+\.\d+\.\d+)$/i;
const CONVENTIONAL_SUBJECT = /^([a-z]+)(?:\([^)]+\))?(!)?:\s*(.+)$/i;
const SECTION_ORDER: ReleaseSection[] = [
  'Breaking', 'Added', 'Fixed', 'Changed', 'Documentation', 'Internal',
];
const TYPE_TO_SECTION: Record<string, ReleaseSection> = {
  feat: 'Added',
  fix: 'Fixed',
  docs: 'Documentation',
  refactor: 'Internal',
  chore: 'Internal',
  test: 'Internal',
  ci: 'Internal',
  build: 'Internal',
  perf: 'Changed',
  style: 'Changed',
};

function parseTag(tag: string): [number, number, number] | undefined {
  const match = SEMANTIC_TAG.exec(tag);
  if (!match) return undefined;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareVersions(left: number[], right: number[]): number {
  for (let index = 0; index < left.length; index += 1) {
    const difference = left[index] - right[index];
    if (difference !== 0) return difference;
  }
  return 0;
}

export function selectPreviousSemanticTag(tags: string[], currentTag: string): string {
  const current = parseTag(currentTag);
  if (!current) throw new Error(`Invalid release tag: ${currentTag}`);
  const candidates = tags
    .map((tag): { tag: string; version: [number, number, number] | undefined } =>
      ({ tag, version: parseTag(tag) }))
    .filter((item): item is { tag: string; version: [number, number, number] } =>
      item.version !== undefined && compareVersions(item.version, current) < 0)
    .sort((left, right): number => compareVersions(right.version, left.version));
  if (!candidates[0]) throw new Error(`No previous semantic tag found for ${currentTag}`);
  return candidates[0].tag;
}

/** SPEC 으로 인정하는 경로 접두사 — 레거시 `.claude/vibe/specs/` 는 제외(이전 원본) */
const SPEC_PATH_PREFIX = '.vibe/specs/';

/**
 * `git diff --name-status -M --diff-filter=AMR <range>` 출력에서
 * **이번 릴리즈의 SPEC**만 골라낸다.
 *
 * 경로 필터를 git pathspec 이 아니라 여기서 하는 이유: `-- .vibe/specs` 로
 * 제한하면 rename 의 원본이 pathspec 밖일 때 git 이 짝을 못 찾아 R100 대신 A 로
 * 보고하고, 순수 이동이 신규 SPEC 으로 새어든다.
 *
 * 제외 대상:
 * - `.vibe/specs/` 밖의 경로 (릴리즈 노트의 SPEC 이 아니다)
 * - `D` — 삭제된 SPEC (currentTag 에 없어 `git show` 가 실패한다)
 * - `R100`/`C100` — 내용이 그대로인 이동/개명. 디렉토리 재편(예: 레거시
 *   `.claude/vibe/specs/` → `.vibe/specs/`)만으로 몇 달 전 feature 가 신규
 *   Highlights 로 올라가면 릴리즈 노트가 사용자를 오인시킨다. 이동은 릴리즈
 *   내용이 아니다.
 *
 * `R` 중 유사도가 100 미만인 것(개명 + 실제 수정)은 신규 경로로 유지한다.
 *
 * @param nameStatus `--name-status` 원문 (pathspec 없이 전체 트리)
 * @returns currentTag 기준 SPEC 경로
 */
export function selectChangedSpecPaths(nameStatus: string): string[] {
  const paths: string[] = [];
  for (const line of nameStatus.split('\n')) {
    const fields = line.split('\t').map((field): string => field.trim());
    const status = fields[0];
    if (!status) continue;

    // rename/copy 는 `R100 old new` 형태 — 대상 경로는 마지막 필드
    const isRenameLike = /^[RC]\d*$/.test(status);
    const target = isRenameLike ? fields[2] : fields[1];
    if (!target || !target.endsWith('.md')) continue;
    if (!target.startsWith(SPEC_PATH_PREFIX)) continue;

    if (status.startsWith('D')) continue;
    if (isRenameLike && /^[RC]100$/.test(status)) continue;

    paths.push(target);
  }
  return paths;
}

function emptySections(): ClassifiedCommits {
  return { Breaking: [], Added: [], Fixed: [], Changed: [], Documentation: [], Internal: [] };
}

export function classifyCommits(commits: ReleaseCommit[]): ClassifiedCommits {
  return commits.reduce<ClassifiedCommits>((sections, commit): ClassifiedCommits => {
    if (commit.subject.startsWith('Merge ') || VERSION_COMMIT.test(commit.subject)) return sections;
    const match = CONVENTIONAL_SUBJECT.exec(commit.subject);
    if (!match) {
      sections.Changed.push(commit.subject);
      return sections;
    }
    const isBreaking = match[2] === '!' || /BREAKING[ -]CHANGE:/i.test(commit.body);
    const section = isBreaking ? 'Breaking' : (TYPE_TO_SECTION[match[1].toLowerCase()] ?? 'Changed');
    sections[section].push(match[3]);
    return sections;
  }, emptySections());
}

function extractSection(content: string, heading: string): string {
  const pattern = new RegExp(`^##\\s+[^\\n]*${heading}[^\\n]*\\n([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, 'im');
  return pattern.exec(content)?.[1]?.trim() ?? '';
}

function extractSpecHighlights(spec: ReleaseSpec): string[] {
  const title = /^#\s+(?:SPEC:\s*)?(.+)$/m.exec(spec.content)?.[1] ?? spec.path;
  const overview = extractSection(spec.content, 'Overview').split(/^###\s+/m)[0].trim();
  const requirements = extractSection(spec.content, 'Requirements')
    .split('\n')
    .filter((line): boolean => /^\|\s*REQ-[^|]+\|/.test(line))
    .map((line): string | undefined => line.split('|')[2]?.trim())
    .filter((value): value is string => Boolean(value));
  return [`### ${title}`, overview, ...requirements.map((requirement): string => `- ${requirement}`)]
    .filter((value): boolean => Boolean(value));
}

function renderCommitSections(sections: ClassifiedCommits): string[] {
  return SECTION_ORDER.flatMap((section): string[] => {
    const entries = sections[section];
    return entries.length > 0
      ? [`## ${section}`, ...entries.map((entry): string => `- ${entry}`)]
      : [];
  });
}

export function createReleaseNotes(input: ReleaseNotesInput): string {
  const sections = classifyCommits(input.commits);
  const highlights = input.specs.flatMap(extractSpecHighlights);
  const commitSections = renderCommitSections(sections);
  if (highlights.length === 0 && commitSections.length === 0) {
    throw new Error(`No release changes found in ${input.previousTag}..${input.currentTag}`);
  }
  // 태그 제목은 `gh release create --title` 이 설정한다. 본문에 `# {tag}` 를 다시
  // 넣으면 릴리스 페이지에서 제목이 두 번 렌더된다.
  return [
    '## Highlights',
    ...highlights,
    ...commitSections,
    '## Verification',
    `- Release range: \`${input.previousTag}..${input.currentTag}\``,
    `- Included commits: ${input.commits.length}`,
    '- Generated deterministically from repository history and specifications.',
    '',
  ].join('\n\n');
}
