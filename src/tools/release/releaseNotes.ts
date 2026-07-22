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
  return [
    `# ${input.currentTag}`,
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
