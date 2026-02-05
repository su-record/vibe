# Security Standards

> 보안은 기능이 아닌 기본 요구사항이다. 모든 코드는 보안을 내재화해야 한다.

## 1. 시크릿 관리

### 필수 원칙

- 모든 시크릿(API 키, 토큰, 비밀번호)은 **환경 변수**로 관리한다
- `.env` 파일은 `.gitignore`에 반드시 포함한다
- `.env.example` 파일에 키 이름만(값 제외) 문서화한다
- 시크릿 로테이션 권장 주기: 90~180일 (관리형 키, 개발 환경은 예외)
- 유출 의심, 팀원 퇴사 시 즉시 로테이션 트리거

```typescript
// ❌ Bad: 하드코딩된 시크릿
const apiKey = "sk-proj-xxxxx";
const dbPassword = "admin1234";

// ✅ Good: 환경 변수 사용
const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error("API_KEY 환경 변수가 설정되지 않았습니다");
}
```

### `.env.example` 패턴

```bash
# .env.example — 키 이름만 기록, 실제 값은 넣지 않음
DATABASE_URL=
API_KEY=
JWT_SECRET=
```

## 2. OWASP Top 10 (2021) 체크리스트

> 버전: OWASP Top 10 — 2021

### A01: Broken Access Control

- [ ] 모든 엔드포인트에 인증/인가 검증 적용
- [ ] CORS 허용 오리진 최소화 (`*` 사용 금지)
- [ ] 디렉토리 트래버설 방지 (경로 정규화)
- [ ] 리소스 ID 기반 접근 시 소유권 검증

```typescript
// ❌ Bad: 소유권 검증 없이 리소스 반환
app.get("/api/orders/:id", async (req, res) => {
  const order = await db.orders.findById(req.params.id);
  res.json(order);
});

// ✅ Good: 소유권 검증 포함
app.get("/api/orders/:id", auth, async (req, res) => {
  const order = await db.orders.findById(req.params.id);
  if (order.userId !== req.user.id) {
    return res.status(403).json({ error: "접근 권한이 없습니다" });
  }
  res.json(order);
});
```

### A02: Cryptographic Failures

- [ ] 민감 데이터 전송 시 TLS(HTTPS) 강제
- [ ] 비밀번호는 bcrypt/argon2로 해싱 (SHA256 사용 금지)
- [ ] 대칭키 암호화 시 AES-256-GCM 이상 사용

### A03: Injection

- [ ] SQL 쿼리 파라미터화 (Prepared Statements)
- [ ] ORM 사용 시에도 raw query 파라미터 바인딩 검증
- [ ] OS 명령어 실행 시 화이트리스트 기반 검증

```typescript
// ❌ Bad: SQL Injection 취약
const query = `SELECT * FROM users WHERE id = '${userId}'`;

// ✅ Good: 파라미터화된 쿼리
const query = "SELECT * FROM users WHERE id = $1";
const result = await db.query(query, [userId]);
```

### A04: Insecure Design

- [ ] 비즈니스 로직에 rate limiting 적용
- [ ] 인증 실패 횟수 제한 (계정 잠금 또는 지연)
- [ ] 민감한 작업에 재인증 요구

### A05: Security Misconfiguration

- [ ] 프로덕션에서 디버그 모드 비활성화
- [ ] 기본 계정/비밀번호 변경
- [ ] 불필요한 HTTP 메서드 비활성화
- [ ] 보안 헤더 설정 (아래 별도 섹션 참고)

### A06: Vulnerable Components

- [ ] `npm audit` 주기적 실행
- [ ] 취약점 심각도별 대응: Critical/High → 즉시 패치, Medium → 1주 내, Low → 다음 릴리스
- [ ] Snyk 등 도구 도입 검토 (선택 사항)

### A07: Authentication Failures

- [ ] 세션 토큰 충분한 엔트로피 확보
- [ ] 로그인 실패 시 구체적 정보 미노출 ("이메일 또는 비밀번호가 올바르지 않습니다")
- [ ] MFA 도입 검토

```typescript
// ❌ Bad: 구체적 실패 원인 노출
throw new Error("비밀번호가 틀렸습니다");

// ✅ Good: 통합 에러 메시지
throw new Error("이메일 또는 비밀번호가 올바르지 않습니다");
```

### A08: Software and Data Integrity Failures

- [ ] CI/CD 파이프라인 무결성 검증
- [ ] 패키지 잠금 파일(package-lock.json) 커밋
- [ ] 자동 업데이트 시 서명 검증

### A09: Security Logging and Monitoring Failures

- [ ] 인증 실패, 접근 거부 등 보안 이벤트 로깅
- [ ] 로그에 민감 정보(PII, 비밀번호) 제외
- [ ] 이상 탐지 알림 설정

### A10: Server-Side Request Forgery (SSRF)

- [ ] 사용자 입력 URL의 화이트리스트 검증
- [ ] 내부 네트워크 주소(127.0.0.1, 10.x.x.x 등) 차단
- [ ] 리다이렉트 허용 시 대상 도메인 검증

## 3. XSS 방지

```typescript
// ❌ Bad: dangerouslySetInnerHTML 무분별 사용
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ✅ Good: DOMPurify로 새니타이즈
import DOMPurify from "dompurify";
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />
```

- [ ] 사용자 입력 출력 시 HTML 이스케이프
- [ ] CSP 헤더로 인라인 스크립트 제한
- [ ] React JSX 기본 이스케이프를 활용하고, `dangerouslySetInnerHTML` 최소화

## 4. CSRF 방지

- [ ] 상태 변경 요청에 CSRF 토큰 적용
- [ ] SameSite 쿠키 속성 설정 (`Strict` 또는 `Lax`)
- [ ] Origin/Referer 헤더 검증

## 5. 인증/권한 검증 패턴

```typescript
// ✅ Good: 미들웨어 기반 인증/인가
const authMiddleware = (requiredRole: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "인증이 필요합니다" });
    }
    try {
      const decoded = verifyToken(token);
      if (!decoded.roles.includes(requiredRole)) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }
      req.user = decoded;
      next();
    } catch {
      return res.status(401).json({ error: "유효하지 않은 토큰입니다" });
    }
  };
};
```

## 6. 세션/쿠키 보안

```typescript
// ❌ Bad: 안전하지 않은 쿠키 설정
res.cookie("session", token);

// ✅ Good: 보안 플래그 적용
res.cookie("session", token, {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  maxAge: 3600000,
});
```

## 7. 보안 헤더

```typescript
// ✅ Good: 필수 보안 헤더 설정
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "default-src 'self'");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});
```

## 8. CORS 설정

```typescript
// ❌ Bad: 모든 오리진 허용
app.use(cors({ origin: "*" }));

// ✅ Good: 허용 오리진 명시
app.use(cors({
  origin: ["https://myapp.com", "https://admin.myapp.com"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));
```

## 9. 파일 업로드 보안

- [ ] 파일 크기 제한 설정 (최대 10MB 등)
- [ ] 허용 MIME 타입 화이트리스트
- [ ] 파일명 재생성 (UUID 기반)
- [ ] 업로드 디렉토리에 실행 권한 제거

```typescript
// ❌ Bad: 파일 업로드 제한 없음
app.post("/upload", upload.single("file"), handler);

// ✅ Good: 파일 타입/크기 제한
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    cb(null, allowed.includes(file.mimetype));
  },
});
```

## 10. 로그 마스킹 / PII 처리

```typescript
// ❌ Bad: 민감 정보 로그 출력
logger.info(`User login: ${email}, password: ${password}`);

// ✅ Good: 민감 정보 마스킹
logger.info(`User login: ${maskEmail(email)}`);

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}
```

## 11. 의존성 보안

### `npm audit` 실행 가이드

```bash
# 취약점 확인
npm audit

# 자동 수정 가능한 항목 패치
npm audit fix

# breaking change 포함 패치 (주의 필요)
npm audit fix --force
```

### 심각도별 대응 기준

| 심각도 | 대응 | 기한 |
|--------|------|------|
| Critical | 즉시 패치 | 당일 |
| High | 우선 패치 | 2일 이내 |
| Medium | 계획 패치 | 1주 이내 |
| Low | 다음 릴리스 | 다음 배포 |

## 12. 보안 이슈 발견 시 프로토콜

1. 즉시 작업 중단
2. `security-reviewer` 에이전트 호출
3. 심각도 분류: **Critical** → 즉시 중단 후 사용자 보고 | High → 우선 수정 | Medium/Low → 리포트 후 계획 수정
4. 노출된 시크릿은 즉시 로테이션
5. 전체 코드베이스에서 유사 이슈 검토 (Grep 도구 활용)

## 필수 보안 체크리스트

커밋 전 반드시 확인:

- [ ] 하드코딩된 시크릿 없음
- [ ] 모든 사용자 입력 검증됨
- [ ] SQL Injection 방지 (파라미터화된 쿼리)
- [ ] XSS 방지 (HTML 이스케이프)
- [ ] CSRF 보호 활성화
- [ ] 인증/권한 검증됨
- [ ] 에러 메시지에 민감 정보 노출 없음
- [ ] 보안 헤더 설정 확인
- [ ] CORS 오리진 최소화
- [ ] 로그에 PII 미포함
