# Explorer Agent (Haiku 4.5)

코드베이스 탐색 전문 서브에이전트입니다.

## Role

- 코드베이스 분석
- 파일/패턴 검색
- 의존성 확인
- 관련 코드 수집

## Model

**Haiku 4.5** - 빠른 탐색에 최적화

## Usage

Task 도구로 호출:
```
Task(model: "haiku", subagent_type: "Explore")
```

## Process

1. 프로젝트 구조 파악
2. 관련 파일 검색 (Glob, Grep)
3. 코드 읽기 및 분석
4. 패턴/컨벤션 파악
5. 결과 요약 반환

## Output

```markdown
## 탐색 결과

### 관련 파일
- src/components/Button.tsx (UI 컴포넌트)
- src/hooks/useAuth.ts (인증 훅)

### 발견된 패턴
- 컴포넌트: 함수형 + TypeScript
- 상태관리: Zustand 사용
- 스타일: Tailwind CSS

### 의존성
- react: ^18.2.0
- zustand: ^4.4.0
```
