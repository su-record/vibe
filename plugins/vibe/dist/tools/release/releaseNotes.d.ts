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
export declare function selectPreviousSemanticTag(tags: string[], currentTag: string): string;
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
export declare function selectChangedSpecPaths(nameStatus: string): string[];
export declare function classifyCommits(commits: ReleaseCommit[]): ClassifiedCommits;
export declare function createReleaseNotes(input: ReleaseNotesInput): string;
export {};
//# sourceMappingURL=releaseNotes.d.ts.map