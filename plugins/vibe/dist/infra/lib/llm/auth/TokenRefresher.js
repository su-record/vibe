/**
 * TokenRefresher - Centralized token refresh with file locking
 *
 * Prevents race conditions when multiple parallel agents attempt
 * to refresh the same token simultaneously.
 *
 * Uses:
 * - In-process dedupe: provider-scoped Promise map (single process)
 * - File lock: mkdir atomic pattern (cross-process)
 */
import fs from 'fs';
import path from 'path';
import { getGlobalConfigDir } from './ConfigManager.js';
const LOCK_TIMEOUT_MS = 10_000;
const STALE_LOCK_MS = 30_000;
const POLL_INTERVAL_MS = 500;
const MAX_POLL_MS = 30_000;
/** In-flight refresh promises per provider (in-process dedupe) */
const inflightMap = new Map();
/** Active lock paths for cleanup on process exit */
const activeLocks = new Set();
function getLockPath(provider) {
    return path.join(getGlobalConfigDir(), `.refresh-${provider}.lock`);
}
function writeOwnerFile(lockDir) {
    const ownerPath = path.join(lockDir, 'owner.json');
    const owner = { pid: process.pid, createdAt: Date.now() };
    fs.writeFileSync(ownerPath, JSON.stringify(owner), { mode: 0o600 });
}
function readOwnerFile(lockDir) {
    try {
        const ownerPath = path.join(lockDir, 'owner.json');
        const content = fs.readFileSync(ownerPath, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
function isProcessAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    }
}
function isLockStale(lockDir) {
    const owner = readOwnerFile(lockDir);
    if (!owner)
        return true;
    const age = Date.now() - owner.createdAt;
    if (age < STALE_LOCK_MS)
        return false;
    return !isProcessAlive(owner.pid);
}
function removeLockDir(lockDir) {
    try {
        const ownerPath = path.join(lockDir, 'owner.json');
        if (fs.existsSync(ownerPath))
            fs.unlinkSync(ownerPath);
        fs.rmdirSync(lockDir);
    }
    catch {
        // Best-effort cleanup
    }
}
function tryAcquireLock(lockDir) {
    try {
        fs.mkdirSync(lockDir);
        writeOwnerFile(lockDir);
        activeLocks.add(lockDir);
        return true;
    }
    catch {
        // Directory exists — check for stale lock
        if (fs.existsSync(lockDir) && isLockStale(lockDir)) {
            // Re-check owner before removing (TOCTOU mitigation)
            const owner = readOwnerFile(lockDir);
            if (owner && !isProcessAlive(owner.pid)) {
                removeLockDir(lockDir);
                // Retry once after clearing stale lock
                try {
                    fs.mkdirSync(lockDir);
                    writeOwnerFile(lockDir);
                    activeLocks.add(lockDir);
                    return true;
                }
                catch {
                    return false;
                }
            }
        }
        return false;
    }
}
function releaseLock(lockDir) {
    activeLocks.delete(lockDir);
    removeLockDir(lockDir);
}
async function waitForLockOrToken(lockDir, readCurrentToken, originalToken) {
    const startTime = Date.now();
    const deadline = startTime + MAX_POLL_MS;
    while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        // Check if lock was released (refresh completed by another process)
        if (!fs.existsSync(lockDir)) {
            if (readCurrentToken) {
                const current = readCurrentToken();
                if (current && current.accessToken !== originalToken && current.expires > Date.now()) {
                    return {
                        accessToken: current.accessToken,
                        expires: current.expires,
                    };
                }
            }
            return null; // Lock released but no valid token found
        }
        // Poll token storage for changes while locked
        if (readCurrentToken) {
            const current = readCurrentToken();
            if (current && current.accessToken !== originalToken && current.expires > Date.now()) {
                return {
                    accessToken: current.accessToken,
                    expires: current.expires,
                };
            }
        }
    }
    // Polling timeout — will attempt refresh without lock
    return null;
}
class TokenRefresher {
    /**
     * Refresh a token with in-process deduplication and cross-process file locking.
     *
     * @param provider - Provider identifier (e.g., 'gpt', 'antigravity')
     * @param refreshFn - The actual token refresh function
     * @param readCurrentToken - Optional callback to read current token from storage
     */
    async refreshWithLock(provider, refreshFn, readCurrentToken) {
        // In-process dedupe: if already refreshing for this provider, share the promise
        const existing = inflightMap.get(provider);
        if (existing) {
            return existing;
        }
        const refreshPromise = this.doRefreshWithLock(provider, refreshFn, readCurrentToken);
        inflightMap.set(provider, refreshPromise);
        try {
            return await refreshPromise;
        }
        finally {
            inflightMap.delete(provider);
        }
    }
    async doRefreshWithLock(provider, refreshFn, readCurrentToken) {
        const lockDir = getLockPath(provider);
        const originalToken = readCurrentToken?.()?.accessToken;
        // Try to acquire lock with timeout
        const lockDeadline = Date.now() + LOCK_TIMEOUT_MS;
        let lockAcquired = false;
        while (Date.now() < lockDeadline) {
            if (tryAcquireLock(lockDir)) {
                lockAcquired = true;
                break;
            }
            // Lock held by someone else — wait and poll for token changes
            const result = await waitForLockOrToken(lockDir, readCurrentToken, originalToken);
            if (result)
                return result;
            break; // waitForLockOrToken handles its own loop
        }
        if (!lockAcquired) {
            // Could not acquire lock — check if token was refreshed by another process
            if (readCurrentToken) {
                const current = readCurrentToken();
                if (current && current.accessToken !== originalToken && current.expires > Date.now()) {
                    return {
                        accessToken: current.accessToken,
                        expires: current.expires,
                    };
                }
            }
            // Last resort: refresh without lock (best-effort)
        }
        // Perform the actual refresh
        try {
            return await refreshFn();
        }
        finally {
            if (lockAcquired) {
                releaseLock(lockDir);
            }
        }
    }
}
/** Singleton instance */
export const tokenRefresher = new TokenRefresher();
export { TokenRefresher };
// Cleanup locks on process exit
function cleanupLocks() {
    for (const lockDir of activeLocks) {
        removeLockDir(lockDir);
    }
    activeLocks.clear();
}
process.on('exit', cleanupLocks);
process.on('SIGINT', () => {
    cleanupLocks();
    process.exit(130);
});
process.on('SIGTERM', () => {
    cleanupLocks();
    process.exit(143);
});
//# sourceMappingURL=TokenRefresher.js.map