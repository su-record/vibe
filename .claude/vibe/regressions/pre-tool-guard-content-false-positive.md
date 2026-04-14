---
slug: pre-tool-guard-content-false-positive
symptom: "Write/Edit이 file_path가 안전한데도 content 내 리터럴('/etc/', '.env' 등) 때문에 차단됨"
root-cause-tag: validation
fix-commit: pending
test-path: hooks/scripts/__tests__/pre-tool-guard.test.js
status: test-generated
registered: 2026-04-14
feature: pre-tool-guard
---

# pre-tool-guard-content-false-positive

## Symptom

`Write` 또는 `Edit` 도구로 안전한 경로(예: `src/machine-key.ts`)에 코드를 쓸 때, 파일 본문에 `/etc/machine-id`, `/usr/sbin/ioreg`, `.env`, `secret` 같은 문자열 리터럴이 포함되어 있으면 critical 레벨로 차단(exit 2)되거나 medium 경고가 발생.

실제 리포트: machine-id 읽기 코드를 `Write`로 작성하려는데 본문의 `/etc/machine-id` 리터럴이 `Writing to system directory` 패턴에 매칭되어 차단됨. 사용자는 우회를 위해 경로를 `['', 'etc', 'machine-id'].join('/')`로 분해해야 했음.

## Reproduction

**Given**: 정상 경로 `src/machine-key.ts`

**When**: `Write` 호출, content에 `'/etc/machine-id'` 문자열 포함

**Then** (broken behavior): exit code 2, "🚫 BLOCKED: Writing to system directory" 출력

**Expected**: exit code 0, 경고 없이 통과 (file_path는 안전하므로)

## Root cause

`pre-tool-guard.js`의 `validateCommand`가 `tool_input` 객체 전체를 `JSON.stringify`한 결과 문자열에 정규식을 매칭함. write/edit 패턴(`/\/etc\//`, `/\.env/` 등)의 의도는 **쓰기 대상 경로** 검사인데 content까지 포함된 합쳐진 문자열을 검사하면서 본문에 리터럴이 들어가면 false positive.

기존 테스트는 모두 argv 모드(`runGuard`)로 file_path만 단일 문자열로 전달했기 때문에 이 케이스를 못 잡음. test 파일에 `// tool_input is stringified — pattern matches against the JSON string`라는 주석으로 동작이 자인되어 있었으나 의도가 아닌 버그였음.

## Fix

`DANGEROUS_PATTERNS` 각 엔트리에 `target` 필드 추가 (`'command' | 'file_path' | 'raw'`). `validateCommand`에서 `extractTarget(rawInput, target)`로 해당 필드만 추출해 매칭. write/edit 패턴은 `target: 'file_path'`로 지정하여 content 영향 차단.

레거시 argv 모드(`runGuard(['Write', '/etc/passwd'])`)도 그대로 동작하도록 `extractTarget`은 JSON 파싱 실패 시 입력 문자열을 그대로 target 값으로 사용.

## Related

- Fix commit: `pending` (이 회귀 레코드와 함께 커밋 예정)
- Regression test: `hooks/scripts/__tests__/pre-tool-guard.test.js` (`describe: regression: write/edit content must not trigger path patterns`)
- 신규 테스트 6개 추가, 32/32 통과 확인

## Notes

- 이 레코드는 `/vibe.regress` 첫 dogfood 사례
- `root-cause-tag: validation`은 "입력 검증 누락" 카테고리 — 검증 대상 필드를 좁히지 않은 것이 근본 원인
- bash 패턴은 영향 없음 (argv mode와 stdin 모두 command 단일 문자열만 검사)
