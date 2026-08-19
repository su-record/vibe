/**
 * 정보 명령어 (help, status, version)
 */
import path from 'path';
import fs from 'fs';
import { getPackageJson } from '../utils.js';
import { formatLLMStatus } from '../auth.js';
import { detectCodexCli } from '../utils/cli-detector.js';
import { missingNativeDeps } from '../setup/NativeDeps.js';
import { RETIRED_SKILL_NAMES } from '../postinstall/constants.js';
/**
 * 도움말 표시
 */
export function showHelp() {
    console.log(`
VIBE - AI Coding Harness (Claude Code / Codex / Antigravity)

Commands:
  vibe setup              셋업 위자드 (인증, 설정 한번에)
  vibe init [project]     프로젝트 초기화 (.claude/ 대상)
  vibe init --codex       프로젝트 초기화 (.codex/ + AGENTS.md)
  vibe init --antigravity 프로젝트 초기화 (.gemini/ + GEMINI.md)
  vibe update             설정 업데이트
  vibe upgrade            최신 버전으로 업그레이드
  vibe remove             프로젝트에서 제거
  vibe status             전체 상태 확인
  vibe plugin [install]   Codex/ChatGPT 플러그인으로 설치 (status 로 상태 확인)
  vibe config show        설정 통합 보기 (모든 소스)
  vibe stats              세션 통계 및 품질 트렌드
  vibe env import [path]  .env → ~/.vibe/config.json 가져오기

LLM:
  vibe claude <cmd>       Claude (key, status, logout)
  vibe gpt <cmd>          GPT (key, status, logout)
  vibe antigravity <cmd>  Antigravity (key, status, logout)
  vibe zai <cmd>          ZAI / GLM (coding-key, key, status, logout)
  vibe llm <cmd>          List / refresh available models (list, refresh)

Figma:
  vibe figma setup <token>  Set Figma access token
  vibe figma breakpoints    Show/set responsive breakpoints
  vibe figma status         Check configuration

Skills:
  vibe skills add <pkg>   Install skill from skills.sh

Slash Commands (Claude Code / Codex):
  /vibe.spec "feature"    SPEC 작성 + 리서치
  /vibe.run "feature"     구현 실행
  /vibe.verify "feature"  BDD 검증
  /vibe.review            병렬 코드 리뷰 (13+ agents)
  /vibe.reason "problem"  체계적 추론
  /vibe.analyze           프로젝트 분석
  /vibe.trace "feature"   요구사항 추적 매트릭스
  /vibe.continue          세션 복원 (컨텍스트 이어가기)
  /vibe.image             이미지 생성
  /vibe.figma             Figma 디자인 → 코드 변환

Docs: https://github.com/su-record/vibe
  `);
}
/**
 * 프로젝트 훅 설치 상태 — 하네스별 한 줄 요약.
 *
 * WHY: 훅이 없으면 sentinel-guard·scope-guard·run-ledger·verify 게이트가 전부
 * 조용히 죽는다. 그런데 `vibe upgrade` 는 전역 자산만 갱신하므로 upgrade 만 쓰는
 * 사용자는 이 상태에 도달하고도 알 방법이 없었다. 상태 화면이 결정론적 가드의
 * 생사를 보여주지 않으면 loop-contract 의 전제를 검증할 수단이 없다.
 */
export function formatHookStatus(projectRoot, 
/** Codex CLI 설치 여부 — 생략하면 감지한다. 테스트가 머신 상태에 좌우되지 않도록 주입 가능. */
codexInstalled = detectCodexCli().installed) {
    const lines = [];
    const claudeSettings = path.join(projectRoot, '.claude', 'settings.local.json');
    let claudeOk = false;
    try {
        const parsed = JSON.parse(fs.readFileSync(claudeSettings, 'utf-8'));
        claudeOk = Boolean(parsed.hooks);
    }
    catch { /* 없거나 손상 → 미설치 취급 */ }
    lines.push(claudeOk
        ? '  Claude Code         ✓ .claude/settings.local.json'
        : '  Claude Code         ⬚ not installed (run: vibe update)');
    // Codex 훅 보고 여부는 **아티팩트가 아니라 하네스 설치 여부**로 정한다.
    //
    // 아티팩트(.codex/, AGENTS.md)로만 판정하면, 그 둘이 gitignore 대상이라
    // fresh clone 에서는 "Codex 프로젝트가 아니다" 로 결론내고 행 자체를 숨긴다 —
    // 정작 보고해야 할 미설치 상태에서 침묵하는 셈이다. `vibe init` 은 이미
    // detectCodexCli().installed 로 설치를 결정하므로 판정 기준을 거기에 맞춘다.
    const isCodexProject = codexInstalled ||
        fs.existsSync(path.join(projectRoot, '.codex')) ||
        fs.existsSync(path.join(projectRoot, 'AGENTS.md'));
    if (isCodexProject) {
        const codexOk = fs.existsSync(path.join(projectRoot, '.codex', 'hooks.json'));
        lines.push(codexOk
            ? '  Codex               ✓ .codex/hooks.json'
            : '  Codex               ⬚ not installed (run: vibe update)');
    }
    return lines.join('\n');
}
/**
 * 네이티브 바인딩 상태 — 빠져 있으면 메모리·RAG 가 매 훅마다 조용히 죽는다.
 *
 * npm 12 의 `allowScripts` 가 install 스크립트를 차단하면 설치는 성공하는데
 * 바인딩만 없는 상태가 된다. 상태 화면이 이걸 보여주지 않으면 사용자는
 * "설치는 됐는데 메모리가 안 붙는다" 를 진단할 방법이 없다.
 */
export function formatNativeDepStatus(packageRoot) {
    const missing = missingNativeDeps(packageRoot);
    return missing.length === 0
        ? '  Native bindings     ✓ ok'
        : `  Native bindings     ✗ ${missing.join(', ')} — memory/RAG disabled (run: vibe upgrade)`;
}
/**
 * 전역 스킬 디렉토리의 구성 — **상시 컨텍스트 비용**을 보이게 한다.
 *
 * WHY: 스킬은 하나하나가 매 세션 컨텍스트에 얹힌다. 그런데 늘어나는 경로가 셋인데
 * 어느 것도 보고되지 않았다 — vibe 자신, `vibe init` 이 스택에 맞춰 **자동 설치**하는
 * 외부 스킬(실측: `vercel-labs/agent-skills` 한 패키지가 스킬 9개), 그리고 개명 뒤
 * 남은 vibe 잔재. 사용자는 `vibe init` 한 번에 스킬이 몇 개 늘었는지 알 방법이 없었다.
 *
 * 잔재는 **보고만** 한다 — 자동 삭제하지 않는다. `docs`·`test` 같은 일반적인 이름이
 * 섞여 있어 사용자가 만든 동명 스킬을 지울 위험이 실재하고, 애매할 때 지우는 쪽이
 * 훨씬 나쁘다. 무엇이 있는지 보여주면 판단은 사람이 한다.
 */
export function formatSkillStatus(globalSkillsDir, shippedSkillsDir) {
    const dirs = (at) => {
        try {
            return fs.readdirSync(at, { withFileTypes: true })
                .filter((e) => e.isDirectory()).map((e) => e.name);
        }
        catch {
            return [];
        }
    };
    const entries = dirs(globalSkillsDir);
    if (entries.length === 0) {
        return '  Skills              ⬚ not installed (run: vibe update)';
    }
    // 소유 판정은 이름 접두사가 아니라 **배송 목록**으로 한다 — 진입 스킬은
    // `vibe.` 접두사가 없는 `vibe` 라서 접두사로 세면 외부로 오분류된다.
    const shipped = new Set(dirs(shippedSkillsDir));
    const vibe = entries.filter((n) => shipped.has(n));
    const others = entries.filter((n) => !shipped.has(n));
    const retired = others.filter((n) => RETIRED_SKILL_NAMES.has(n));
    const external = others.filter((n) => !RETIRED_SKILL_NAMES.has(n));
    const lines = [`  Skills              ${entries.length} always-on (vibe ${vibe.length})`];
    if (external.length > 0) {
        lines.push(`    external          ${external.length} — ${external.join(', ')}`);
    }
    if (retired.length > 0) {
        lines.push(`    stale (vibe 구버전) ${retired.length} — ${retired.join(', ')}`, `                      ↳ 지금은 vibe.* 로 개명됨. 안 쓰면 지워도 된다`);
    }
    return lines.join('\n');
}
/**
 * 상태 표시 — 모든 시스템 상태를 한 곳에서 확인
 */
export function showStatus() {
    const projectRoot = process.cwd();
    const coreDir = path.join(projectRoot, '.vibe');
    const legacyCoreDir = path.join(projectRoot, '.claude', 'vibe');
    const activeCoreDir = fs.existsSync(coreDir) ? coreDir : legacyCoreDir;
    const configPath = path.join(activeCoreDir, 'config.json');
    const packageJson = getPackageJson();
    const isCoreProject = fs.existsSync(activeCoreDir);
    let config = { language: 'ko', models: {} };
    if (isCoreProject && fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
    // 프로젝트 상태
    const projectStatus = isCoreProject
        ? `✅ ${projectRoot}`
        : `⬚ Not a core project (run: vibe init)`;
    console.log(`
VIBE Status (v${packageJson.version})

Project: ${projectStatus}
${isCoreProject ? `Language: ${config.language || 'ko'}\n` : ''}
${isCoreProject ? `Hooks (deterministic gates):\n${formatHookStatus(projectRoot)}\n` : ''}${formatNativeDepStatus(path.resolve(import.meta.dirname, '..', '..', '..'))}\n${formatSkillStatus(path.join(process.env.HOME ?? '', '.claude', 'skills'), path.resolve(import.meta.dirname, '..', '..', '..', 'skills'))}

${formatLLMStatus()}
  `);
}
/**
 * 버전 표시
 */
export function showVersion() {
    const packageJson = getPackageJson();
    console.log(`core v${packageJson.version}`);
}
//# sourceMappingURL=info.js.map