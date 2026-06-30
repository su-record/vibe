---
name: vibe.clone
description: URL → 마크업 레벨 픽셀 완벽 클론 — 헤드리스 브라우저로 라이브 사이트 캡처 후 현재 프로젝트 스택에 맞게 스캐폴딩
argument-hint: "<url> [<url2>...] [--name=<feature>] [--mo-only] [--pc-only] [--ignore-robots] [--no-interact]"
user-invocable: true
---

# /vibe.clone

URL을 받아 **마크업 수준으로 정밀 복제**하고 현재 프로젝트 스택에 맞춰 컴포넌트/스타일을 스캐폴딩한다.

→ 모든 동작은 **`clone` 스킬**의 규칙을 따른다. 이 커맨드는 라우터일 뿐, 휴리스틱·추정·생략은 금지.

## Usage

```
/vibe.clone <url>                              # 인터랙티브: MO+PC 양쪽 캡처 (기본)
/vibe.clone <url> --mo-only                    # 모바일(375×812)만 캡처
/vibe.clone <url> --pc-only                    # 데스크탑(1440×900)만 캡처
/vibe.clone <url> --name=stripe-clone          # 기능 이름 지정 (기본: 호스트명 kebab-case)
/vibe.clone <url1> <url2> <url3>               # 다중 페이지 클론 (같은 사이트의 여러 경로)
/vibe.clone <url> --ignore-robots              # robots.txt 무시 (사이트 소유자 허가 있을 때만)
/vibe.clone <url> --no-interact                # 능동 인터랙션 스윕 끄기 (완전 결정론적·재현 가능 캡처)
```

## Argument Routing

```
Step 1) 인자 수집
  urls         = http(s):// 로 시작하는 모든 인자
  feature      = --name=<value> | URL host → kebab-case
  scope        = --mo-only | --pc-only | (기본: both)
  ignoreRobots = --ignore-robots 플래그 유무

Step 2) 인자 검증
  urls.length === 0  → 사용자에게 URL 입력 요청, 중단
  ! /^https?:\/\//.test(url) → "유효한 URL이 아닙니다" 에러, 중단

Step 3) 스킬 진입
  → clone 스킬 Phase 0부터 순차 실행
  → URL 다중 입력 시 각 URL마다 별도 feature 디렉토리 (URL path 기반 suffix)
```

## Execution Plan

`clone` 스킬을 로드한 뒤 다음을 순차 실행한다. **Phase 단계 건너뛰기 금지**.

```
Phase 0: Setup
  - .vibe/config.json + package.json → 스택 감지
  - feature 이름 결정, 디렉토리 생성

Phase 1: Capture (병렬 — scope에 따라 MO/PC 동시)
  - node {{VIBE_PATH}}/hooks/scripts/clone-extract.js capture <url> \
      --out=/tmp/{feature}/{bp}/ --viewport={WxH} --bp={mo|pc}
  - 출력: rendered.html, computed.json, screenshot.png, states.json, behaviors.json, asset-map.json, assets/
  - behaviors.json = 능동 인터랙션 스윕(스크롤 시 헤더/내비 변화 diff + 탭 클릭 콘텐츠 스왑 감지).
    JS로 세팅되는 상태(정적 CSS로는 안 잡힘)를 포착 — 클론 정확도의 핵심. --no-interact 로 비활성화.

Phase 2: Refine (BP마다 독립)
  - node {{VIBE_PATH}}/hooks/scripts/clone-refine.js \
      /tmp/{feature}/{bp}/rendered.html /tmp/{feature}/{bp}/computed.json \
      --out=/tmp/{feature}/{bp}/sections.json --states=/tmp/{feature}/{bp}/states.json --bp={mo|pc}
  - sections.json 에 section.interaction(인터랙션 모델 추정) + section.states(상태 규칙) 포함

Phase 3: Scaffold (BP 순차 — MO 완료 후 PC)
  - Step 0: node {{VIBE_PATH}}/hooks/scripts/clone-spec.js \
      /tmp/{feature}/{bp}/sections.json \
      --out=./components/{feature}/_specs/ --feature={feature}
    → 섹션별 빌드 계약서(_specs/{Section}.spec.md). 빌드 전 TODO(인터랙션 모델 확정·상태 목록·텍스트 교체) 해결
  - Step A: node {{VIBE_PATH}}/hooks/scripts/clone-to-scss.js \
      /tmp/{feature}/{bp}/sections.json \
      --out=./styles/{feature}/ --feature={feature}
  - Claude: 섹션별로 HTML/컴포넌트 작성 (스택별 .tsx/.vue/.svelte/.html) — 확정된 인터랙션 모델 + 모든 상태 반영
  - Step B: node {{VIBE_PATH}}/hooks/scripts/clone-validate.js \
      ./styles/{feature}/ /tmp/{feature}/{bp}/sections.json --section={Name}
  - 섹션마다 PASS 받고 다음 섹션 진행

Phase 4: Compile Gate (clone SKILL.md 규칙)
Phase 5: Pixel Verification (P1=0까지 루프 — clone SKILL.md 규칙)
```

## Prerequisites

- **puppeteer**: optional peer dependency. 미설치 시 Phase 1에서 `npm install puppeteer` 안내 후 중단
- **Chromium**: puppeteer 자동 다운로드 (`npx puppeteer browsers install chrome`)
- **dev 서버**: Phase 4-5에서 `npm run dev` 호출. 스크립트가 미정의면 사용자에게 명시
- **robots.txt 준수**: 기본 차단. `--ignore-robots` 는 사이트 소유자/CTF/학습 명시일 때만

## Output Locations

```
/tmp/{feature}/                  # 작업 디렉토리 (산출물 원본)
  ├── mo/, pc/                   # rendered.html, computed.json, screenshot.png, states.json, behaviors.json, sections.json, assets/
  └── project-tokens.json        # 기존 프로젝트 토큰 인덱스

./components/{feature}/          # Claude가 작성한 컴포넌트 (.tsx/.vue/.svelte/.html)
./components/{feature}/_specs/   # clone-spec.js가 생성한 섹션별 빌드 계약서 (*.spec.md)
./styles/{feature}/              # clone-to-scss.js가 생성한 SCSS 파일
  ├── _tokens.scss               # CSS 변수
  ├── _base.scss                 # @font-face
  ├── _shared.scss               # 유틸
  ├── sections/_<name>.scss      # 섹션별 partial
  ├── index.scss                 # 마스터 orchestrator
  └── class-plan.json            # 노드 id → BEM 클래스
./public/images/{feature}/       # 다운로드된 이미지/폰트
```

## Legal Notes

```
이 커맨드는 다음 용도에만 사용:
  ✅ 클론 코딩 학습 (마크업/레이아웃 연구)
  ✅ 본인 소유 사이트 재구축
  ✅ 명시적 허가 받은 리디자인

금지:
  ❌ 저작권 콘텐츠(텍스트/이미지/로고) 무단 재게시
  ❌ 피싱/브랜드 사칭 룩어라이크 사이트
  ❌ robots.txt 우회 (소유자 허가 없는 --ignore-robots)

Claude 기본 행동:
  - 저작권 텍스트 → 플레이스홀더("[Lorem ipsum]") 교체
  - robots.txt 차단 경로 → 명시적 --ignore-robots 없으면 거부
  - 사용자 의도가 사칭/기만이면 즉시 거부
```
