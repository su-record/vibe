/**
 * upgrade 명령어 — 전역 패키지 최신 버전으로 업그레이드
 */
import { execFileSync, execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { log, getPackageJson } from '../utils.js';
import { formatLLMStatus } from '../auth.js';
import { installProjectHooks, installProjectCodexHooks, projectHooksStale } from '../setup.js';
import { detectCodexCli } from '../utils/cli-detector.js';
import { getCoreConfigDir } from '../setup/GlobalInstaller.js';
import { missingNativeDeps, repairNativeDeps, nativeDepHint } from '../setup/NativeDeps.js';
/**
 * Remove stale npm temp directories that cause ENOTEMPTY errors
 */
function cleanStaleTempDirs() {
    try {
        const parentDir = execSync('npm root -g', { encoding: 'utf-8' }).trim();
        const scopeDir = join(parentDir, '@su-record');
        const entries = readdirSync(scopeDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory() && entry.name.startsWith('.vibe-')) {
                rmSync(join(scopeDir, entry.name), { recursive: true, force: true });
            }
        }
    }
    catch {
        // Scope dir may not exist yet — ignore
    }
}
/**
 * Read status formatter from the package that was just installed.
 *
 * WHY: `vibe upgrade` keeps running in the old process after npm install.
 * Loading auth.js from the installed package prevents stale post-upgrade labels.
 */
export function readInstalledLLMStatus(globalRoot) {
    const authPath = join(globalRoot, '@su-record', 'vibe', 'dist', 'cli', 'auth.js');
    const authUrl = `${pathToFileURL(authPath).href}?t=${Date.now()}`;
    const script = [
        `import(${JSON.stringify(authUrl)})`,
        ".then(m => process.stdout.write(m.formatLLMStatus()))",
        ".catch(e => { process.stderr.write(String(e?.message || e)); process.exit(1); });",
    ].join('');
    return execFileSync(process.execPath, ['--input-type=module', '-e', script], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
    }).trimEnd();
}
/** postinstall 이 보고한 라인 접두사 — 이 목록만 사용자에게 되살린다 */
const POSTINSTALL_REPORT_PREFIXES = [
    'stale skill files pruned:',
    'optional skill removed:',
];
/**
 * npm 출력에서 postinstall 의 보고성 라인만 뽑는다.
 *
 * WHY: `npm install -g` 를 `stdio: 'pipe'` 로 감싸 npm 노이즈를 숨기는데, 그 과정에서
 * postinstall 이 낸 보고까지 삼켜졌다. 특히 "철회된 스킬 파일을 지웠다" 는 사실이
 * 사라지면 삭제가 조용해진다 — `pruneExtraneousSkillFiles` 가 제거 목록을 반환하도록
 * 만든 이유가 무효화된다.
 *
 * npm 전체 출력을 그대로 흘리지 않는 이유: 진행률·경고가 섞여 업그레이드 결과를 가린다.
 * 접두사 화이트리스트로 vibe 가 의도적으로 낸 라인만 통과시킨다.
 */
export function extractPostinstallReport(npmOutput) {
    return npmOutput
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => POSTINSTALL_REPORT_PREFIXES.some((prefix) => line.startsWith(prefix)));
}
/** 프로젝트 훅이 이미 설치돼 있는지 — `hooks` 키 존재까지 확인한다 */
function hasClaudeHooks(projectRoot) {
    try {
        const settings = JSON.parse(readFileSync(join(projectRoot, '.claude', 'settings.local.json'), 'utf-8'));
        return Boolean(settings.hooks);
    }
    catch {
        return false;
    }
}
/**
 * 업그레이드 후 현재 프로젝트의 훅을 복구한다.
 *
 * WHY: postinstall 은 전역 자산(스킬·에이전트·규칙)만 설치하고 훅은 의도적으로
 * 프로젝트 레벨에 남긴다(main.ts "6. hooks는 프로젝트 레벨에서 관리"). 그 결과
 * `vibe upgrade` 만 쓰는 사용자는 스킬은 최신인데 **훅이 영원히 설치되지 않는**
 * 상태가 되고, sentinel-guard·scope-guard·run-ledger·verify 게이트가 전부 죽어
 * 있는데도 "✅ vibe upgraded" 만 보게 된다. loop-contract 의 전제("폭주 방어가
 * 모델의 양심이 아니라 결정론적 가드")가 조용히 무너지는 지점이라, 여기서만큼은
 * 경고가 아니라 복구를 한다.
 *
 * 범위는 훅으로 한정한다 — 스킬·CLAUDE.md 재생성은 `vibe update` 의
 * 몫이고, 전역 명령이 프로젝트 문서를 말없이 바꾸면 놀라움이 더 크다.
 * 훅 파일은 gitignore 된 로컬 설치 아티팩트이고 설치는 idempotent 다.
 *
 * @returns 복구한 하네스 목록 (빈 배열이면 복구 불필요 또는 vibe 프로젝트 아님)
 */
export function repairProjectHooks(projectRoot) {
    const hasClaudeDir = existsSync(join(projectRoot, '.claude'));
    const hasCodexDir = existsSync(join(projectRoot, '.codex'));
    const hasAgentsMd = existsSync(join(projectRoot, 'AGENTS.md'));
    const hasVibeDir = existsSync(join(projectRoot, '.vibe'));
    // vibe 프로젝트가 아니면 아무것도 하지 않는다 — 임의 디렉토리에서 upgrade 를
    // 돌렸을 때 .claude/ 를 새로 만들지 않도록.
    if (!hasClaudeDir && !hasCodexDir && !hasVibeDir && !hasAgentsMd)
        return [];
    const repaired = [];
    // 부재뿐 아니라 **내용이 어긋난** 경우도 복구한다 — 훅 정의가 바뀌어도
    // 이미 설치한 사용자에게 도달하지 않던 문제(v3.2.35 matcher 수정 때 실측).
    const claudeStale = projectHooksStale(projectRoot, '.claude');
    if (!hasClaudeHooks(projectRoot) || claudeStale) {
        try {
            installProjectHooks(projectRoot, '.claude');
            repaired.push(claudeStale ? '.claude/settings.local.json (stale)' : '.claude/settings.local.json');
        }
        catch { /* 복구 실패가 업그레이드 자체를 실패시키지 않는다 */ }
    }
    // 보고(vibe status)와 같은 기준으로 복구한다 — `.codex/`·AGENTS.md 는 gitignore
    // 대상이라 fresh clone 에 없고, 아티팩트로만 판정하면 Codex 훅이 영영 복구되지
    // 않는다. `vibe init` 도 detectCodexCli().installed 로 설치를 결정한다.
    const usesCodex = hasCodexDir || hasAgentsMd || detectCodexCli().installed;
    if (usesCodex && !existsSync(join(projectRoot, '.codex', 'hooks.json'))) {
        try {
            installProjectCodexHooks(projectRoot);
            repaired.push('.codex/hooks.json');
        }
        catch { /* 위와 동일 */ }
    }
    return repaired;
}
/**
 * 전역 자산(`~/.vibe/`)이 방금 설치한 버전으로 갱신됐는지 판정한다.
 *
 * postinstall 이 패키지를 `~/.vibe/node_modules/@su-record/vibe` 로 복사하므로,
 * 그 사본의 버전이 **마지막으로 postinstall 이 성공한 시점**을 말해준다.
 *
 * @returns 갱신됐으면 null, 아니면 발견된 사본 버전(없으면 'none')
 */
export function staleGlobalAssets(installedVersion) {
    try {
        const copied = JSON.parse(readFileSync(join(getCoreConfigDir(), 'node_modules', '@su-record', 'vibe', 'package.json'), 'utf-8'));
        return copied.version === installedVersion ? null : (copied.version ?? 'unknown');
    }
    catch {
        return 'none';
    }
}
/**
 * postinstall 을 직접 실행해 전역 자산을 복구한다.
 *
 * WHY: npm 이 lifecycle script 를 건너뛰는 환경이 있다 (`npm warn install-scripts`).
 * npm 12 의 `allowScripts` 는 아예 **기본 차단**이다 — 승인 목록에 없는 패키지의
 * install/postinstall 은 실행되지 않고 경고 한 줄만 남는다.
 *
 * 사용자 레벨 승인(`npm config set allow-scripts=@su-record/vibe,better-sqlite3
 * --location=user`)을 해두면 이 postinstall 도 정상 실행된다(레지스트리 설치로 확인).
 * 그래도 이 복구는 남긴다 — 승인은 **머신마다 사람이 한 번 해야 하는 일**이고,
 * 기본값은 차단이다. 안 해둔 머신에서 조용히 구버전 훅으로 도는 것을 막는 쪽이
 * 이 함수의 존재 이유다.
 * 그러면 전역 **패키지**는 새 버전인데 `~/.vibe/hooks/scripts/` 는 옛날 그대로다 —
 * sentinel·scope·run-ledger·verify 가 전부 구버전 코드로 돌면서 upgrade 는
 * "✅ 성공" 을 출력한다. 실측: 두 번의 릴리즈 동안 훅이 5일 전 상태로 멈춰 있었다.
 * 결정론적 가드의 생사는 관측 가능해야 한다 — 여기서만큼은 경고가 아니라 복구를 한다.
 *
 * @returns 복구 성공 여부
 */
function runInstalledPostinstall(globalRoot) {
    try {
        const entry = join(globalRoot, '@su-record', 'vibe', 'dist', 'cli', 'postinstall', 'main.js');
        if (!existsSync(entry))
            return false;
        execFileSync(process.execPath, [entry], { stdio: 'ignore', timeout: 120_000 });
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Upgrade global package to latest version
 * npm install -g → postinstall handles global config
 */
export function upgrade(_options = { silent: false }) {
    try {
        log('⬆️ Upgrading to latest version...\n');
        cleanStaleTempDirs();
        // --prefer-online: npm 캐시 대신 레지스트리에서 최신 버전 확인
        // --foreground-scripts: npm 은 기본적으로 lifecycle script 출력을 **버린다**.
        //   이 플래그가 없으면 postinstall 의 console.log 가 stdout 에 아예 오지 않아
        //   아래 extractPostinstallReport 가 파싱할 것이 없다 (실측 확인).
        // stdio: 'pipe' 로 npm 노이즈는 계속 숨기고, 보고성 라인만 골라 되살린다 —
        //   그러지 않으면 "철회된 스킬 파일을 지웠다" 가 조용히 사라진다
        //   (pruneExtraneousSkillFiles 의 no-silent-deletion 계약).
        const npmOutput = execSync('npm install -g @su-record/vibe@latest --prefer-online --foreground-scripts', { stdio: 'pipe', encoding: 'utf-8' });
        const postinstallReport = extractPostinstallReport(npmOutput);
        // 설치된 새 버전을 디스크에서 직접 읽기 (현재 프로세스의 캐시된 값이 아닌)
        let newVersion = 'unknown';
        let globalRoot = '';
        try {
            globalRoot = execSync('npm root -g', { encoding: 'utf-8' }).trim();
            const installedPkg = JSON.parse(readFileSync(join(globalRoot, '@su-record', 'vibe', 'package.json'), 'utf-8'));
            newVersion = installedPkg.version;
        }
        catch {
            newVersion = getPackageJson().version;
        }
        let llmStatus = formatLLMStatus();
        try {
            if (globalRoot)
                llmStatus = readInstalledLLMStatus(globalRoot);
        }
        catch { /* fallback to current process formatter */ }
        // 전역 자산이 실제로 갱신됐는지 확인한다 — npm 이 lifecycle script 를 건너뛰면
        // 패키지만 새 버전이고 ~/.vibe/hooks/ 는 옛날 그대로인 채 "성공" 이 출력된다
        let globalNote = '';
        const stale = staleGlobalAssets(newVersion);
        if (stale && globalRoot) {
            const recovered = runInstalledPostinstall(globalRoot);
            const after = recovered ? staleGlobalAssets(newVersion) : stale;
            globalNote = after === null
                ? `\n🔧 Global assets restored (postinstall did not run — was v${stale})\n`
                : `\n⚠️  Global assets stale (v${after}) — hooks may run old code. Try: npm install -g @su-record/vibe@latest --force --foreground-scripts\n`;
        }
        // 네이티브 바인딩도 같은 이유(allowScripts 차단)로 빠진다 — 여기서도 복구한다.
        // 빠지면 메모리·RAG·sentinel 이 매 훅마다 bindings 에러로 죽는데, 설치는 ✅ 로 보인다.
        let nativeNote = '';
        if (globalRoot) {
            const pkgRoot = join(globalRoot, '@su-record', 'vibe');
            if (missingNativeDeps(pkgRoot).length > 0) {
                const { repaired: fixed, failed } = repairNativeDeps(pkgRoot);
                if (fixed.length > 0)
                    nativeNote += `\n🔧 Native bindings rebuilt: ${fixed.join(', ')}\n`;
                if (failed.length > 0) {
                    nativeNote += `\n⚠️  Native bindings missing (${failed.join(', ')}) — memory/RAG disabled.`
                        + ` Try: ${nativeDepHint(failed)}\n`;
                }
            }
        }
        const repaired = repairProjectHooks(process.cwd());
        const hookNote = repaired.length > 0
            ? `\n🔧 Project hooks restored: ${repaired.join(', ')}\n`
            : '';
        const pruneNote = postinstallReport.length > 0
            ? `\n🧹 ${postinstallReport.join('\n🧹 ')}\n`
            : '';
        log(`\n✅ vibe upgraded (v${newVersion})\n${globalNote}${nativeNote}${hookNote}${pruneNote}\n${llmStatus}\n`);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('❌ Upgrade failed:', message);
        process.exit(1);
    }
}
//# sourceMappingURL=upgrade.js.map