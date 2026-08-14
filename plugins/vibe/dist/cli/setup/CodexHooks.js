import fs from 'fs';
import path from 'path';
import { ensureDir } from '../utils.js';
import { getCoreConfigDir } from './GlobalInstaller.js';
function adapterCommand(coreDir, eventName) {
    const scriptPath = path.join(coreDir, 'hooks', 'scripts', 'codex-hook-adapter.js').replace(/\\/g, '/');
    return `node ${JSON.stringify(scriptPath)} ${eventName}`;
}
function hookEntry(coreDir, eventName) {
    return {
        hooks: [{ type: 'command', command: adapterCommand(coreDir, eventName) }],
    };
}
export function buildCodexHooksConfig(coreDir = getCoreConfigDir()) {
    const normalizedCoreDir = coreDir.replace(/\\/g, '/');
    return {
        hooks: {
            SessionStart: [hookEntry(normalizedCoreDir, 'SessionStart')],
            UserPromptSubmit: [hookEntry(normalizedCoreDir, 'UserPromptSubmit')],
            PreToolUse: [hookEntry(normalizedCoreDir, 'PreToolUse')],
            PostToolUse: [hookEntry(normalizedCoreDir, 'PostToolUse')],
            Stop: [hookEntry(normalizedCoreDir, 'Stop')],
            PreCompact: [hookEntry(normalizedCoreDir, 'PreCompact')],
            PostCompact: [hookEntry(normalizedCoreDir, 'PostCompact')],
        },
    };
}
function readExistingHooks(hooksPath) {
    try {
        if (!fs.existsSync(hooksPath))
            return {};
        const parsed = JSON.parse(fs.readFileSync(hooksPath, 'utf-8'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
            return {};
        return parsed;
    }
    catch {
        return {};
    }
}
export function installProjectCodexHooks(projectRoot, coreDir = getCoreConfigDir()) {
    const codexDir = path.join(projectRoot, '.codex');
    const hooksPath = path.join(codexDir, 'hooks.json');
    ensureDir(codexDir);
    const existing = readExistingHooks(hooksPath);
    const next = {
        ...existing,
        hooks: buildCodexHooksConfig(coreDir).hooks,
    };
    fs.writeFileSync(hooksPath, JSON.stringify(next, null, 2) + '\n');
}
//# sourceMappingURL=CodexHooks.js.map