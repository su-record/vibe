/**
 * 릴리스 입구가 둘이 됐다 — 두 입구가 같은 것을 게시해야 한다.
 *
 * `release.yml` 은 원래 `push: tags` 하나였다. 태그를 밀 수 없는 환경(에이전트 세션의
 * 이그레스 정책 등)에서도 릴리스할 수 있게 `workflow_dispatch` 를 더했는데, **입구가
 * 둘이 되면 조용히 갈라진다**: 한쪽 경로만 틀린 태그로 게시되거나, 한쪽만 검사를 건너뛴다.
 *
 * 그래서 고정하는 것은 "dispatch 가 있다" 가 아니라 **두 경로가 같은 태그 이름을 쓰고,
 * 새 입구가 기존 입구의 검사를 그대로 갖는다** 는 것이다.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const WORKFLOW = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'release.yml'), 'utf-8');

describe('입구 두 개', () => {
  it('태그 push 입구가 남아 있다 — scripts/release.sh 흐름을 깨지 않는다', () => {
    expect(WORKFLOW).toMatch(/push:\s*\n\s*tags: \['v\*'\]/);
  });

  it('workflow_dispatch 입구가 version 입력을 필수로 받는다', () => {
    expect(WORKFLOW).toContain('workflow_dispatch:');
    expect(WORKFLOW).toMatch(/version:/);
    expect(WORKFLOW).toMatch(/required: true/);
  });
});

describe('태그 이름은 한 곳에서 만든다', () => {
  it('RELEASE_TAG 를 워크플로 env 로 한 번만 정의한다', () => {
    const occurrences = WORKFLOW.match(/^\s*RELEASE_TAG:/gm) ?? [];
    expect(occurrences).toHaveLength(1);
  });

  it('두 경로를 한 표현식에서 갈라 같은 변수로 모은다', () => {
    expect(WORKFLOW).toMatch(/RELEASE_TAG: \$\{\{[^\n]*workflow_dispatch[^\n]*github\.ref_name[^\n]*\}\}/);
  });

  it('태그를 쓰는 스텝이 GITHUB_REF_NAME 을 직접 읽지 않는다', () => {
    // 직접 읽으면 dispatch 경로에서 브랜치 이름(main)이 태그로 쓰인다
    expect(WORKFLOW).not.toContain('GITHUB_REF_NAME');
  });

  it('릴리스 노트·GitHub Release 가 RELEASE_TAG 를 쓴다', () => {
    expect(WORKFLOW).toMatch(/generate-release-notes\.js "\$RELEASE_TAG"/);
    expect(WORKFLOW).toMatch(/gh release create "\$RELEASE_TAG"/);
  });
});

describe('새 입구가 기존 검사를 그대로 갖는다', () => {
  // scripts/release.sh 가 태그를 밀기 전에 확인하는 것들. dispatch 는 그 스크립트를
  // 거치지 않으므로 워크플로 안에서 같은 것을 확인해야 한다.
  const guard = WORKFLOW.slice(WORKFLOW.indexOf('Guard (dispatch'), WORKFLOW.indexOf('Install dependencies'));

  it('main 에서만 돈다', () => {
    expect(guard).toContain('refs/heads/main');
  });

  it('입력 버전이 package.json 과 일치하는지 본다', () => {
    expect(guard).toMatch(/package\.json/);
    expect(guard).toContain('PKG_TAG');
  });

  it('같은 태그가 이미 있으면 멈춘다 — 같은 버전을 두 번 게시하지 않는다', () => {
    expect(guard).toMatch(/rev-parse[^\n]*refs\/tags/);
  });

  it('가드는 dispatch 경로에만 걸린다 — 태그 push 경로를 늦추지 않는다', () => {
    expect(guard).toContain("if: github.event_name == 'workflow_dispatch'");
  });
});

describe('재귀·조기 태그 방지', () => {
  const stepOrder = (name: string): number => WORKFLOW.indexOf(name);

  it('태그 생성이 테스트 뒤에 온다 — 깨진 빌드에 태그를 남기지 않는다', () => {
    expect(stepOrder('Run vitest')).toBeLessThan(stepOrder('Create tag (dispatch'));
  });

  it('태그 생성이 publish 앞에 온다 — 게시된 버전에 태그가 없는 상태를 만들지 않는다', () => {
    expect(stepOrder('Create tag (dispatch')).toBeLessThan(stepOrder('Publish to npm'));
  });

  it('GITHUB_TOKEN 이 워크플로를 재귀 호출하지 않는다는 근거를 본문에 남긴다', () => {
    // 이 사실이 깨지면 같은 버전이 두 번 게시된다. 주석이 곧 경고다.
    expect(WORKFLOW).toMatch(/GITHUB_TOKEN[^\n]*트리거하지 않는다|재귀 방지/);
  });

  it('태그 생성 스텝도 dispatch 경로에만 걸린다', () => {
    const createTag = WORKFLOW.slice(stepOrder('Create tag (dispatch'), stepOrder('Generate release notes'));
    expect(createTag).toContain("if: github.event_name == 'workflow_dispatch'");
  });
});
