---
name: vibe.clone
description: URL → 마크업 레벨 픽셀 완벽 클론 — 헤드리스 브라우저로 라이브 사이트 캡처 후 현재 프로젝트 스택에 맞게 스캐폴딩
argument-hint: "<url> [<url2>...] [--name=<feature>] [--sub] [--mo-only] [--pc-only] [--ignore-robots] [--no-interact] [--real-content]"
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
/vibe.clone <url> --sub                        # 사이트맵/메가메뉴 하위 메뉴 URL까지 함께 클론
/vibe.clone <url1> <url2> <url3>               # 다중 페이지 클론 (같은 사이트의 여러 경로)
/vibe.clone <url> --ignore-robots              # robots.txt 무시 (사이트 소유자 허가 있을 때만)
/vibe.clone <url> --no-interact                # 능동 인터랙션 스윕 끄기 (완전 결정론적·재현 가능 캡처)
/vibe.clone <url> --real-content               # 텍스트 verbatim 유지 (본인 소유/허가 확인 1회 필수)
```

## Argument Routing

```
Step 1) 인자 수집
  urls         = http(s):// 로 시작하는 모든 인자
  feature      = --name=<value> | URL host → kebab-case
  scope        = --mo-only | --pc-only | (기본: both)
  sub          = --sub 플래그 유무
  ignoreRobots = --ignore-robots 플래그 유무
  realContent  = --real-content 플래그 유무 (소유/허가 확인 질문 1회 후 적용)

Step 2) 인자 검증
  urls.length === 0  → 사용자에게 URL 입력 요청, 중단
  ! /^https?:\/\//.test(url) → "유효한 URL이 아닙니다" 에러, 중단
  --sub && urls.length > 1 → "--sub는 기준 URL 1개와 함께 사용하세요" 에러, 중단

Step 2.5) --sub URL 확장
  - node {{VIBE_PATH}}/hooks/scripts/clone-extract.js suburls <url> \
      --out=/tmp/{feature}/menu-urls.json [--ignore-robots]
  - menu-urls.json.urls 를 urls 로 사용
  - 수집 기준: /sitemap 우선, 없으면 header/nav/mega-menu
  - 포함: 같은 origin + 같은 locale prefix의 하위 메뉴 URL
  - 제외: 외부 링크, 언어 전환, 검색, TOP, 푸터 정책/문의/파트너/뉴스룸 링크

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
  - --sub이면 /tmp/{feature}/menu-urls.json 생성 후 URL 목록 확장

Phase 1: Capture (병렬 — scope에 따라 MO/PC 동시)
  - node {{VIBE_PATH}}/hooks/scripts/clone-extract.js capture <url> \
      --out=/tmp/{feature}/{bp}/ --viewport={WxH} --bp={mo|pc}
  - 출력: rendered.html, computed.json, screenshot.png, states.json, behaviors.json, asset-map.json, assets/ (images·fonts·seo)
  - behaviors.json = 능동 인터랙션 스윕 4종+ (스크롤 헤더 diff · 탭 클릭 콘텐츠 스왑 · 호버 diff ·
    in-view 등장 애니메이션 · time-driven 캐러셀 후보 · 스무스 스크롤 라이브러리 감지).
    JS로 세팅되는 상태(정적 CSS로는 안 잡힘)를 포착 — 클론 정확도의 핵심. --no-interact 로 비활성화.
  - assets/seo/ = favicon·apple-touch-icon·og:image·webmanifest (Foundation 단계에서 배선)

Phase 2: Refine (BP마다 독립)
  - node {{VIBE_PATH}}/hooks/scripts/clone-refine.js \
      /tmp/{feature}/{bp}/rendered.html /tmp/{feature}/{bp}/computed.json \
      --out=/tmp/{feature}/{bp}/sections.json --states=/tmp/{feature}/{bp}/states.json --bp={mo|pc}
  - sections.json 에 section.interaction(인터랙션 모델 추정) + section.states(상태 규칙) 포함

Phase 2.5: Foundation (순차 — 섹션 빌드 전)
  - 폰트 배선(Next → next/font) · assets/seo/ → public/ (favicon·OG·manifest 메타 배선)
  - 인라인 SVG dedupe → 아이콘 모듈 · scrollLib 감지 시 페이지 레벨 배선

Phase 3: Scaffold (BP 순차 — MO 완료 후 PC / 섹션은 병렬 빌더 디스패치)
  - Step 0: node {{VIBE_PATH}}/hooks/scripts/clone-spec.js \
      /tmp/{feature}/{bp}/sections.json \
      --out=./components/{feature}/_specs/{bp}/ --feature={feature} [--real-content]
    → 섹션별 빌드 계약서(_specs/{bp}/{Section}.spec.md). 디스패치 전 TODO(인터랙션 모델 확정·상태 목록·텍스트 교체) 해결
    → spec 150줄 초과 시 하위 컴포넌트 spec으로 분할 (기계적 체크 — wc -l)
  - Step A: node {{VIBE_PATH}}/hooks/scripts/clone-to-scss.js \
      /tmp/{feature}/{bp}/sections.json \
      --out=./styles/{feature}/{bp}/ --feature={feature}
    → SCSS 초안. 이후 근거(computed/states/behaviors) 인용 시 수정 허용 — clone-validate가 판정자
  - 병렬 디스패치: 섹션별 빌더 서브에이전트 — spec 전문을 프롬프트에 인라인, 병렬 파일 쓰기는 worktree 격리
  - Step B: node {{VIBE_PATH}}/hooks/scripts/clone-validate.js \
      ./styles/{feature}/{bp}/ /tmp/{feature}/{bp}/sections.json --section={Name}
  - 섹션마다 PASS 후 완료 처리 (머지 순서: 하위 컴포넌트 → 래퍼)

Phase 3C: Responsive Merge (MO+PC 모두 Phase 5 통과 후)
  - node {{VIBE_PATH}}/hooks/scripts/clone-merge-responsive.js \
      --mo=./styles/{feature}/mo/ --pc=./styles/{feature}/pc/ \
      --out=./styles/{feature}/ [--breakpoint=1024]
    → mobile-first 병합: MO 선언 = 기본, PC diff만 @media (min-width) 블록
  - 컴포넌트 import를 병합 index.scss로 전환 → Phase 4 → Phase 5를 두 뷰포트 모두 재실행

Phase 4: Compile Gate (clone SKILL.md 규칙)
Phase 5: Pixel Verification (P1=0까지 루프 — clone SKILL.md 규칙; 병합 후엔 MO·PC 양쪽)
```

## Prerequisites

- **puppeteer**: optional peer dependency. 미설치 시 Phase 1에서 `npm install puppeteer` 안내 후 중단
- **Chromium**: puppeteer 자동 다운로드 (`npx puppeteer browsers install chrome`)
- **dev 서버**: Phase 4-5에서 `npm run dev` 호출. 스크립트가 미정의면 사용자에게 명시
- **robots.txt 준수**: 기본 차단. `--ignore-robots` 는 사이트 소유자/CTF/학습 명시일 때만

## Output Locations

```
/tmp/{feature}/                  # 작업 디렉토리 (산출물 원본)
  ├── menu-urls.json             # --sub URL 확장 결과
  ├── mo/, pc/                   # rendered.html, computed.json, screenshot.png, states.json, behaviors.json, sections.json, assets/
  └── project-tokens.json        # 기존 프로젝트 토큰 인덱스

./components/{feature}/          # 빌더가 작성한 컴포넌트 (.tsx/.vue/.svelte/.html)
./components/{feature}/_specs/{mo,pc}/  # clone-spec.js가 생성한 섹션별 빌드 계약서 (*.spec.md)
./styles/{feature}/              # 최종 병합 SCSS (Phase 3C 산출 — mobile-first @media)
  ├── mo/, pc/                   # BP별 SCSS 초안 (clone-to-scss.js + 근거 기반 수정)
  ├── _tokens.scss               # CSS 변수 (병합)
  ├── _base.scss                 # @font-face
  ├── _shared.scss               # 유틸 + 글로벌 동작 (scroll-lib 등)
  ├── sections/_<name>.scss      # 섹션별 partial (병합)
  ├── index.scss                 # 마스터 orchestrator (병합)
  └── class-plan.json            # 노드 id → BEM 클래스 (병합)
./public/images/{feature}/       # 다운로드된 이미지/폰트
./public/ (프로젝트 관례 경로)     # favicon·OG·manifest (assets/seo/ 에서 배선)
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
  - --real-content → 소유/허가 확인 질문 1회 후 verbatim 유지 (본인 사이트 재구축 유스케이스)
  - robots.txt 차단 경로 → 명시적 --ignore-robots 없으면 거부
  - 사용자 의도가 사칭/기만이면 즉시 거부
```
