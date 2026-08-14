/**
 * AuthProfileManager - Auth Profile Rotation 관리
 * Rate Limit 대응을 위한 다중 인증 프로필 순환
 */
import { ProfileFileLock } from './ProfileFileLock.js';
export type AuthProfileProvider = 'gpt' | 'antigravity';
export interface AuthProfile {
    id: string;
    provider: AuthProfileProvider;
    type: 'codex-cli' | 'antigravity-cli' | 'apikey';
    identifier: string;
    priority: number;
    cooldownUntil: number;
    errorCount: number;
    lastUsedAt: number;
    lastSuccessAt: number;
    lastError?: string;
}
export declare class AuthProfileManager {
    private readonly profilesPath;
    private readonly lock;
    constructor(profilesPath?: string, lock?: ProfileFileLock);
    /**
     * 프로필 목록 조회
     */
    listProfiles(provider?: AuthProfileProvider): AuthProfile[];
    /**
     * 활성 프로필 선택 (cooldown 아닌 최우선)
     */
    getActiveProfile(provider: AuthProfileProvider): AuthProfile | null;
    /**
     * 프로필 추가
     */
    addProfile(provider: AuthProfileProvider, type: 'codex-cli' | 'antigravity-cli' | 'apikey', rawIdentifier: string, priority?: number): Promise<AuthProfile>;
    /**
     * 프로필 삭제
     */
    removeProfile(profileId: string): Promise<boolean>;
    /**
     * 성공 마킹
     */
    markSuccess(profileId: string): Promise<void>;
    /**
     * 실패 마킹
     */
    markFailure(profileId: string, errorMsg?: string): Promise<void>;
    /**
     * 다음 프로필로 순환
     */
    rotateToNext(provider: AuthProfileProvider): AuthProfile | null;
    /**
     * 모든 cooldown 초기화
     */
    clearCooldowns(provider?: AuthProfileProvider): Promise<void>;
    private loadProfiles;
    private saveProfiles;
}
export declare function getAuthProfileManager(): AuthProfileManager;
//# sourceMappingURL=AuthProfileManager.d.ts.map