# /vibe — Routing Examples & Output Format

> vibe SKILL.md 에서 참조. 라우팅 예시 4종과 최종 출력 포맷.

## Routing Examples

### 예시 1: 신규 + figma

```
입력: /vibe "https://www.figma.com/design/abc/login 로 로그인 페이지"

→ Intent: figma-driven UI
→ Resume: 없음
→ Pipeline:
   1. /vibe.figma  (figma Extract + Convert Mode)
   2. /vibe.spec   (생성된 SPEC 자동 보정)
   3. /vibe.run
   4. /vibe.verify
   5. /vibe.trace
```

### 예시 2: Resume

```
입력: /vibe "이어서"  (혹은 빈 호출)

→ Resume: .vibe/specs/login/ 발견 (3개 phase 파일)
→ .vibe/features/login/ 없음
→ Pipeline:
   1. /vibe.run (구현부터)
   2. /vibe.verify
   3. /vibe.trace
```

### 예시 3: Review only

```
입력: /vibe "이 코드 리뷰만" + 📎 src/auth/login.ts

→ Intent: review only
→ Pipeline:
   1. /vibe.review (단일 phase)
```

### 예시 4: automationLevel autonomous (ultrawork 별칭)

```
입력: /vibe "결제 API 만들어줘" ultrawork

→ automationLevel: autonomous 설정 → SPEC 승인 게이트 skip
→ 병렬 ACT 활성화
→ ANCHOR→ACT→JUDGE→RECORD 루프 (게이트 통과까지 자동 반복)
→ stuck 시 TODO 기록 후 루프 종료 (사용자 질문 없음)
```


## Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 /vibe Dynamic Dispatcher
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Phase 0: Input 분석]
...

[Phase 1: Intent 분류]
→ new feature + figma-driven UI

[Phase 2: Resume 감지]
→ 진행 중인 작업 없음

[Phase 3: 파이프라인 설계]
...

[Phase 4: 실행]
... (SPEC 승인은 spec 단계 내부의 1회 게이트)

[Phase 5: 종료 보고]
...
```

---

ARGUMENTS: {자연어 요구사항 + 첨부}
