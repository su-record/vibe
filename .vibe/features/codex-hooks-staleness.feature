# language: ko
기능: Codex 프로젝트 훅 staleness 복구
  vibe upgrade 가 .claude 와 동일하게 .codex/hooks.json 의 내용 불일치까지 복구한다.
  Stakes: production

  배경:
    조건 vibe 프로젝트로 인식되는 임시 디렉토리가 있다

  # DC-3
  시나리오: 설치본이 현재 훅 정의와 어긋나면 복구한다
    조건 .codex/hooks.json 이 PostCompact 이벤트 없이 설치돼 있다
    만일 repairProjectHooks 를 호출하면
    그러면 반환값에 ".codex/hooks.json (stale)" 이 포함된다
    그리고 파일의 hooks 키가 buildCodexHooksConfig().hooks 와 정확히 일치한다

  # DC-3, DC-4
  시나리오: 설치본이 현재 정의와 일치하면 건드리지 않는다
    조건 .codex/hooks.json 이 현재 정의와 정확히 일치한다
    만일 repairProjectHooks 를 호출하면
    그러면 반환값에 .codex 관련 항목이 없다

  # DC-4
  시나리오: hooks 키가 없는 설치본은 미설치로 보고 복구하되 사용자 키는 보존한다
    조건 .codex/hooks.json 에 hooks 키 없이 사용자 키만 있다
    만일 repairProjectHooks 를 호출하면
    그러면 반환값에 ".codex/hooks.json" 이 포함된다
    그리고 기존 사용자 키가 그대로 남아 있다

  # DC-4
  시나리오: 판독 불가한 설치본은 stale 로 오판하지 않는다
    조건 .codex/hooks.json 이 깨진 JSON 이다
    만일 repairProjectHooks 를 호출하면
    그러면 예외가 밖으로 새지 않는다
    그리고 미설치 경로로 훅이 복구된다

  # DC-3
  시나리오: Claude 쪽 stale 보고는 회귀 없이 유지된다
    조건 .claude/settings.local.json 이 템플릿과 어긋나 있다
    만일 repairProjectHooks 를 호출하면
    그러면 반환값에 ".claude/settings.local.json (stale)" 이 포함된다
