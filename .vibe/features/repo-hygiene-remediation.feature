# language: ko
기능: 저장소 위생 일괄 조치
  "완료 판정은 결정론적 게이트가 한다"는 제품 명제를 이 저장소 자신에게 적용한다.
  선언만 되어 있고 기계가 강제하지 않던 규칙을 CI 게이트로 배선하고,
  그 부재로 이미 발생한 드리프트를 제거한다.

  # ─── P1 — 자기 규칙의 기계화 ──────────────────────────────────────

  @p1 @REQ-repo-hygiene-001
  시나리오: 린터가 CLAUDE.md 하드룰을 강제한다
    조건 oxlint 와 .oxlintrc.json 이 설치돼 있을 때
    만일 pnpm lint 를 실행하면
    그러면 종료 코드는 0 이다
    그리고 src 프로덕션 코드의 no-explicit-any 위반은 0건이다
    그리고 max-params 위반은 0건이다

  @p1 @REQ-repo-hygiene-001
  시나리오: 복잡도 부채가 늘어나면 라쳇이 막는다
    조건 .oxlint-baseline.json 에 규칙별 상한이 기록돼 있을 때
    만일 중첩 4단계 함수를 새로 추가하고 pnpm lint:ratchet 을 실행하면
    그러면 종료 코드는 1 이다
    그리고 증가한 규칙과 증가폭이 출력된다

  @p1 @REQ-repo-hygiene-001
  시나리오: 부채가 그대로면 라쳇은 통과한다
    조건 위반 건수가 baseline 과 같을 때
    만일 pnpm lint:ratchet 을 실행하면
    그러면 종료 코드는 0 이다

  @p1 @REQ-repo-hygiene-002
  시나리오: CI 가 드리프트 가드를 실행한다
    조건 .github/workflows/test.yml 을 파싱했을 때
    만일 job 목록을 확인하면
    그러면 verify job 이 존재한다
    그리고 verify job 이 lint·lint:ratchet·가드 4종을 모두 실행한다

  @p1 @REQ-repo-hygiene-003
  시나리오: 지원하지 않는 하네스를 README 에 넣으면 CI 가 막는다
    조건 cli-detector.ts 가 Claude·Codex·Antigravity detector 만 export 할 때
    만일 README 지원 도구 표에 Cursor 행을 추가하고 validate:counts 를 실행하면
    그러면 종료 코드는 1 이다
    그리고 "cli-detector.ts has no detector for it" 가 출력된다

  @p1 @REQ-repo-hygiene-003
  시나리오: Node 버전 주장이 engines 와 어긋나면 CI 가 막는다
    조건 package.json engines.node 가 ">=20.12.0" 일 때
    만일 README 배지를 ">=18" 로 되돌리고 validate:counts 를 실행하면
    그러면 종료 코드는 1 이다

  # ─── P2 — 재현성과 배포 안전 ──────────────────────────────────────

  @p2 @REQ-repo-hygiene-004
  시나리오: 검증 스크립트가 네트워크 없이 실행된다
    조건 tsx 가 devDependencies 에 고정돼 있을 때
    만일 pnpm validate:counts 를 실행하면
    그러면 npx 를 통한 원격 패키지 다운로드가 발생하지 않는다

  @p2 @REQ-repo-hygiene-005
  시나리오: 저장소 자체 install 이 전역 홈을 덮어쓰지 않는다
    조건 INIT_CWD 가 이 패키지 루트와 같을 때
    만일 postinstall 을 실행하면
    그러면 전역 자산 설치를 건너뛴다
    그리고 ~/.claude 와 ~/.vibe 가 변경되지 않는다

  @p2 @REQ-repo-hygiene-005
  시나리오: 소비자 설치는 정상 진행된다
    조건 INIT_CWD 가 다른 프로젝트 디렉토리일 때
    만일 postinstall 을 실행하면
    그러면 self-install 로 판정하지 않는다

  @p2 @REQ-repo-hygiene-006
  시나리오: 커버리지가 내려가면 CI 가 막는다
    조건 vitest.config.ts 에 thresholds 가 설정돼 있을 때
    만일 pnpm test:coverage 를 실행하면
    그러면 실측 커버리지가 임계값 이상이면 종료 코드는 0 이다
    그리고 임계값 미만이면 종료 코드는 1 이다

  @p2 @REQ-repo-hygiene-007
  시나리오: 배포 런타임이 CI 에서 검증된다
    조건 release.yml 이 Node 24 에서 publish 할 때
    만일 test.yml 의 매트릭스를 확인하면
    그러면 build 와 test 가 Node 20·22·24 에서 모두 실행된다

  @p2 @REQ-repo-hygiene-008
  시나리오: exports 서브패스가 타입을 노출한다
    조건 tsconfig 의 moduleResolution 이 nodenext 일 때
    만일 package.json exports 의 각 서브패스를 검사하면
    그러면 모든 서브패스가 해석 가능한 .d.ts 를 가진다
    그리고 모든 서브패스의 런타임 진입점이 존재한다

  @p2 @REQ-repo-hygiene-008
  시나리오: node10 해석으로 되돌아가지 않는다
    조건 tsconfig.json 을 읽었을 때
    만일 moduleResolution 값을 확인하면
    그러면 nodenext·node16·bundler 중 하나다

  # ─── P3 — 관측성과 위생 ───────────────────────────────────────────

  @p3 @REQ-repo-hygiene-009
  시나리오: 통과하는 테스트가 출력을 오염시키지 않는다
    조건 silence-tty setup 이 적용됐을 때
    만일 전체 테스트를 실행하면
    그러면 스피너·커서 제어 시퀀스가 출력되지 않는다

  @p3 @REQ-repo-hygiene-009
  시나리오: 실패한 테스트의 진단은 그대로 보인다
    조건 console.log 를 남기는 테스트가 실패할 때
    만일 vitest 를 실행하면
    그러면 해당 로그가 실패 보고에 포함된다

  @p3 @REQ-repo-hygiene-010
  시나리오: --silent 가 실제로 출력을 끈다
    조건 src/cli/commands 의 출력이 log() 로 이관됐을 때
    만일 vibe skills add 를 --silent 없이 실행하면
    그러면 사용법이 출력된다
    그리고 --silent 를 붙이면 출력이 0줄이다

  @p3 @REQ-repo-hygiene-011
  시나리오: SessionStart 가 안정 블록을 먼저 낸다
    조건 session-start 훅을 실행했을 때
    만일 stdout 순서를 확인하면
    그러면 Memory Index 가 현재 시각보다 먼저 출력된다
    그리고 출력 내용 자체는 재배치 전과 동일하다

  @p3 @REQ-repo-hygiene-012
  시나리오: 훅 예외가 모델 컨텍스트를 오염시키지 않는다
    조건 session-start 내부에서 예외가 발생했을 때
    만일 출력 스트림을 확인하면
    그러면 오류 메시지는 stderr 로만 나간다

  @p3 @REQ-repo-hygiene-013
  시나리오: star-gate 가 PR 을 닫지 않는다
    조건 star-gate.yml 을 파싱했을 때
    만일 트리거 목록을 확인하면
    그러면 pull_request_target 이 없다
    그리고 issues 트리거는 유지된다

  @p3 @REQ-repo-hygiene-014
  시나리오: 대형 파일을 줄 수가 아니라 측정으로 판정한다
    조건 oxlint 로 파일별 복잡도 위반을 집계했을 때
    만일 최장 파일과 최다 위반 파일을 비교하면
    그러면 clone-extract.js 는 1306줄이지만 위반 8건이다
    그리고 codex-proxy.ts 는 1143줄에 위반 32건으로 1위다
    그리고 상환 순서가 .vibe/todos/complexity-debt-2026-08-03.md 에 기록된다
