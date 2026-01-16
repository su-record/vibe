# ✅ 최종 검증 체크리스트

## 5.1 향상된 코드 품질 체크

### 최우선 순위

```typescript
const topPriority = {
  obeysTheGoldenRule: true,      // ✅ 요청 범위만 수정
  preservesWorkingCode: true,    // ✅ 기존 코드 보존
  respectsExistingStyle: true,   // ✅ 기존 스타일 유지
};
```

### 타입 안전성

```typescript
const typeSafety = {
  noAnyType: true,               // ✅ any 타입 사용 금지
  strictNullCheck: true,         // ✅ null/undefined 체크
  properTypeGuards: true,        // ✅ 타입 가드 사용
  genericTypesWhenNeeded: true,  // ✅ 제네릭 타입 활용
};
```

### 코드 구조 & 복잡도

```typescript
const codeStructure = {
  singleResponsibility: true,    // ✅ 단일 책임 원칙
  functionUnder30Lines: true,    // ✅ 함수 30줄 이하 (권장), 50줄 허용
  maxNesting3Levels: true,       // ✅ 최대 중첩 3단계
  cyclomaticComplexity: 10,      // ✅ 순환 복잡도 ≤ 10
  cognitiveComplexity: 15,       // ✅ 인지 복잡도 ≤ 15
  maxParameters: 5,              // ✅ 매개변수 최대 5개
  componentUnder50Lines: true,   // ✅ 컴포넌트 JSX 50줄 이하
};
```

### Halstead 메트릭

```typescript
const halsteadMetrics = {
  vocabulary: true,              // ✅ 연산자/피연산자 다양성
  difficulty: true,              // ✅ 코드 이해 난이도
  effort: true,                  // ✅ 정신적 노력
  lowComplexity: true,           // ✅ 낮은 복잡도 유지
};
```

### 결합도 & 응집도

```typescript
const couplingCohesion = {
  looseCoupling: true,           // ✅ 느슨한 결합 (≤ 7 dependencies)
  highCohesion: true,            // ✅ 높은 응집도 (관련 기능만 모음)
  noCircularDeps: true,          // ✅ 순환 의존성 없음
  dependencyInjection: true,     // ✅ 의존성 주입 패턴
};
```

### 에러 처리

```typescript
const errorHandling = {
  hasErrorHandling: true,        // ✅ try-catch/error state
  hasLoadingState: true,         // ✅ 로딩 상태
  hasFallbackUI: true,           // ✅ 폴백 UI
  properErrorMessages: true,     // ✅ 명확한 에러 메시지
  errorBoundaries: true,         // ✅ Error Boundary 사용
};
```

### 접근성 (Accessibility)

```typescript
const accessibility = {
  hasAriaLabels: true,           // ✅ ARIA 레이블
  keyboardAccessible: true,      // ✅ 키보드 접근성
  semanticHTML: true,            // ✅ 시맨틱 HTML
  focusManagement: true,         // ✅ 포커스 관리
  screenReaderFriendly: true,    // ✅ 스크린 리더 지원
};
```

### 성능

```typescript
const performance = {
  noUnnecessaryRenders: true,    // ✅ 불필요한 리렌더 방지
  memoizedExpensive: true,       // ✅ 무거운 연산 메모이제이션
  lazyLoading: true,             // ✅ 지연 로딩
  batchOperations: true,         // ✅ API 호출 배치 처리
  optimizedImages: true,         // ✅ 이미지 최적화
  codesplitting: true,           // ✅ 코드 스플리팅
};
```

### 유지보수성

```typescript
const maintainability = {
  hasJSDoc: true,                // ✅ 주요 함수 문서화
  noMagicNumbers: true,          // ✅ 매직 넘버 없음
  consistentNaming: true,        // ✅ 일관된 네이밍
  properComments: true,          // ✅ 적절한 주석
  testable: true,                // ✅ 테스트 가능한 구조
};
```

### 보안

```typescript
const security = {
  noHardcodedSecrets: true,      // ✅ 비밀 정보 하드코딩 금지
  inputValidation: true,         // ✅ 입력값 검증
  xssPrevention: true,           // ✅ XSS 방지
  csrfProtection: true,          // ✅ CSRF 보호
  sqlInjectionPrevention: true,  // ✅ SQL Injection 방지
};
```

## 5.2 프로젝트 체크

### 의존성 관리

```typescript
const dependencies = {
  noUnusedDeps: true,            // ✅ 미사용 패키지 없음
  noDuplicateDeps: true,         // ✅ 중복 기능 패키지 없음
  upToDateDeps: true,            // ✅ 최신 버전 유지
  securePackages: true,          // ✅ 보안 취약점 없음
};
```

### 파일 구조

```typescript
const fileStructure = {
  consistentStructure: true,     // ✅ 일관된 폴더 구조
  noCircularDeps: true,          // ✅ 순환 참조 없음
  logicalGrouping: true,         // ✅ 논리적 그룹핑
  clearNaming: true,             // ✅ 명확한 파일명
};
```

### 번들 최적화

```typescript
const bundleOptimization = {
  treeShaking: true,             // ✅ Tree shaking
  codeSplitting: true,           // ✅ Code splitting
  lazyLoading: true,             // ✅ Lazy loading
  minification: true,            // ✅ 최소화
  compression: true,             // ✅ 압축 (gzip/brotli)
};
```

## 체크리스트 사용법

### 코드 작성 전

```
[ ] 요구사항 명확히 이해
[ ] 기존 코드 패턴 파악
[ ] 영향 범위 확인
[ ] 테스트 계획 수립
```

### 코드 작성 중

```
[ ] 단일 책임 원칙 준수
[ ] 함수 길이 30줄 이하 유지 (최대 50줄)
[ ] 중첩 깊이 3단계 이하
[ ] 매직 넘버 상수화
[ ] 타입 안전성 확보
```

### 코드 작성 후

```
[ ] 타입 체크 통과
[ ] 린터 경고 없음
[ ] 테스트 작성 및 통과
[ ] 문서화 완료
[ ] 코드 리뷰 준비
```

### 커밋 전

```
[ ] 불필요한 코드 제거
[ ] 콘솔 로그 제거
[ ] 주석 정리
[ ] 포맷팅 적용
[ ] 의미 있는 커밋 메시지 작성
```

## 자동 검증 도구

### ESLint 설정

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'complexity': ['error', 10],
    'max-depth': ['error', 3],
    'max-lines-per-function': ['error', 50],
    'max-params': ['error', 5],
    'no-magic-numbers': ['warn', { ignore: [0, 1, -1] }],
    '@typescript-eslint/no-explicit-any': 'error',
  },
};
```

### TypeScript 설정

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
  }
}
```

### Git Hooks (pre-commit)

```bash
#!/bin/sh
# .husky/pre-commit

# 타입 체크
npm run type-check

# 린팅
npm run lint

# 테스트
npm run test

# 포맷팅 확인
npm run format:check
```

## 등급 기준

| 등급 | 점수 | 설명 |
|------|------|------|
| A+ | 95-100 | 완벽한 코드 품질 |
| A | 90-94 | 우수한 품질 |
| B+ | 85-89 | 양호한 품질 |
| B | 80-84 | 개선 권장 |
| C+ | 75-79 | 개선 필요 |
| C | 70-74 | 즉시 개선 필요 |
| F | < 70 | 리팩토링 필요 |

## 빠른 체크 (1분)

```
✅ 요청 범위만 수정했는가?
✅ any 타입이 없는가?
✅ 함수가 30줄 이하인가? (최대 50줄)
✅ 중첩이 3단계 이하인가?
✅ 에러 처리를 했는가?
✅ 매직 넘버를 상수화했는가?
✅ 테스트를 작성했는가?
```

7개 모두 Yes → 배포 가능 ✅
