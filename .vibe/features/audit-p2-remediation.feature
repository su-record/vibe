# language: ko
기능: 2026-07-28 감사 P2 잔여 조치
  게시 패키지의 배포 계약, 훅 게이트의 판정 정확성, 고위험 모듈 커버리지를
  검증 가능한 상태로 만든다.

  # ─── Wave A — 배포 위생 ───────────────────────────────────────────

  @wave-a @REQ-audit-p2-remediation-001
  시나리오: 빌드 산출물에 테스트가 포함되지 않는다
    조건 클린 체크아웃에서 빌드를 실행했을 때
    만일 dist 트리를 검사하면
    그러면 "*.test.js" 파일이 0개다
    그리고 "__tests__" 경로의 js 파일이 0개다
    그리고 tsc --noEmit 은 여전히 exit 0 이다

  @wave-a @REQ-audit-p2-remediation-001
  시나리오: 게시 tarball 이 런타임 자산을 잃지 않는다
    조건 빌드 산출물에서 테스트를 제외한 뒤
    만일 npm pack --dry-run 을 실행하면
    그러면 vibe/·skills/·agents/·hooks/·languages/ 가 모두 포함돼 있다
    그리고 unpackedSize 가 6,617,635 바이트보다 작다

  @wave-a @REQ-audit-p2-remediation-002
  시나리오: postinstall 실패가 보이지 않게 삼켜지지 않는다
    조건 설치 스크립트가 참조하는 경로를 읽을 수 없게 만들었을 때
    만일 postinstall 을 실행하면
    그러면 stderr 에 실패 원인이 최소 1줄 출력된다
    그리고 프로세스 종료 코드는 0 이다

  @wave-a @REQ-audit-p2-remediation-002
  시나리오: 정상 설치는 조용하다
    조건 모든 경로가 정상일 때
    만일 postinstall 을 실행하면
    그러면 stderr 에 경고가 출력되지 않는다

  @wave-a @REQ-audit-p2-remediation-003
  시나리오: CI 가 커밋된 락파일 그대로 설치한다
    조건 package.json 에 packageManager 가 선언돼 있을 때
    만일 CI 워크플로가 의존성을 설치하면
    그러면 frozen lockfile 모드로 설치한다
    그리고 락파일과 다른 트리로 해석되면 실패한다

  @wave-a @REQ-audit-p2-remediation-004
  시나리오: 커밋된 락파일에 high 취약점이 없다
    조건 락파일을 갱신한 뒤
    만일 npm audit --omit=dev 를 실행하면
    그러면 high 등급 취약점이 0건이다
    그리고 brace-expansion 이 5.0.8 이상으로 고정돼 있다

  # ─── Wave B — 게이트 정확성·타입 ──────────────────────────────────

  @wave-b @REQ-audit-p2-remediation-005
  시나리오 개요: deny 권한을 가진 guard 가 크래시하면 작업을 차단한다
    조건 <guard> 가 예외를 던지도록 만들었을 때
    만일 PreToolUse 디스패처를 실행하면
    그러면 종료 코드가 2 다
    그리고 stderr 에 guard 이름과 원인이 출력된다

    예:
      | guard          |
      | sentinel-guard |
      | pre-tool-guard |
      | scope-guard    |

  @wave-b @REQ-audit-p2-remediation-005
  시나리오: deny 권한이 없는 step 크래시는 작업을 막지 않는다
    조건 command-log 가 예외를 던지도록 만들었을 때
    만일 PreToolUse 디스패처를 실행하면
    그러면 종료 코드가 0 이다

  @wave-b @REQ-audit-p2-remediation-005
  시나리오: 차단 메시지가 스스로 복구 방법을 알려준다
    조건 guard 가 크래시해 작업이 차단됐을 때
    만일 stderr 를 확인하면
    그러면 VIBE_HOOK_FAILCLOSED=0 탈출 방법이 포함돼 있다

  @wave-b @REQ-audit-p2-remediation-005
  시나리오: 탈출구로 fail-closed 를 끌 수 있다
    조건 VIBE_HOOK_FAILCLOSED 가 0 이고 guard 가 예외를 던질 때
    만일 PreToolUse 디스패처를 실행하면
    그러면 종료 코드가 0 이다

  @wave-b @REQ-audit-p2-remediation-006
  시나리오: 문서 안의 console.log 는 P1 이 아니다
    조건 JSDoc 예시 또는 마크다운 템플릿 리터럴에 console.log 가 있는 ts 파일에서
    만일 code-check 를 실행하면
    그러면 console 관련 P1 이 0건이다

  @wave-b @REQ-audit-p2-remediation-006
  시나리오: 진짜 console.log 호출은 여전히 잡힌다
    조건 실행 경로에 console.log 호출이 있는 ts 파일에서
    만일 code-check 를 실행하면
    그러면 해당 줄이 P1 으로 보고된다

  @wave-b @REQ-audit-p2-remediation-006
  시나리오: 여러 줄에 걸친 주석과 템플릿을 가로질러도 판정이 유지된다
    조건 블록 주석과 여러 줄 템플릿 리터럴이 섞인 ts 파일에서
    만일 code-check 를 실행하면
    그러면 코드 구간의 호출만 P1 으로 보고된다

  @wave-b @REQ-audit-p2-remediation-007
  시나리오: Figma 추출 경로에 any 가 없다
    조건 FigmaApiNode 입력 타입을 도입한 뒤
    만일 src/infra/lib/figma 의 프로덕션 코드를 검사하면
    그러면 any·as any·@ts-ignore 가 0건이다
    그리고 tsc --noEmit 은 exit 0 이다

  @wave-b @REQ-audit-p2-remediation-007
  시나리오: 실제 응답 형태에서 타입 가드가 동작한다
    조건 Figma REST 응답 fixture 가 주어졌을 때
    만일 추출을 실행하면
    그러면 결과가 FigmaNode 계약을 만족한다
    그리고 미지 필드는 런타임 오류 없이 무시된다

  # ─── Wave C — 고위험 모듈 커버리지 ────────────────────────────────

  @wave-c @REQ-audit-p2-remediation-008
  시나리오: 프로토콜 변환이 검증된다
    조건 Anthropic 형식 요청이 주어졌을 때
    만일 OpenAI 형식으로 변환하면
    그러면 메시지·도구·도구선택·종료사유가 계약대로 매핑된다
    그리고 네트워크 호출이나 포트 바인딩이 발생하지 않는다

  @wave-c @REQ-audit-p2-remediation-008
  시나리오: SSE 스트림 상태 전이가 검증된다
    조건 스트림 청크 시퀀스가 주어졌을 때
    만일 순서대로 처리하면
    그러면 시작·delta·tool_call·종료 이벤트가 올바른 순서로 방출된다

  @wave-c @REQ-audit-p2-remediation-009
  시나리오: clone 추출의 순수 경로가 검증된다
    조건 캡처된 DOM/CSS 입력이 주어졌을 때
    만일 추출을 실행하면
    그러면 결과가 기대 구조와 일치한다
    그리고 헤드리스 브라우저를 기동하지 않는다

  @wave-c @REQ-audit-p2-remediation-010
  시나리오: 초기화가 대상 디렉터리 밖을 건드리지 않는다
    조건 임시 디렉터리에서
    만일 init 을 실행하면
    그러면 기대 산출물이 그 디렉터리 안에 생성된다
    그리고 사용자 홈이나 전역 경로에 쓰지 않는다

  @wave-c @REQ-audit-p2-remediation-010
  시나리오: 초기화는 멱등하다
    조건 이미 초기화된 디렉터리에서
    만일 init 을 다시 실행하면
    그러면 기존 사용자 설정이 파괴되지 않는다

  # ─── Wave D — 조사 산출물 ────────────────────────────────────────

  @wave-d @REQ-audit-p2-remediation-011
  시나리오: 메이저 갱신 계획이 근거를 갖춘다
    조건 typescript·@types/node·ts-morph 갱신을 검토할 때
    만일 계획 문서를 작성하면
    그러면 패키지별 breaking change 가 출처와 함께 나열된다
    그리고 이 저장소에서 영향받는 파일이 근거 명령과 함께 제시된다
    그리고 권장 순서와 단계별 롤백 방법이 포함된다
