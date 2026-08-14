/**
 * ProfileFileLock - Auth Profile 파일 잠금
 * mkdir atomic 패턴으로 cross-process 안전한 파일 잠금
 */
export declare class ProfileFileLock {
    private readonly lockPath;
    private held;
    constructor(lockPath?: string);
    acquire(timeout?: number): Promise<void>;
    release(): void;
    isLocked(): boolean;
    private isStale;
    private forceRelease;
    private sleep;
}
//# sourceMappingURL=ProfileFileLock.d.ts.map