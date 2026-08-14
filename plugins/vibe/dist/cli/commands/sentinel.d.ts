/**
 * vibe sentinel CLI commands
 * Security Sentinel 관리 명령어
 */
export declare function sentinelStatus(): void;
export declare function sentinelAudit(type?: string, risk?: string, days?: string, deadLetter?: boolean, retryId?: string, discardId?: string): void;
export declare function sentinelApprove(id: string): void;
export declare function sentinelReject(id: string): void;
export declare function sentinelPolicyList(): void;
export declare function sentinelPolicyToggle(name: string, enable: boolean): void;
export declare function sentinelSuggestions(action?: string, id?: string): void;
export declare function sentinelHelp(): void;
//# sourceMappingURL=sentinel.d.ts.map