---
name: vibe.discover
tier: core
description: "Iteratively interview the user to gather ALL required and optional requirements for a new project or feature. Loops until the user explicitly stops. Uses type-specific domain checklists (website, webapp, mobile, api, library, feature) so nothing is missed. Must use this skill when the user says '만들자', '개발하자', '신규 기능', '무엇을 만들', 'let's build', 'new feature', or starts describing a product idea without a plan yet."
triggers: [만들자, 개발하자, 기획하자, 신규 기능, 새 프로젝트, "무엇을 만들", "무엇을 개발", 아이디어, discover, requirements, "let's build", "new feature", "new project"]
priority: 95
chain-next: [vibe.plan]
---

# vibe.discover — Domain Requirements Interview

> **Principle**: 사용자가 "그만"이라고 말할 때까지 요구사항 도메인의 필수/옵션 정보를 전부 발굴한다. 얕은 질문 10개로 끝내지 않는다.

## When to Use

- 사용자가 새 프로젝트/기능 개발을 시작하려 함
- 기획서가 없는 상태에서 `/vibe.spec` 바로 가면 요구사항 누락 위험
- "만들자", "개발하자", "신규", "아이디어" 같은 자연어 트리거
- `/vibe.go` 또는 discovery 관련 커맨드의 진입점으로 호출됨

**건너뛰기**:
- 기존 프로젝트의 작은 버그 수정
- 이미 `.claude/vibe/plans/{feature}.md`가 존재하는 경우 (→ `vibe.plan` 갱신만)

## Core Loop

```
1. 프로젝트 타입 감지 (website|webapp|mobile|api|library|feature)
     ↓
2. 타입별 체크리스트 로드
     checklists/{type}.md
     Required 항목 + Optional 항목
     ↓
3. ┌─── 인터뷰 루프 ───┐
   │                   │
   │  한 번에 한 질문   │
   │       ↓           │
   │  사용자 답변       │
   │       ↓           │
   │  체크리스트 갱신   │
   │       ↓           │
   │  새 도메인 감지 시 │
   │  체크리스트 확장   │
   │       ↓           │
   │  Progress 표시    │
   │       ↓           │
   │  중단 감지? ──────┼─→ 종료
   │       │           │
   │       └───반복────┘
   └───────────────────┘
     ↓
4. 수집 결과 저장
   .claude/vibe/discovery/{feature}.md
     ↓
5. chain-next: vibe.plan
```

## Step 0: Git Branch (MANDATORY)

```bash
git branch --show-current
```

| 현재 | 행동 |
|-----|-----|
| `main`/`master` | `git checkout -b discover/{feature-name}` |
| `discover/*`, `feature/*` | 사용자 확인 |
| 기타 | 사용자 확인 |

**네이밍**: 소문자 + 하이픈, 접두사 `discover/`

## Step 1: 프로젝트 타입 감지

**1차 감지 — 키워드**:

| 키워드 | 타입 | 체크리스트 |
|-------|-----|-----------|
| website, landing, portfolio, 랜딩, 웹사이트, 홍보, 프로모션 | `website` | `checklists/website.md` |
| webapp, dashboard, SaaS, 대시보드, 관리자, tool | `webapp` | `checklists/webapp.md` |
| mobile, iOS, Android, 앱, native, Flutter, React Native | `mobile` | `checklists/mobile.md` |
| api, backend, server, rest, graphql, 서버, 백엔드 | `api` | `checklists/api.md` |
| library, sdk, cli, package, npm, 라이브러리 | `library` | `checklists/library.md` |
| feature, 기능, 추가, refactor | `feature` | `checklists/feature.md` |

**애매하면 한 질문으로 확인** (선택지 제공):

```
어떤 종류의 프로젝트인가요?

1. 웹사이트 (랜딩/포트폴리오/프로모션)
2. 웹앱 (대시보드/SaaS/도구)
3. 모바일 앱
4. API/백엔드
5. 라이브러리/SDK/CLI
6. 기존 프로젝트에 추가할 기능
```

## Step 2: 체크리스트 로드

해당 타입의 체크리스트 파일을 읽는다:

```
Read skills/vibe.discover/checklists/{type}.md
```

체크리스트는 **Required** 섹션과 **Optional** 섹션으로 나뉘며, 각 항목은 다음 구조:

```markdown
- [ ] ID: question-id
      질문: 사용자에게 할 질문 원문
      유형: required | optional
      힌트: 답변 예시 or 선택지
      follow-up: 답변에 따라 추가로 팔 수 있는 하위 질문들
```

**메모리에 상태 유지**:

```javascript
const state = {
  type: 'website',
  collected: {
    'purpose': '신제품 런칭 프로모션',
    'target-users': '홈카페 마니아',
    // ...
  },
  pending: {
    required: ['success-metric', 'launch-deadline', ...],
    optional: ['analytics', 'cms', 'i18n', ...]
  },
  discovered: [],  // 대화 중 새로 발견된 항목
  stopped: false
};
```

## Step 3: 인터뷰 루프

### 3.1 질문 규칙

- **한 번에 한 질문**. 결합 질문 금지.
- **선택지 + 자유 입력** 병행: "1. A  2. B  3. C  또는 자유롭게 설명"
- **고정 순서 없음**. 대화 흐름에 맞춰 pending에서 관련 있는 항목 우선.
- **짧게**. 배경 설명 1줄 + 질문 1줄.

### 3.2 답변 처리

- 답변을 `collected`에 저장
- 답변에서 추가 정보 추출 (예: "다크 모드 원해요" → `theme-preference=dark` 자동 기록)
- **새 도메인 감지**: 답변에 `pending`에 없는 영역이 등장 → `discovered`에 추가하고 질문 생성
  - 예: "결제도 필요해요" → `payment-provider`, `payment-methods`, `currency` 등 체크리스트 확장

### 3.3 Progress 표시 (매 3-5 질문마다)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Discovery Progress
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Required: 5/8
⚪ Optional: 2/14
➕ Discovered: 3 new items

다음 주제: {next-topic}

계속하려면 그냥 답변해주세요.
언제든 "그만", "충분해", "done"이라고 하시면 멈춥니다.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 3.4 중단 감지 (Stop Control)

**명시적 중단 키워드** (사용자 답변에 포함되면 `stopped = true`):

```
그만, 멈춰, 충분해, 됐어, 이제 됐다,
stop, done, enough, that's it, finish, skip
```

**묵시적 중단**:
- 동일 주제에 "몰라요"/"나중에" 3회 연속 → 자동 다음 주제
- Optional 항목에서 `Enter`만 입력 → 해당 항목 skip

**Required 미완료 시 경고**:

```
⚠️ 필수 항목 {N}개 남았습니다: {list}

그래도 중단하시겠습니까? (y/N)
미완료 항목은 기획서에 "TBD"로 표시됩니다.
```

### 3.5 단계 전환

- **Required → Optional**: Required 모두 채워지면 자동 전환
  ```
  ✅ 필수 요구사항 수집 완료!

  이제 옵션 항목을 확인하시겠습니까?
  (SEO, 분석, 다국어, 접근성 등 — 각 1-2질문)

  1. 네, 계속
  2. 핵심만 (3-5개 질문)
  3. 그만
  ```
- **Optional → 종료**: 모든 Optional 처리 or 사용자 중단

## Step 4: 수집 결과 저장

**출력 파일**: `.claude/vibe/discovery/{feature-name}.md`

**구조**:

```markdown
---
feature: {feature-name}
type: website | webapp | mobile | api | library | feature
status: complete | partial
startedAt: {ISO-timestamp}
completedAt: {ISO-timestamp}
requiredCollected: 8/8
optionalCollected: 12/14
stoppedBy: user | auto
---

# Discovery: {feature-name}

## Required Requirements

### purpose
**Q**: 이 프로젝트를 왜 만드시나요?
**A**: 신제품 런칭 프로모션 사이트. 홈카페 원두 브랜드 런칭.

### target-users
**Q**: 주요 타깃은 누구인가요?
**A**: 홈카페 마니아층, 월 2-3회 원두 구매하는 사람들.

...

## Optional Requirements

### analytics
**Q**: 분석 도구 연동이 필요한가요?
**A**: GA4 + Hotjar

...

## Discovered (대화 중 새로 발견)

### payment-integration
**Context**: 사용자가 "구매 버튼에서 바로 결제"라고 언급
**Q**: 어떤 결제 수단을 지원하나요?
**A**: Stripe, 카카오페이

...

## TBD (미수집)

- [ ] `seo-strategy` — optional, 사용자가 skip
- [ ] `maintenance-plan` — optional, 사용자가 skip
```

## Step 5: Chain to vibe.plan

Discovery 완료 후 자동으로 `vibe.plan` 스킬이 활성화되어 이 결과를 정제된 기획서로 변환한다.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Discovery 완료!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 .claude/vibe/discovery/{feature-name}.md
   Required: 8/8
   Optional: 12/14
   Discovered: 3

→ vibe.plan 스킬이 기획서 작성을 시작합니다...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Anti-Patterns

- ❌ 한 번에 여러 질문 묶어서 던지기
- ❌ Required 완료 전에 "그만" 하도록 유도하기
- ❌ 사용자 답변을 무시하고 다음 질문으로 넘어가기
- ❌ 체크리스트에 없는 영역을 놓치기 (discovered 활용)
- ❌ PTCF/EARS/Phase 구조로 기획서 작성 (그건 vibe.plan이 정제하고, 실제 명세는 /vibe.spec)
- ❌ 얕은 질문 10개로 종료 (사용자가 명시 중단 전까지 계속)
- ❌ 선택지만 제공하고 자유 입력 막기

## Example Session (축약)

```
User: 패럴렉스 웹사이트 만들고 싶어

Claude: 🌿 브랜치 생성: discover/parallax-website ✅
        Type: website 감지 → checklists/website.md 로드

        먼저 배경부터 여쭤볼게요.
        이 웹사이트를 왜 만드시나요?
        (예: 개인 포트폴리오, 제품 프로모션, 에이전시 소개 등)

User: 신제품 런칭 프로모션. 원두 브랜드.

Claude: 좋습니다. 주요 타깃은 누구인가요?
        1. 원두 입문자
        2. 홈카페 마니아
        3. 카페 오너/바리스타
        또는 자유롭게

User: 2번

Claude: 이 웹사이트에서 사용자가 가장 먼저 느껴야 할 감정/분위기는?

User: 고급스러움. 시네마틱.

Claude: 레퍼런스 사이트나 이미지가 있으신가요? (URL or "없음")

User: apple.com 제품 페이지 느낌

[10-20 질문 진행...]

Claude: ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        📊 Discovery Progress
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        ✅ Required: 8/8 완료!
        ⚪ Optional: 4/14

        옵션 항목 (SEO, 분석, 다국어 등)을 계속 확인하시겠습니까?
        1. 네, 전부
        2. 핵심만 (3-5개)
        3. 그만

User: 3번

Claude: ⚠️ 필수는 모두 완료. 옵션 10개는 TBD로 표시됩니다.

        ✅ Discovery 완료!
        📄 .claude/vibe/discovery/parallax-website.md

        → vibe.plan 스킬이 기획서 작성을 시작합니다...
```

## Related

- **Next**: `vibe.plan` — discovery 결과를 기획서로 정제
- **After plan**: `/vibe.figma` (UI 트랙) + `/vibe.spec` (로직 트랙) 병렬
- **Templates**: `~/.claude/vibe/templates/plan-template.md`
- **Checklists**: `skills/vibe.discover/checklists/{type}.md`
