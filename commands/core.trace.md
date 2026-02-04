# /core.trace

Generate and display Requirements Traceability Matrix (RTM).

## Usage

```bash
/core.trace "feature-name"              # Generate RTM for feature
/core.trace "feature-name" --html       # Output as HTML
/core.trace "feature-name" --save       # Save to file
```

## Description

Requirements Traceability Matrix (RTM) tracks the relationship between:
- **Requirements** (REQ-xxx-xxx)
- **SPEC sections** (Phase tasks)
- **Feature scenarios** (BDD)
- **Test files** (unit/integration tests)

## Process

### 1. Load Files

```
📄 .claude/core/specs/{feature-name}.md      → SPEC
📄 .claude/core/features/{feature-name}.feature → Feature
📄 src/**/*.test.ts                           → Tests (auto-detect)
```

### 2. Extract Mappings

For each requirement ID (REQ-xxx-xxx):
1. Find corresponding SPEC section
2. Find matching Feature scenario
3. Find related test file

### 3. Calculate Coverage

```
Coverage = (Full coverage items / Total requirements) × 100%

Full coverage = Has SPEC + Feature + Test
Partial = Missing one or more
None = Only in SPEC
```

### 4. Output RTM

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 REQUIREMENTS TRACEABILITY MATRIX: {feature-name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Summary
| Metric            | Value    |
|-------------------|----------|
| Total Requirements| 10       |
| SPEC Coverage     | 10/10    |
| Feature Coverage  | 8/10     |
| Test Coverage     | 6/10     |
| **Overall**       | **60%**  |

## Traceability Matrix

| Requirement | SPEC | Feature | Test | Coverage |
|-------------|------|---------|------|----------|
| REQ-login-001 | ✅ Phase 1 | ✅ Scenario 1 | ✅ login.test.ts | ✅ Full |
| REQ-login-002 | ✅ Phase 1 | ✅ Scenario 2 | ❌ | ⚠️ Partial |
| REQ-login-003 | ✅ Phase 2 | ❌ | ❌ | ❌ None |

## Uncovered Requirements

The following requirements lack full coverage:

- **REQ-login-002**: Password validation
  - Missing: Test file

- **REQ-login-003**: Remember me functionality
  - Missing: Feature scenario, Test file

## Recommendations

⚠️ Coverage is at 60%. Consider:
- Add Feature scenarios for uncovered requirements
- Add test cases for uncovered requirements

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Example

```
User: /core.trace "login"

Claude:
📊 Generating RTM for "login"...

Loading files:
  ✅ SPEC: .claude/core/specs/login.md (5 requirements)
  ✅ Feature: .claude/core/features/login.feature (4 scenarios)
  ✅ Tests: 3 test files found

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 REQUIREMENTS TRACEABILITY MATRIX: login
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Summary
| Metric            | Value    |
|-------------------|----------|
| Total Requirements| 5        |
| SPEC Coverage     | 5/5      |
| Feature Coverage  | 4/5      |
| Test Coverage     | 3/5      |
| **Overall**       | **60%**  |

## Traceability Matrix

| Requirement | SPEC | Feature | Test | Coverage |
|-------------|------|---------|------|----------|
| REQ-login-001 | ✅ | ✅ | ✅ | ✅ Full |
| REQ-login-002 | ✅ | ✅ | ✅ | ✅ Full |
| REQ-login-003 | ✅ | ✅ | ✅ | ✅ Full |
| REQ-login-004 | ✅ | ✅ | ❌ | ⚠️ Partial |
| REQ-login-005 | ✅ | ❌ | ❌ | ❌ None |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Tool Integration

The RTM generation uses core tools:

```bash
# Generate RTM
node -e "import('@su-record/core/tools').then(t => t.generateTraceabilityMatrix('login').then(m => console.log(t.formatMatrixAsMarkdown(m))))"

# Generate HTML
node -e "import('@su-record/core/tools').then(t => t.generateTraceabilityMatrix('login').then(m => console.log(t.formatMatrixAsHtml(m))))"
```

## Options

| Option | Description |
|--------|-------------|
| `--html` | Output as HTML file |
| `--save` | Save to `.claude/core/reports/{feature}-rtm.md` |
| `--json` | Output as JSON |

## Coverage Targets

| Coverage Level | Status |
|----------------|--------|
| 90-100% | ✅ Excellent - Ready for release |
| 70-89% | ⚠️ Good - Minor gaps |
| 50-69% | ⚠️ Fair - Significant gaps |
| 0-49% | ❌ Poor - Major gaps |

---

ARGUMENTS: {feature-name}
