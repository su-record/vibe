# 릴리스 노트

## [2.8.50] - 2026-04-09

### 주요 변경사항

v2.8 시리즈는 Figma → 코드 파이프라인의 대규모 재설계, 하네스 자기 관리 시스템 도입, 멀티 CLI 지원 확장을 포함합니다.

---

### 핵심 기능 (Features)

#### 하네스 시스템 강화
- **하네스 자기 관리** — LLM 비용 추적(`llm-costs.jsonl`), 롤백 체크포인트(`vibe-checkpoint-N`), 에스컬레이션(동일 파일 P1/P2 3회 반복 시 사용자 개입 요청) (`fb85800`)
- **세션 시작 시 하네스 버전 체크** — 글로벌 npm 설치 경로에서 버전 조회 (`51c57b8`)
- **하네스 자기 개선 + E2E 브라우저 검증** (`1297683`)

#### Figma → 코드 파이프라인 (대규모 재설계)
- **트리 기반 구조적 매핑으로 철학 전환** — 스크린샷 기반 추정에서 Figma 노드 트리 기반 구조적 코드 생성으로 전환 (`1375e0b`)
- **Kombai 수준 Figma → 코드 변환** — 4개 Phase 구현 (`9865615`)
- **Phase 2.5 리매핑 구조** — 멀티 브레이크포인트 통합 + CSS diff (`4e7d1b1`)
- **리매핑에 스토리보드 매칭 추가** — 기능 정의로 노드 역할 확정 (`d00f937`)
- **Phase 5 공통화 + 브레이크포인트별 폴더 구조** (`ae7917f`)
- **Phase 3 순차 블록 빌딩 규칙** + 작업 폴더 명시 (`99de19a`)
- **Phase 1 PDF/이미지 스토리보드 분기 처리** (`cb5f342`)
- **이미지 추출 포맷 png → webp 전환** (`c534e7c`)
- **component-index 템플릿** — Figma 노드 <-> 컴포넌트 매핑 (`035cc92`)
- **Puppeteer + CDP 브라우저 검증 연동** (`148f048`, `205f661`)
- **figma-extract render 커맨드** — HTML + SCSS + 이미지 + 스크린샷 일괄 출력 (`9fccfcc`)
- **`_tokens.scss` primitive/semantic 구조화** (`847a4ea`)
- **figma-extract hook script** — llm-orchestrate 패턴 준수 (`fb4147e`)
- **Figma REST API 기반 디자인 추출 도구** — MCP 플러그인 대체 (`6dbfec9`)

#### 스킬 & 에이전트
- **45개 스킬 전체 강화** — scripts, rubrics, templates, experts 추가 (`41da8af`)
- **harness-100 패턴 적용** — 에이전트 팀, 오케스트레이터, 도메인 프레임워크 (`93c4027`, `ad4dc61`)
- **Hook 갭 5개 채움** — 하네스 8대 필수 Hook 완성 (`09a0255`)
- **chub-usage 스킬 추가** — Context Hub API 문서 연동 (`0202e94`)
- **/vibe.docs 스킬 추가** — 코드베이스 분석 기반 문서 생성 (`bd77146`)
- **vibe stats 명령** — 세션 통계, 주간 리포트, 품질 트렌드 (`9858aa0`)
- **create-prd에 Jobs-to-be-Done 프레임워크 추가** (`37d1006`)
- **스킬 네이밍 vibe- → vibe. 통일** + vibe.docs command 추가 (`0642330`)

#### 멀티 CLI & LLM
- **Codex 플러그인 자동 감지 + Stop 훅 리뷰 게이트** (`be5d162`)
- **동적 멀티 LLM 모델 라우팅** — Codex/Gemini 가용성 기반 (`34c4585`)
- **Codex 플러그인 시스템으로 마이그레이션** (`1908aa9`)
- **Context Hub 연동** (`2fa7f69`)

#### 인프라
- **Self-Healing 시스템** — code-check hook이 차단 대신 자동 수정 제안 (`f719972`)
- **qa-coordinator 에이전트** — 병렬 QA 디스패치 (`41fe89b`)
- **Store Interface, VibeSpan 텔레메트리, ComponentRegistry** (`7d0a286`)
- **이벤트 자동화 시스템** — 스킬, 에이전트, 커맨드 (`aabe285`)
- **browser UI 검증 인프라** — Puppeteer + CDP 기반 (`205f661`)
- **claw-code 패턴 적용** — 구조적 컨텍스트 저장, 설정 병합 (`59d073d`)

---

### 버그 수정 (Fixes)

#### Figma 파이프라인
- 이미지 vs HTML 판별 규칙 강화 — 텍스트 이중 렌더링/카드 통째 이미지 방지 (`924a3ac`)
- BG를 img 태그로 처리하는 패턴 전면 금지 (`1c87ec9`)
- `_base.scss` 래퍼 컨테이너 필수 규칙 (`624606b`)
- URL 입력 안내 개선 — 순서 무관 줄바꿈 입력 + 자동 분류 (`7fe022c`)
- VerificationLoop openPage 호출 시그니처 수정 (`dae3d37`)
- scaleFactor 잔여 참조 제거 + rubrics/templates vw/clamp 전환 (`b9e18e5`)
- browser 모듈 TypeScript 빌드 에러 수정 (`8ecf7b0`)
- CSS art 금지 HARD RULE (`8896918`)
- placeholder 금지 + 이미지 미확보 시 진행 차단 (`822b478`)

#### 코어
- 버전 체크를 글로벌 npm 설치 경로에서 조회하도록 수정 (`884fe1b`)
- postinstall 스킬 복사를 항상 덮어쓰기로 변경 (`da237ed`)
- 보안 강화 + 안정성 개선 (`9de7da8`)
- AskUserQuestion 지시를 자연어로 변경 (`e84091a`)
- ts-morph async 전환 나머지 호출부 + 테스트 보강 (`f8faa2a`)
- sentinel-guard / pre-tool-guard 테스트 보강 (`cd48b3c`, `e658d5a`)
- postinstall에서 레거시 vibe-* 스킬 디렉토리 자동 정리 (`27bad3b`)

---

### 리팩토링 (Refactor)

- **vibe.figma 전면 재설계** — 8파일 2000줄 → 3파일 679줄 (`1848b51`)
- **scaleFactor 제거** → vw/clamp 반응형 단위 변환 (`441312e`)
- **vibe.figma 실증 기반 스킬 정리** — 이미지 노드 렌더링 + Phase 1 파일 생성 제거 (`47c99dd`)
- **Phase 넘버링 정리** + 스토리보드 URL 통합 입력 (`6a42a46`)
- **병합 완료된 figma 서브 스킬 7개 삭제** (`c3f85cd`)
- **lsp.ts ts-morph 지연 로딩** — static import → dynamic import (`278de56`)
- **P1 개선** — Hook 성능 최적화, 에러 핸들링 통일 (`071db5b`)
- **autonomy 시스템을 경량 반복 제어로 교체** (`8542d18`)
- **MCP 플러그인 참조 제거** — 자체 도구로 완전 전환 (`b95f0e8`)

---

### 문서 (Docs)

- 하네스 정의를 업계 표준(Agent=Model+Harness)으로 수정 (`069d211`)
- README에 하네스 시스템 섹션 추가 (`d9bb7d4`)
- README 영문 전면 재작성 (`308cdd7`)
- Codex 플러그인 워크플로우 연동 및 동적 모델 라우팅 문서 (`b832fd0`)

---

### 기타 (Chore)

- 옛날 용어 정리 — 재료함/퍼즐조립/Phase 2.5/1500px/MCP 참조 제거 (`8a4ca04`)
- README 스킬/훅 카운트 업데이트 (`f46c366`)

---

### 마이그레이션 가이드

#### v2.7 → v2.8 업그레이드

```bash
npm install -g @su-record/vibe@latest
vibe update  # 스택 재감지 + 새 스킬/규칙 적용
```

**주요 변경:**
- 스킬 네이밍이 `vibe-*`에서 `vibe.*`으로 변경 — postinstall이 레거시 디렉토리를 자동 정리
- Figma 파이프라인이 MCP 플러그인에서 자체 도구(`src/infra/lib/figma/`)로 전환
- `scaleFactor` 제거 → `vw`/`clamp()` 반응형 단위로 전환
- 스크린샷 기반 추정에서 트리 기반 구조적 매핑으로 Figma 철학 전환

**하위 호환:**
- 기존 프로젝트 설정(`.claude/vibe/config.json`)은 그대로 유지
- Codex 미설치 시 기존 워크플로우 동일하게 동작
- `vibe update` 실행으로 새 기능 자동 활성화
