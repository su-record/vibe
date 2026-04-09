---
description: 기획 단계 — 대화로 요구사항 수집 → 마크다운 기획서 → /vibe.spec + /vibe.figma 허브
argument-hint: "project or feature name"
---

# /vibe.plan

아이디어 → 마크다운 기획서. 대화로 요구사항을 수집해서 `/vibe.spec`(기능)과 `/vibe.figma`(디자인)에 공급하는 **upstream 허브**.

## Usage

```
/vibe.plan "패럴랙스 웹사이트"          # 대화 모드 (요구사항 수집)
/vibe.plan "이커머스 랜딩"
/vibe.plan "docs/idea.md"              # 파일 입력 (아이디어 초안)
/vibe.plan + 📎 참고 이미지             # 첨부 파일 활용
```

## Philosophy

> **기획은 '왜/누구/무엇'까지, 구현 명세는 `/vibe.spec`, 비주얼은 `/vibe.figma`가 이어받는다.**

- **`/vibe.plan` ≠ `/vibe.spec`** — plan은 사람이 읽는 비전 문서, spec은 AI가 실행하는 코드 명세.
- **한 번 만들면 재사용** — 같은 기획서를 `/vibe.spec`과 `/vibe.figma` 양쪽에 넘길 수 있다.
- **UI/비-UI 적응형** — 웹사이트/앱은 Look & Feel 섹션, API/라이브러리는 해당 섹션 생략.

## Input Mode Detection (Auto-detect)

```
1. 첨부 파일 있음? → 첨부 분석
2. 인자가 파일 경로(존재)? → 파일 읽기
3. 그 외 → 대화 모드 (기능/프로젝트 이름으로 시작)
```

| 입력 | 결과 |
|-----|-----|
| 📎 첨부 | → 첨부 분석 (PRD 초안, 와이어프레임, 무드보드 등) |
| 파일 경로 | → Read tool로 읽기 |
| 이름 문자열 | → 대화 모드 시작 |

**지원 포맷**: `.md`, `.txt`, `.pdf`, `.png`, `.jpg`, `.webp`, `.svg` 등 Claude가 읽을 수 있는 모든 형식.

## Rules Reference

**`~/.claude/vibe/rules/` (global) 준수:**

- `core/development-philosophy.md`
- `core/quick-start.md` — Korean first
- `core/communication-guide.md`

## Process

> **⏱️ Timer**: 시작 시 `getCurrentTime` 호출, `{start_time}`로 기록.

### 0. Git Branch Setup (MANDATORY - Execute First!)

> ⚠️ **CRITICAL: Step 0 is BLOCKING.**

```bash
git branch --show-current
```

| 현재 브랜치 | 행동 |
|-----------|-----|
| `main` or `master` | **반드시** `git checkout -b plan/{feature-name}` |
| `plan/*`, `feature/*` | 사용자에게 확인: "이 브랜치에서 계속할까요?" |
| 기타 | 사용자 확인 |

**브랜치 네이밍:**
- 소문자 변환, 공백→하이픈
- 접두사 `plan/`
- 예: `plan/parallax-website`, `plan/ecommerce-landing`

---

### 1. 프로젝트 타입 감지 (Auto)

**키워드 기반 1차 감지:**

| 키워드 | 타입 | UI 섹션 포함? |
|-------|-----|-------------|
| website, landing, portfolio, 랜딩, 웹사이트 | `website` | ✅ |
| webapp, dashboard, 앱, 대시보드 | `webapp` | ✅ |
| mobile, iOS, Android, 모바일 | `mobile` | ✅ |
| api, backend, 서버, 백엔드 | `api` | ❌ |
| library, sdk, cli | `library` | ❌ |
| feature, 기능 | `feature` | 기존 프로젝트 스택에 따름 |

**애매하면 한 질문으로 확인:**

```
이 프로젝트의 타입은?
1. 웹사이트 (랜딩/포트폴리오/프로모션)
2. 웹앱 (대시보드/SaaS/도구)
3. 모바일 앱
4. API/백엔드
5. 라이브러리/SDK
6. 기존 프로젝트에 추가할 기능
```

---

### 2. 대화형 요구사항 수집

**원칙:**
- **한 번에 한 질문**
- 선택지 + "자유롭게 설명해도 좋습니다" 병행
- 자연스러운 흐름 (고정 순서 X)

**공통 필수 확인:**

1. **Why** — 왜 만드는가? (배경, 동기)
2. **Who** — 누가 쓰는가? (주요 사용자, 사용 맥락)
3. **What** — 핵심 기능/섹션은? (우선순위 Must/Should/Could)
4. **Scope** — 이번 버전 범위 & 비범위
5. **Success** — 성공 기준 (측정 가능한 지표)

**UI 프로젝트 추가 질문 (website/webapp/mobile):**

6. **Look & Feel** — 분위기/톤/컬러 방향
7. **레퍼런스** — 참고할 사이트/앱 URL 또는 이미지
8. **섹션 구성** — Hero, Features, About 등 레이아웃 (웹사이트)
9. **인터랙션** — 애니메이션/전환 스타일
10. **반응형** — 디바이스 우선순위 (desktop-first / mobile-first)

**비-UI 프로젝트 추가 질문 (api/library):**

6. **입출력** — 어떤 데이터를 받고 돌려주나?
7. **통합 대상** — 어떤 시스템과 연동되나?
8. **성능 요구** — 응답 시간, 처리량 목표

**기술 스택:**

- 기존 프로젝트면 `CLAUDE.md` / `.claude/vibe/config.json` 참조 후 확인
- 신규 프로젝트면 2-3개 옵션 제안

### 2.1 Critical Requirements (askUser) — 선택적

UI 프로젝트가 아닌 민감 영역(인증/결제/데이터 모델)이 등장하면 `askUser` 툴로 구조화 질문:

```typescript
import { askUser } from '@su-record/vibe/tools';

const result = await askUser({
  featureName: '{feature-name}',
  categories: ['authentication', 'security', 'data_model'],
  context: '{plan context summary}',
});
```

**가벼운 기획에서는 생략 가능.** `/vibe.spec` 단계에서 더 엄격하게 수집됨.

---

### 3. 기획서 작성

**출력 위치**: `.claude/vibe/plans/{feature-name}.md`

**템플릿 참조**: `~/.claude/vibe/templates/plan-template.md`

**메타데이터 프런트매터:**

```markdown
---
status: draft
type: {website | webapp | mobile | api | feature | library}
createdAt: {ISO-timestamp}
lastUpdated: {ISO-timestamp}
downstream: {spec | figma | both}
---
```

**섹션 (플랜 타입에 따라 적응):**

| # | 섹션 | 모든 타입 | UI 타입만 |
|---|-----|---------|---------|
| 1 | 개요 (Overview) | ✅ | |
| 2 | 배경 (Why) | ✅ | |
| 3 | 타깃 사용자 (Who) | ✅ | |
| 4 | 목표 & 성공 기준 | ✅ | |
| 5 | 핵심 기능/섹션 | ✅ | |
| 6 | 범위 & 비범위 | ✅ | |
| 7 | Look & Feel | | ✅ |
| 8 | 레이아웃/섹션 구성 | | ✅ |
| 9 | 반응형 전략 | | ✅ |
| 10 | 기술 스택 & 제약 | ✅ | |
| 11 | 가정 & 리스크 | ✅ | |
| 12 | 다음 단계 (Handoff) | ✅ | |

**주의:**

- ❌ PTCF 구조 금지 (그건 spec의 역할)
- ❌ EARS 포맷 금지 (WHEN/THEN은 spec에서)
- ❌ 파일 목록/Phase 쪼개기 금지 (구현 수준은 spec에서)
- ✅ 사람이 읽기 쉬운 비전 문서
- ✅ `/vibe.spec`과 `/vibe.figma` 양쪽의 입력이 될 수 있도록 충분한 맥락 포함

---

### 4. Handoff — 다음 단계 안내

기획서 저장 후 사용자에게 옵션 제시:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 기획서 완성!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 .claude/vibe/plans/{feature-name}.md

다음 단계를 선택하세요:

  1. /vibe.spec ".claude/vibe/plans/{feature-name}.md"
     → 코드 명세 작성 후 /vibe.run으로 기능 구현

  2. /vibe.figma
     → Phase 1 스토리보드에서 이 기획서를 참고하여 Figma 디자인 → UI 코드

  3. 병렬 실행 (권장 — 웹사이트 프로토타입)
     → /vibe.spec 으로 기능 구조 + /vibe.figma 로 비주얼
     → 통합하면 완성된 프로토타입

어떤 것부터 시작할까요?
```

**사용자 응답 처리:**

- `1` 또는 `/vibe.spec` → `/vibe.spec ".claude/vibe/plans/{feature-name}.md"` 체인 실행
- `2` 또는 `/vibe.figma` → `/vibe.figma` 체인 실행 (플랜 파일 경로를 Phase 1 컨텍스트로 전달)
- `3` 또는 `병렬` → 두 커맨드 순서대로 안내
- 그 외 → 여기서 종료, 사용자가 수동으로 이어받음

---

## Example Session

```
User: /vibe.plan "패럴랙스 웹사이트"

Claude:
🌿 브랜치 생성: plan/parallax-website ✅

"패럴랙스 웹사이트" 감지됨 → Type: website (UI 섹션 포함)

먼저 이 프로젝트의 배경부터 여쭤볼게요.
이 웹사이트를 왜 만들고 싶으신가요? (예: 개인 포트폴리오, 제품 프로모션, 에이전시 소개 등)

User: 신제품 런칭 프로모션 사이트요. 커피 원두 브랜드.

Claude: 좋습니다. 주요 타깃은 누구인가요?
1. 원두를 처음 접하는 입문자
2. 홈카페 마니아
3. 카페 오너/바리스타
4. 자유롭게 설명

User: 2번, 홈카페 하시는 분들

Claude: 이 사이트의 가장 중요한 섹션은 어떤 것들인가요?
(예: Hero, 원두 소개, 테이스팅 노트, 구매 CTA, 스토리 등)

User: Hero, 원두 3종 소개, 테이스팅 노트 인터랙션, 구매 버튼

Claude: 분위기/톤은 어떻게 가고 싶으세요?
예를 들어 "미니멀·시네마틱", "따뜻·아날로그", "모던·고급" 같은 방향…

[대화 계속...]

Claude:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 기획서 완성!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 .claude/vibe/plans/parallax-website.md

다음 단계:
  1. /vibe.spec (기능 명세)
  2. /vibe.figma (비주얼 디자인)
  3. 병렬 실행 (프로토타입)
```

## Next Step

```
/vibe.spec ".claude/vibe/plans/{feature-name}.md"
# 또는
/vibe.figma
```

---

ARGUMENTS: $ARGUMENTS
