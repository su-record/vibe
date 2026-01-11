# /vibe.setup

vibe 플러그인 MCP 서버 설정

---

## 실행 절차

### 1. 현재 MCP 서버 상태 확인

```bash
claude mcp list
```

### 2. context7 설정 (필수)

context7이 없으면 설치:

```bash
claude mcp add context7 -- npx -y @anthropic/context7-mcp@latest
```

### 3. GPT 설정 (선택)

GPT 연동이 필요하면:

```bash
# 1. vibe-gpt MCP 서버 추가
claude mcp add vibe-gpt -- npx -y @anthropic/vibe-gpt-mcp@latest

# 2. OAuth 인증 (브라우저 열림)
# 첫 사용 시 자동으로 인증 페이지로 이동
```

**용도:**
- security-advisory-agent: CVE/보안 취약점 DB 지식 보강
- python-reviewer: Python 코드 리뷰 2nd opinion

### 4. Gemini 설정 (선택)

Gemini 연동이 필요하면:

```bash
# 1. vibe-gemini MCP 서버 추가
claude mcp add vibe-gemini -- npx -y @anthropic/vibe-gemini-mcp@latest

# 2. OAuth 인증 (브라우저 열림)
# 첫 사용 시 자동으로 인증 페이지로 이동
```

**용도:**
- framework-docs-agent: context7 문서 부재 시 웹 검색으로 최신 문서 보강

---

## 설정 확인

설정 후 확인:

```bash
claude mcp list
```

예상 출력:
```
context7: connected
vibe-gpt: connected (optional)
vibe-gemini: connected (optional)
```

---

## 문제 해결

### MCP 서버 연결 실패

```bash
# 서버 제거 후 재등록
claude mcp remove context7
claude mcp add context7 -- npx -y @anthropic/context7-mcp@latest
```

### OAuth 인증 만료

```bash
# 인증 갱신 (해당 MCP 도구 호출 시 자동 갱신)
```

---

## 참고

- GPT/Gemini 없이도 vibe는 정상 작동합니다
- 외부 LLM은 특정 에이전트의 보조 역할만 수행
- context7만 있어도 대부분의 기능 사용 가능

ARGUMENTS: $ARGUMENTS
