# Mode 4: Project Quality Analysis (--code/--deps/--arch)

> vibe.analyze SKILL.md 의 모드 라우팅에서 **이 모드가 선택됐을 때만** 로드한다.

## Mode 4: Project Quality Analysis (--code/--deps/--arch)

### Scope

- **Default** (`/vibe.analyze`): Full analysis (code + dependencies + architecture)
- `--code`: Code quality only
- `--deps`: Dependency analysis only
- `--arch`: Architecture analysis only

### Code Quality (--code)

- Cyclomatic complexity analysis
- Code quality validation
- Coupling/cohesion assessment

### Dependencies (--deps)

- Read `package.json` / `pyproject.toml` / `pubspec.yaml`
- Detect version conflicts, security vulnerabilities, outdated packages

### Architecture (--arch)

- Identify core modules
- Map module dependencies
- Detect circular dependencies and layer violations

### Report

Save to `.vibe/reports/analysis-{date}.md`:

> Read `references/output-templates.md` for the full Mode 4 report format.
