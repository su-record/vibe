export interface InstallHome {
    /** 자산을 설치할 홈 디렉토리 */
    home: string;
    /** sudo 로 승격된 경우 원래 사용자의 uid — 소유권 복원에 쓴다 */
    uid?: number;
    /** 위와 동일한 gid */
    gid?: number;
    /** sudo 승격이 감지되어 홈을 되돌렸는지 */
    redirected: boolean;
}
/**
 * 자산을 설치할 홈을 정한다.
 *
 * sudo 로 root 가 된 경우에만 원래 사용자 홈으로 되돌린다. 진짜 root 설치
 * (SUDO_USER 없음)는 그대로 `/root` 를 쓴다 — 되돌릴 대상이 없다.
 */
export declare function resolveInstallHome(): InstallHome;
/**
 * root 가 만든 트리의 소유권을 원래 사용자에게 되돌린다.
 *
 * 실패해도 설치를 중단하지 않는다 — 자산이 있는 편이 없는 것보다 낫고,
 * 소유권은 사용자가 나중에 고칠 수 있다.
 *
 * @returns 소유권을 바꿨으면 true
 */
export declare function restoreOwnership(target: string, info: InstallHome): boolean;
//# sourceMappingURL=InstallHome.d.ts.map