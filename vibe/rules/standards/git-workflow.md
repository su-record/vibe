# Git Workflow Standards

> 일관된 Git 워크플로우는 협업 효율과 코드 품질의 기반이다.

## 1. 브랜치 전략

```
main (또는 master)
  └── develop
       ├── feature/기능명     ← 새 기능
       ├── fix/버그명          ← 버그 수정
       ├── refactor/대상      ← 리팩토링
       ├── docs/문서명         ← 문서 작업
       ├── test/테스트대상     ← 테스트 추가
       └── chore/작업명        ← 빌드/설정
```

### 브랜치 네이밍 규칙

| 유형 | 패턴 | 예시 |
|------|------|------|
| 기능 | `feature/기능명` | `feature/login-form` |
| 버그 | `fix/버그명` | `fix/null-pointer-error` |
| 리팩토링 | `refactor/대상` | `refactor/auth-module` |
| 문서 | `docs/문서명` | `docs/api-guide` |
| 테스트 | `test/대상` | `test/payment-flow` |
| 설정 | `chore/작업명` | `chore/eslint-config` |

## 2. Conventional Commits (한국어 형식)

### 커밋 메시지 구조

```
[타입] 제목 (50자 이내)

본문 (선택, 72자 줄바꿈)
- 무엇을 변경했는지
- 왜 변경했는지

Co-Authored-By: Claude <noreply@anthropic.com>
```

### 커밋 타입

| 타입 | 설명 | 예시 |
|------|------|------|
| `feat` | 새 기능 추가 | `[feat] 로그인 폼 구현` |
| `fix` | 버그 수정 | `[fix] 이메일 유효성 검증 오류 수정` |
| `docs` | 문서 변경 | `[docs] API 사용 가이드 추가` |
| `style` | 포맷팅 (코드 변경 없음) | `[style] ESLint 규칙 적용` |
| `refactor` | 리팩토링 | `[refactor] 인증 모듈 구조 개선` |
| `test` | 테스트 추가/수정 | `[test] 결제 플로우 E2E 테스트 추가` |
| `chore` | 빌드, 설정 변경 | `[chore] CI 파이프라인 설정` |
| `perf` | 성능 개선 | `[perf] 목록 렌더링 최적화` |

### 커밋 메시지 예시

```bash
# ✅ Good: 명확한 의도와 이유
[feat] 소셜 로그인 (Google OAuth) 추가

- Google OAuth 2.0 인증 플로우 구현
- 기존 이메일 계정과 자동 연결 지원

Co-Authored-By: Claude <noreply@anthropic.com>
```

```bash
# ✅ Good: 간결하지만 충분한 정보
[fix] 비밀번호 재설정 토큰 만료 검증 누락 수정
```

```bash
# ❌ Bad: 모호한 메시지
[fix] 버그 수정
```

```bash
# ❌ Bad: 영어 + 의미 불명확
Updated stuff
```

```bash
# ❌ Bad: 너무 긴 제목 (50자 초과)
[feat] 사용자 프로필 페이지에서 아바타 업로드 기능 추가하고 이미지 리사이징 및 크롭 처리
```

### Co-Authored-By 규칙

- AI가 생성/수정한 코드에는 반드시 `Co-Authored-By` 추가
- Claude 사용 시: `Co-Authored-By: Claude <noreply@anthropic.com>`
- 여러 기여자가 있는 경우 각각 별도 줄로 추가

## 3. PR 체크리스트

PR 생성 시 반드시 확인:

### 필수 항목

- [ ] 테스트 통과 (unit + integration)
- [ ] 린트 통과 (ESLint/Prettier)
- [ ] 타입 체크 통과 (tsc --noEmit)
- [ ] 빌드 성공
- [ ] 리뷰어 최소 1명 지정
- [ ] 관련 이슈 연결 (`Closes #123`)

### 권장 항목

- [ ] CI 파이프라인 전체 통과
- [ ] 코드 커버리지 감소 없음
- [ ] 변경 사항 스크린샷/GIF 첨부 (UI 변경 시)
- [ ] 마이그레이션 필요 시 마이그레이션 스크립트 포함
- [ ] 환경 변수 추가 시 `.env.example` 업데이트
- [ ] Breaking change 시 명시적 안내

### PR 제목 형식

```bash
# ✅ Good
[feat] 소셜 로그인 기능 추가 (#123)

# ✅ Good
[fix] 결제 프로세스 타임아웃 오류 수정

# ❌ Bad
Update code

# ❌ Bad
fix
```

### PR 본문 템플릿

```markdown
## 변경 사항
- [주요 변경 내용 목록]

## 관련 이슈
- Closes #123

## 테스트
- [테스트 방법 및 결과]

## 스크린샷
(UI 변경 시)
```

## 4. 금지사항

### 절대 금지

| 금지 항목 | 이유 |
|----------|------|
| main/master에 직접 push | 리뷰 없이 프로덕션 코드 변경 위험 |
| `--force` push (특별한 경우 제외) | 다른 개발자의 변경사항 유실 위험 |
| `.env` 파일 커밋 | 시크릿 노출 위험 |
| `credentials.json` 커밋 | 인증 정보 노출 위험 |
| 대용량 바이너리 커밋 | 저장소 크기 증가, 클론 속도 저하 |
| `node_modules/` 커밋 | 불필요한 의존성 추적 |

### 주의 항목

| 주의 항목 | 가이드 |
|----------|--------|
| rebase | 공유 브랜치에서는 사용 금지, 로컬 브랜치에서만 사용 |
| cherry-pick | 커밋 이력 일관성 고려, 필요 시 기록 남기기 |
| squash merge | PR 단위 이력 관리가 필요할 때 사용 |

```bash
# ❌ Bad: force push
git push --force origin main

# ✅ Good: force-with-lease (안전한 대안)
git push --force-with-lease origin feature/my-branch
```

## 5. `.gitignore` 필수 항목

```gitignore
# 환경 변수
.env
.env.local
.env.*.local

# 의존성
node_modules/

# 빌드 산출물
dist/
build/
.next/

# IDE 설정
.vscode/settings.json
.idea/

# OS 파일
.DS_Store
Thumbs.db

# 인증/시크릿
*.pem
credentials.json
service-account.json
```

## 6. Git Hooks 권장 설정

```json
// package.json (husky + lint-staged)
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

- **pre-commit**: 린트 + 포맷팅 자동 적용
- **commit-msg**: 커밋 메시지 형식 검증
- **pre-push**: 테스트 실행

## 7. 릴리스 태깅

```bash
# 시맨틱 버저닝 (SemVer)
git tag -a v1.2.3 -m "[release] v1.2.3 — 소셜 로그인 기능"
git push origin v1.2.3
```

| 버전 | 변경 유형 |
|------|----------|
| Major (1.x.x) | Breaking changes |
| Minor (x.1.x) | 새 기능 (하위 호환) |
| Patch (x.x.1) | 버그 수정 |

> **vibe 도구 연계**: `/vibe.review`의 git-history 에이전트가 커밋 이력과 워크플로우 규칙 준수를 자동 검증한다
