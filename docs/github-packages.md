# GitHub Packages 배포

`@su-record/core`는 **GitHub Packages** (npm 레지스트리)로 배포됩니다. 저장소가 비공개이므로 패키지도 **비공개**이며, 설치 시 인증이 필요합니다.

## 배포 방법

### 1. 자동 배포 (권장)

- **Release 발행 시**: GitHub에서 새 Release를 `publish`하면 워크플로우가 자동으로 `npm publish`를 실행합니다.
- **수동 실행**: Actions → "Publish to GitHub Packages" → "Run workflow"

### 2. 로컬에서 수동 배포

1. GitHub Personal Access Token (classic) 생성  
   - Scopes: `write:packages`, `read:packages` (필요 시 `repo`)
2. 인증:
   ```bash
   npm login --scope=@su-record --auth-type=legacy --registry=https://npm.pkg.github.com
   # Username: GitHub 사용자명
   # Password: 위에서 만든 토큰
   ```
3. 빌드 후 배포:
   ```bash
   npm run build
   npm publish
   ```
   (비공개 레포에서는 패키지가 자동으로 비공개로 배포됩니다.)

`package.json`의 `publishConfig.registry`가 이미 `https://npm.pkg.github.com`로 설정되어 있어 별도 레지스트리 지정 없이 배포됩니다.

## 설치 (소비자)

비공개 패키지이므로 **인증이 필수**입니다. 프로젝트 또는 사용자 `.npmrc`에 스코프 레지스트리와 토큰을 설정하세요.

### 프로젝트에 `.npmrc` 추가

```ini
@su-record:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

- 로컬: `GITHUB_TOKEN` 환경변수에 **Personal Access Token (classic)** 설정 (scope: `read:packages`)
- CI: `secrets.GITHUB_TOKEN` 또는 저장소/패키지 접근 권한이 있는 PAT 사용

### 전역 설치 예시

```bash
# .npmrc 설정 후
npm install -g @su-record/core
vibe init
```

## 관련 파일

| 파일 | 역할 |
|------|------|
| `package.json` | `publishConfig.registry` → GitHub Packages |
| `.npmrc` | `@su-record` 스코프를 GitHub Packages로 매핑 |
| `.github/workflows/publish.yml` | Release 시 또는 수동 실행 시 배포 |
