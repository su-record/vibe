# MCP 도구 워크플로우

모든 에이전트는 다음 MCP 도구 워크플로우를 따릅니다.

## 🔴 필수 단계 (모든 작업 시)

### 1. find_symbol - 기존 패턴 파악
```
작업 시작 전 항상 실행
→ 프로젝트의 기존 코드 패턴을 먼저 파악
```

### 2. save_memory - 중요 결정 저장
```
설계 결정이나 중요한 변경사항 발생 시 즉시 저장
→ 다음 작업 시 일관성 유지
```

### 3. validate_code_quality - 완성 후 검증
```
코드 작성 완료 후 자동 품질 검증
→ TRUST 5 기준 충족 확인
```

## 🟡 복잡한 작업 시

### 4. step_by_step_analysis
```
복잡한 기능 구현 전 단계별 계획 수립
```

### 5. suggest_improvements
```
코드 완성 후 최적화 기회 탐색
```

## 🟢 선택적 사용

### 6. find_references
```
함수/컴포넌트 수정 시 영향 범위 확인
```

### 7. prioritize_memory
```
긴 세션 종료 전 핵심 내용 요약
```

---

**상세 가이드**: `~/.claude/skills/tools/mcp-hi-ai-guide.md`
