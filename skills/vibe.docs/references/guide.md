# /vibe.docs guide — User Guide

> vibe.docs SKILL.md 의 서브커맨드 표에서 **`guide` 가 선택됐을 때만** 로드한다.

### `/vibe.docs guide` — User Guide

Generate a step-by-step user guide:

1. **Installation**: Detect package manager, prerequisites
2. **Configuration**: Find all config files, document each option
3. **Usage**: Extract CLI commands or API usage patterns
4. **FAQ**: Common issues from error handling patterns
5. **Troubleshooting**: Known edge cases from test files

Output: `docs/GUIDE.md`

**Analysis approach:**
```
Full-file reading: package.json → bin, scripts, peerDependencies
File-pattern search: src/cli/commands/*.ts → CLI command list
Text search: pattern="throw new|Error\(" → common error scenarios
Text search: pattern="(process\.env|config)\.\w+" → configuration options
```
