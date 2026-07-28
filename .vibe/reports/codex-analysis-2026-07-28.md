# Independent Project Quality Analysis — `@su-record/vibe`

- **Date/start:** 2026-07-28 06:47:10 UTC
- **Target:** `/home/ubuntu/repos/vibe`
- **Mode/depth:** `vibe.analyze` Project Quality (code + architecture + dependencies), L4 for reported defects
- **Independence:** `.vibe/reports/analysis-2026-07-28.md` was explicitly excluded and was not read.
- **Worktree:** already dirty before analysis; findings describe the inspected working tree, not necessarily `HEAD`.

## Executive summary

The project compiles under the installed Node 22 / TypeScript 5.9 toolchain, but it has two P1 configuration/correctness defects: published Node 18 compatibility is false, and the Stop hook's supposedly ordered side effects execute concurrently. The requested test command did not complete: many hook tests timed out. Coverage is presently non-runnable and partially points to a nonexistent source directory. Static analysis found one source cycle, two upward `infra -> cli` edges, 141 functions over 50 lines, 175 functions over cyclomatic 10, and direct `any` use in high-risk Figma/memory code.

## Findings by priority

### P1 — broken or silently wrong

#### P1-1. Published Node 18 support is incompatible with production dependencies

`package.json` promises `node >=18.0.0` (`package.json:68-70`) while direct production dependencies include `better-sqlite3` and `@clack/prompts` (`package.json:75-83`). The installed resolved versions are `better-sqlite3@12.11.1`, whose engine is Node `20.x || 22.x || 23.x || 24.x || 25.x || 26.x`, and `@clack/prompts@1.7.0`, whose engine is `>=20.12.0` (`npm ls ... --depth=0` confirmed both are direct). Consequence: Node 18 consumers are told the package is supported but can receive engine warnings, fail native installation, or fail at runtime. This reaches published consumers because both packages are in `dependencies`, not `devDependencies`.

#### P1-2. Stop hook side effects are documented as sequential but are actually parallel

`stop-dispatcher.js` explicitly says ordering avoids auto-commit/git cascade races and lists review -> notify -> auto-commit -> devlog (`hooks/scripts/stop-dispatcher.js:3-17`), then sends all four steps to `dispatch` (`hooks/scripts/stop-dispatcher.js:48-54`). `dispatch` starts every enabled child with `Promise.all` (`hooks/scripts/lib/dispatcher.js:99-109`). Consequence: devlog can observe pre-commit state, notification can precede completion, and auto-commit can race another git-reading/writing hook—the exact failure mode the file claims to prevent. The hook exits successfully even if this block throws (`hooks/scripts/stop-dispatcher.js:48-56`), making the defect silent.

#### P1-3. The required test suite currently cannot establish a green gate

`package.json` makes `vitest run` the test gate (`package.json:32-33`), and both CI and release execute it (`.github/workflows/test.yml:51-55`, `.github/workflows/release.yml:32-36`). Actual `npx vitest run` output showed all 22 `sentinel-guard` tests, all 46 `pre-tool-guard` tests, 5/6 `post-edit-dispatcher` tests, and additional hook tests timing out/failing; the run was interrupted after more than four minutes because each child test repeatedly consumed its 5–30 second timeout. An isolated `npx vitest run hooks/scripts/__tests__/pre-tool-guard.test.js` reproduced the hang. The spawning helper sets a 5-second timeout (`hooks/scripts/__tests__/pre-tool-guard.test.js:16-41`), while the production hook synchronously reads stdin (`hooks/scripts/lib/hook-context.js:38-82`). Consequence: the CI/release gate is currently non-convergent in the inspected environment and cannot prove release safety. Because the worktree was dirty and the sandbox differs from GitHub Actions, the precise portability/root cause needs reproduction in a clean checkout; the observed failure itself is factual.

### P2 — real production or maintenance risk

#### P2-1. Coverage configuration is non-runnable and partially vacuous

Vitest declares V8 coverage and includes `src/lib/**/*.ts` plus `src/tools/**/*.ts` (`vitest.config.ts:23-27`), but `src/lib` does not exist; infrastructure actually lives under `src/infra/lib`. `npx vitest run --coverage` fails immediately with `MISSING DEPENDENCY Cannot find dependency '@vitest/coverage-v8'`, and that provider is absent from `devDependencies` (`package.json:85-92`). No coverage command or threshold is wired into CI (`package.json:23-36`, `.github/workflows/test.yml:26-55`). Consequence: infrastructure coverage is omitted, coverage cannot run on a normal install, and CI can pass without measuring any coverage target.

#### P2-2. Type-safety hard rules are violated in boundary-heavy code

The project forbids `any`, casts to `any`, and ignore directives (`CLAUDE.md:33-34`). Nevertheless, raw Figma API traversal uses `any` throughout (`src/infra/lib/figma/extract.ts:39-40`, `src/infra/lib/figma/extract.ts:158`, `src/infra/lib/figma/extract.ts:235-273`, `src/infra/lib/figma/extract.ts:314`, `src/infra/lib/figma/extract.ts:365-421`); Figma audit repeats it (`src/infra/lib/figma/audit.ts:41-50`, `src/infra/lib/figma/audit.ts:119-128`); graph formatters accept `any[]` (`src/tools/memory/getMemoryGraph.ts:124`, `src/tools/memory/getMemoryGraph.ts:181`, `src/tools/memory/getMemoryGraph.ts:197`); and optional Puppeteer uses both `any` and `@ts-expect-error` (`src/infra/lib/browser/launch.ts:15-20`). Consequence: malformed external JSON can travel deeply before failing, and the declared quality gate does not enforce its own central rule. `npx tsc --noEmit` nevertheless exits 0 because these escapes are legal TypeScript.

#### P2-3. Complexity limits are broadly unenforced

The hard limits are function <=50 lines, nesting <=3, parameters <=5, and cyclomatic <=10 (`CLAUDE.md:38`). AST measurement over 280 production TS/JS files found 2,932 functions: average estimated cyclomatic complexity 3.58, but **141** functions over 50 lines, **175** over cyclomatic 10, **71** over nesting 3, and **5** over 5 parameters. Representative hot spots read in full: `init()` is 311 lines and estimated cyclomatic 56 (`src/cli/commands/init.ts:216-526`); `suggestImprovements()` is 263 lines / 62 (`src/tools/convention/suggestImprovements.ts:27-289`); `checkCouplingCohesion()` is 247 lines / 50 with nesting 4 (`src/tools/convention/checkCouplingCohesion.ts:43-289`); and `extractCSS()` is 189 lines / 64 with nesting 5 (`src/infra/lib/figma/extract.ts:40-228`). Consequence: changes to initialization, quality scoring, and Figma conversion have very large regression surfaces. Metrics are AST estimates (branches plus boolean/conditional paths), not claims of exact runtime path counts.

#### P2-4. One circular dependency and two upward layer edges weaken boundaries

The import graph contains one SCC: `IMemoryStorage` imports `MemoryItem` from the concrete store (`src/infra/lib/memory/IMemoryStorage.ts:7`) while `MemoryStorage` implements/imports the interface (`src/infra/lib/memory/MemoryStorage.ts:4,12-21`). Consequence: the abstraction depends on its implementation, complicating isolated reuse and increasing ESM initialization risk if either import becomes a runtime value. Separately, infrastructure imports CLI-owned config types in the proxy (`src/infra/lib/codex-proxy.ts:13-16`) and global config manager (`src/infra/lib/config/GlobalConfigManager.ts:8-12`). Consequence: low-level infrastructure cannot be reused or tested without the CLI model layer. No other source cycles were found by the resolved relative-import SCC scan.

#### P2-5. Hook architecture duplicates payload handling and systematically fails open

There are 39 top-level hook scripts plus 23 hook test files. Payload normalization has two implementations: `hook-payload.js` uses a single synchronous 64 KiB loop and discards all accumulated input on any read error (`hooks/scripts/hook-payload.js:29-42`), while `hook-context.js` has a separate 10 MiB reader with EAGAIN retry/truncation state (`hooks/scripts/lib/hook-context.js:38-82`). The Codex adapter uses the weaker reader (`hooks/scripts/codex-hook-adapter.js:11-22`). Dispatch errors are converted to code 1 and then ignored unless a guard returns exactly 2 (`hooks/scripts/lib/dispatcher.js:131-150`); invalid config silently becomes `{}` and enables every hook (`hooks/scripts/lib/dispatcher.js:28-47`). Consequence: payload behavior differs by harness, large/nonblocking input may lose guard context, and crashed safety checks permit the operation. All paths referenced by `hooks/hooks.json` and `hooks/antigravity-hooks.json` do exist, so there is no missing-script defect.

#### P2-6. High-risk production modules lack direct behavioral tests

There are 230 production TS modules versus 60 TS test files, and 39 top-level hook scripts versus 23 hook test files. Search found no direct tests for the 1,124-line API translation/server module beginning at `src/infra/lib/codex-proxy.ts:1-16`, the Figma extraction/download boundary beginning at `src/infra/lib/figma/extract.ts:1-13`, Figma audit traversal at `src/infra/lib/figma/audit.ts:41-50`, the 311-line initialization workflow at `src/cli/commands/init.ts:216`, or postinstall orchestration. The graph domain has `KnowledgeGraph` tests, but the public formatter that embeds arbitrary keys into Mermaid is untested (`src/tools/memory/getMemoryGraph.ts:197-227`). Consequence: protocol translation, credentials/config wiring, file writes, downloads, and generated graph syntax can regress while existing unit tests remain green.

#### P2-7. CI and release deliberately ignore lockfile immutability

The repository has `pnpm-lock.yaml`, but both build/test jobs and release use `pnpm install --frozen-lockfile=false` (`.github/workflows/test.yml:26-30`, `.github/workflows/test.yml:48-52`, `.github/workflows/release.yml:29-33`). `package.json` also has no `packageManager` field while workflows independently pin pnpm 9 (`.github/workflows/test.yml:17-24`, `.github/workflows/release.yml:19-26`). Consequence: CI/release may resolve a graph different from the reviewed lockfile, and local Corepack users have no authoritative pnpm version. This is especially material because broad caret ranges resolve substantially newer installed versions than package minima.

#### P2-8. Published package contains compiled tests and silently suppresses install failure

The `files` allowlist includes all of `dist/` (`package.json:93-103`), and actual `npm pack --dry-run --json` produced a 1,707,441-byte tarball / 6,616,318 unpacked bytes containing `dist/__tests__/*` and compiled `*.test.js`, maps, and declarations throughout `dist`. Consequence: consumers download internal tests and source maps that are not runtime assets. More seriously, `postinstall` discards every rejection (`package.json:35`), so asset/hook installation can fail while npm reports successful installation. The dry run did confirm that declared runtime directories and hook scripts are shipped; no requested runtime directory was proven missing.

#### P2-9. Dependency vulnerability and currency status cannot be certified in this sandbox

Actual `npm audit --json` failed with `getaddrinfo EAI_AGAIN registry.npmjs.org`; `npm outdated --json` failed for the same DNS reason. `npm ls --all --json` completed, and `npm ls better-sqlite3 @clack/prompts glob vitest typescript --depth=0` found a coherent installed tree with no `npm ls` invalid/extraneous error. Therefore there is **no verified vulnerability finding** and no defensible current/major-behind count from this run. Production reachability, when audit data becomes available, must be classified from `dependencies`/`optionalDependencies` (`package.json:71-83`); findings confined to `devDependencies` (`package.json:85-92`) do not reach package consumers.

### P3 — cleanliness and policy drift

#### P3-1. Explicit return-type policy is almost met, with one exported exception

AST inspection of named/exported functions found `getAgentSdkQuery()` without an explicit return type (`src/infra/lib/utils.ts:48-60`). Consequence: its public contract is inference-dependent and can drift when optional SDK behavior changes. `npx tsc --noEmit` still passes because `noImplicitAny`, not explicit-return enforcement, is what `strict` provides (`tsconfig.json:2-15`).

#### P3-2. The absolute `console.log` rule conflicts with CLI implementation

The project says no `console.log` in commits (`CLAUDE.md:41`), yet production scanning found 378 calls, including normal command output (`src/cli/commands/config.ts:187-243`) and library debug output (`src/infra/lib/utils.ts:65-68`). Consequence: either legitimate CLI output is perpetually noncompliant or the rule/gate needs a documented output abstraction/allowlist. This is policy inconsistency rather than a runtime defect.

#### P3-3. Hook comments no longer describe implementation

`hooks/hooks.json` says dispatchers run steps sequentially (`hooks/hooks.json:2`), and `stop-dispatcher.js` repeats that contract (`hooks/scripts/stop-dispatcher.js:3-14`), while the shared dispatcher documents and implements parallel execution (`hooks/scripts/lib/dispatcher.js:10-17`, `hooks/scripts/lib/dispatcher.js:103-109`). Beyond P1-2's Stop race, this makes future hook changes error-prone because maintainers cannot trust the architecture comments.

## Pipeline assessment

- **Type/build:** `npx tsc --noEmit` exited 0. Build compiles tests into `dist` because `tsconfig.json` includes all `src/**/*` and does not exclude tests (`tsconfig.json:16-17`), which contributes to P2-8.
- **Tests:** requested `npx vitest run` was executed and reproduced hook-test timeouts; it did not reach a clean summary before interruption. CI builds before testing, which is correct for tests that dynamically inspect `dist` (`.github/workflows/test.yml:51-55`).
- **Coverage:** fails before tests because `@vitest/coverage-v8` is missing; no CI threshold exists.
- **Release:** build and test precede publish (`.github/workflows/release.yml:32-42`), but dependency resolution is non-frozen and package contents are not validated.
- **Package:** dry-run pack succeeds and includes required major asset trees, but includes compiled tests.

## Scores and recommended order

- **Code quality: 58/100** — compiler-clean, but hard-rule violations and untested high-risk modules are extensive.
- **Architecture: 62/100** — mostly one-way `cli/tools -> infra`, but one cycle, two upward edges, duplicated/fail-open hook plumbing, and a real Stop ordering defect.
- **Dependencies/pipeline: 48/100** — false Node compatibility, mutable CI resolution, unusable coverage; audit/outdated data unavailable.
- **Analysis completeness: 95/100 (EXCELLENT)** — all requested axes and commands covered; the only material evidence gap is registry access, explicitly reported.

Recommended remediation order:

1. Raise `engines.node` to the actual supported floor (at least 20.12) and test the minimum Node version.
2. Give Stop a genuinely sequential dispatcher and add an ordering/race regression test.
3. Reproduce/fix hook subprocess hangs in a clean checkout until `npx vitest run` completes green.
4. Add `@vitest/coverage-v8`, correct `src/infra/lib` coverage paths, thresholds, and a CI coverage job.
5. Freeze lockfiles in CI/release and declare `packageManager`.
6. Move shared config/memory types below CLI, break the memory cycle, and type external Figma payloads as `unknown` with guards.
7. Exclude compiled tests from `dist`/the npm tarball and stop swallowing mandatory postinstall failures.
8. Re-run `npm audit --json` and `npm outdated --json` with registry access, then classify each advisory by production reachability.

## Command evidence

| Command | Actual result |
|---|---|
| `npx tsc --noEmit` | exit 0, no diagnostics |
| `npx vitest run` | hook suites repeatedly timed out/failed; interrupted after >4 minutes without convergence |
| isolated `npx vitest run hooks/scripts/__tests__/pre-tool-guard.test.js` | reproduced timeout/hang |
| `npx vitest run --coverage` | exit 1: missing `@vitest/coverage-v8` |
| `npm audit --json` | exit 1: DNS `EAI_AGAIN` to registry |
| `npm outdated --json` | exit 1: DNS `EAI_AGAIN` to registry |
| `npm ls --all --json` | exit 0; dependency tree resolved |
| `npm ls better-sqlite3 @clack/prompts glob vitest typescript --depth=0` | exit 0; direct versions printed |
| `npm pack --dry-run --json` | exit 0 with temporary writable npm cache; 1.71 MB tarball, 6.62 MB unpacked, compiled tests included |

**Elapsed:** approximately 22 minutes.
