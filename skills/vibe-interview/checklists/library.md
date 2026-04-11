# Discovery Checklist: Library / SDK / CLI

> npm 패키지, Python 라이브러리, CLI 도구, SDK 등 **재사용 가능한 코드 단위**.

## Required

### R1. purpose
**Q**: 이 라이브러리/SDK/CLI가 해결하는 문제는?
**힌트**: 한 문장으로. "X 없이 Y 하기 어려웠는데, 이게 해결."

### R2. target-users
**Q**: 누가 사용하나요?
**힌트**: 예) 프론트엔드 개발자, Python 데이터 분석가, DevOps 엔지니어.
**follow-up**: "사용자의 기술 수준은?"

### R3. core-api
**Q**: 핵심 API 표면은 어떻게 생겼나요?
**힌트**: 예) `import { foo } from 'lib'; foo(x).then(...)`. 1-2줄 사용 예시.

### R4. language-platform
**Q**: 어느 언어/플랫폼 대상인가요?
**힌트**: JS/TS (Node/Browser/Deno/Bun), Python, Go, Rust, 범용 CLI.

### R5. distribution
**Q**: 어떻게 배포하나요?
**힌트**: npm, PyPI, crates.io, Homebrew, 직접 다운로드.

### R6. license
**Q**: 라이선스는?
**힌트**: MIT, Apache 2.0, GPL, 독점.

### R7. success-metric
**Q**: 성공 기준은?
**힌트**: 다운로드 수, GitHub stars, 사용자 피드백, 특정 프로젝트 적용.

## Optional

### O1. dependency-policy
**Q**: 의존성 정책이 있나요?
**힌트**: zero-dep / minimal / 자유롭게.

### O2. bundle-size
**Q**: 번들 크기 목표가 있나요? (JS 라이브러리)
**힌트**: 예) < 10KB gzipped.

### O3. tree-shaking
**Q**: Tree-shaking 지원이 필요한가요?
**힌트**: Named exports, ESM-first.

### O4. typescript-support
**Q**: TypeScript 타입 정의가 필요한가요?
**힌트**: 내장, @types 패키지, 없음.

### O5. ssr-browser-support
**Q**: SSR/Browser 양쪽 지원이 필요한가요? (JS)

### O6. api-stability
**Q**: API 안정성 약속은?
**힌트**: SemVer 엄격 준수, 실험적, pre-1.0.

### O7. testing-coverage
**Q**: 테스트 커버리지 목표는?
**힌트**: 예) 90%+, unit only, integration 포함.

### O8. documentation-style
**Q**: 문서 스타일은?
**힌트**: README 위주, 별도 docs site, JSDoc/TSDoc, Storybook.

### O9. examples
**Q**: 예제/템플릿을 얼마나 제공할 것인가요?
**힌트**: Quickstart, Recipes, Playground, CodeSandbox 링크.

### O10. versioning-policy
**Q**: 버저닝 정책은?
**힌트**: SemVer, CalVer, 수동.

### O11. changelog
**Q**: Changelog 관리 방식은?
**힌트**: 수동, Changesets, semantic-release, Keep a Changelog.

### O12. contributing
**Q**: 외부 기여를 받을 계획인가요?
**힌트**: 오픈 / CONTRIBUTING.md / CLA 필요 / 내부 전용.

### O13. ci-tests
**Q**: CI에서 어떤 검증을 돌리나요?
**힌트**: 다중 Node 버전, 다중 OS, 다중 패키지 매니저.

### O14. deprecation-policy
**Q**: 기능 제거 정책이 있나요?
**힌트**: N버전 warning 후 제거, 즉시 제거 금지.

### O15. telemetry
**Q**: 텔레메트리/사용 통계를 수집하나요?
**힌트**: opt-in, opt-out, 없음. 프라이버시 고지 필요.
