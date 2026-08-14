/**
 * AuthProfileManager - Auth Profile Rotation 관리
 * Rate Limit 대응을 위한 다중 인증 프로필 순환
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ProfileFileLock } from './ProfileFileLock.js';
// ============================================
// Constants
// ============================================
const MAX_PROFILES_PER_PROVIDER = 10;
const BASE_COOLDOWN_MS = 5 * 60 * 1000; // 5분
const MAX_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4시간
const COOLDOWN_THRESHOLD = 3;
// Sensitive info masking patterns
const SENSITIVE_PATTERNS = [
    /sk-[a-zA-Z0-9]{20,}/g,
    /AIza[a-zA-Z0-9_-]{35}/g,
    /ya29\.[a-zA-Z0-9_-]+/g,
    /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+/g,
];
function maskSensitiveInfo(msg) {
    let masked = msg;
    for (const pattern of SENSITIVE_PATTERNS) {
        masked = masked.replace(pattern, '***REDACTED***');
    }
    return masked;
}
function getProfilesPath() {
    const configDir = process.platform === 'win32'
        ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'vibe')
        : path.join(os.homedir(), '.config', 'vibe');
    return path.join(configDir, 'auth-profiles.json');
}
function maskApiKey(key) {
    if (key.length < 4)
        return '****';
    return `***${key.slice(-4)}`;
}
// ============================================
// AuthProfileManager
// ============================================
export class AuthProfileManager {
    profilesPath;
    lock;
    constructor(profilesPath, lock) {
        this.profilesPath = profilesPath ?? getProfilesPath();
        this.lock = lock ?? new ProfileFileLock();
    }
    /**
     * 프로필 목록 조회
     */
    listProfiles(provider) {
        const all = this.loadProfiles();
        if (!provider)
            return all;
        return all.filter(p => p.provider === provider);
    }
    /**
     * 활성 프로필 선택 (cooldown 아닌 최우선)
     */
    getActiveProfile(provider) {
        const profiles = this.listProfiles(provider)
            .sort((a, b) => a.priority - b.priority);
        const now = Date.now();
        // cooldown 아닌 프로필 중 최우선
        const available = profiles.find(p => p.cooldownUntil <= now);
        if (available)
            return available;
        // 모두 cooldown이면 가장 빨리 해제되는 프로필
        if (profiles.length > 0) {
            const soonest = profiles.reduce((min, p) => p.cooldownUntil < min.cooldownUntil ? p : min);
            return soonest;
        }
        return null;
    }
    /**
     * 프로필 추가
     */
    async addProfile(provider, type, rawIdentifier, priority = 100) {
        const identifier = type === 'apikey'
            ? maskApiKey(rawIdentifier)
            : rawIdentifier;
        const profile = {
            id: `${provider}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            provider,
            type,
            identifier,
            priority,
            cooldownUntil: 0,
            errorCount: 0,
            lastUsedAt: 0,
            lastSuccessAt: 0,
        };
        await this.lock.acquire();
        try {
            const profiles = this.loadProfiles();
            const providerProfiles = profiles.filter(p => p.provider === provider);
            // 프로바이더당 최대 프로필 수 체크
            if (providerProfiles.length >= MAX_PROFILES_PER_PROVIDER) {
                // 가장 오래된 lastUsedAt 프로필 삭제
                const oldest = providerProfiles.reduce((min, p) => p.lastUsedAt < min.lastUsedAt ? p : min);
                const idx = profiles.findIndex(p => p.id === oldest.id);
                if (idx !== -1)
                    profiles.splice(idx, 1);
            }
            profiles.push(profile);
            this.saveProfiles(profiles);
        }
        finally {
            this.lock.release();
        }
        return profile;
    }
    /**
     * 프로필 삭제
     */
    async removeProfile(profileId) {
        await this.lock.acquire();
        try {
            const profiles = this.loadProfiles();
            const idx = profiles.findIndex(p => p.id === profileId);
            if (idx === -1)
                return false;
            profiles.splice(idx, 1);
            this.saveProfiles(profiles);
            return true;
        }
        finally {
            this.lock.release();
        }
    }
    /**
     * 성공 마킹
     */
    async markSuccess(profileId) {
        await this.lock.acquire();
        try {
            const profiles = this.loadProfiles();
            const profile = profiles.find(p => p.id === profileId);
            if (!profile)
                return;
            profile.errorCount = 0;
            profile.cooldownUntil = 0;
            profile.lastSuccessAt = Date.now();
            profile.lastUsedAt = Date.now();
            this.saveProfiles(profiles);
        }
        finally {
            this.lock.release();
        }
    }
    /**
     * 실패 마킹
     */
    async markFailure(profileId, errorMsg) {
        await this.lock.acquire();
        try {
            const profiles = this.loadProfiles();
            const profile = profiles.find(p => p.id === profileId);
            if (!profile)
                return;
            profile.errorCount++;
            profile.lastUsedAt = Date.now();
            if (profile.errorCount >= COOLDOWN_THRESHOLD) {
                const exponent = profile.errorCount - COOLDOWN_THRESHOLD;
                const cooldown = Math.min(BASE_COOLDOWN_MS * Math.pow(2, exponent), MAX_COOLDOWN_MS);
                profile.cooldownUntil = Date.now() + cooldown;
            }
            // 에러 메시지에서 민감정보 마스킹 후 프로필에 저장
            if (errorMsg) {
                profile.lastError = maskSensitiveInfo(errorMsg);
            }
            this.saveProfiles(profiles);
        }
        finally {
            this.lock.release();
        }
    }
    /**
     * 다음 프로필로 순환
     */
    rotateToNext(provider) {
        const profiles = this.listProfiles(provider)
            .sort((a, b) => a.priority - b.priority);
        const now = Date.now();
        const available = profiles.filter(p => p.cooldownUntil <= now);
        if (available.length <= 1) {
            return available[0] ?? null;
        }
        // 가장 최근에 사용된 프로필을 건너뛰고 다음 반환
        const sorted = available.sort((a, b) => a.lastUsedAt - b.lastUsedAt);
        return sorted[0] ?? null;
    }
    /**
     * 모든 cooldown 초기화
     */
    async clearCooldowns(provider) {
        await this.lock.acquire();
        try {
            const profiles = this.loadProfiles();
            for (const profile of profiles) {
                if (!provider || profile.provider === provider) {
                    profile.cooldownUntil = 0;
                    profile.errorCount = 0;
                }
            }
            this.saveProfiles(profiles);
        }
        finally {
            this.lock.release();
        }
    }
    // ============================================
    // Private
    // ============================================
    loadProfiles() {
        try {
            if (!fs.existsSync(this.profilesPath))
                return [];
            const content = fs.readFileSync(this.profilesPath, 'utf-8');
            const data = JSON.parse(content);
            if (!Array.isArray(data))
                return [];
            return data;
        }
        catch {
            return [];
        }
    }
    saveProfiles(profiles) {
        const dir = path.dirname(this.profilesPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.profilesPath, JSON.stringify(profiles, null, 2), { mode: 0o600 });
    }
}
// 싱글톤
let defaultManager = null;
export function getAuthProfileManager() {
    if (!defaultManager) {
        defaultManager = new AuthProfileManager();
    }
    return defaultManager;
}
//# sourceMappingURL=AuthProfileManager.js.map