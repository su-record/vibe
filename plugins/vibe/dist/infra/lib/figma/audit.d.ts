/**
 * Figma Node Audit — pre-implementation gate that flags properties which
 * Figma's native renderer supports but the browser CSS engine does not
 * (or translates differently). Designer fixes these BEFORE AI reads the
 * file, so the MCP / REST pipeline never sees them.
 *
 * Three failure classes from the Figma↔CSS gap analysis:
 *   1. Mistranslation        — caught by compareRaw (step 4)
 *   2. Unsupported property  — THIS MODULE (step 0)
 *   3. Silent drop           — extract.ts now warns instead of dropping
 */
export type AuditSeverity = 'P1' | 'P2';
export interface AuditFinding {
    nodeId: string;
    /** "Frame / Card / Title" — dot-joined name trail for designer navigation. */
    path: string;
    name: string;
    type: string;
    property: string;
    value: string;
    severity: AuditSeverity;
    /** What breaks in the browser. */
    note: string;
    /** Designer-facing remediation. */
    action: string;
}
export interface AuditReport {
    fileKey: string;
    nodeId: string;
    scannedNodes: number;
    findings: AuditFinding[];
    p1Count: number;
    p2Count: number;
}
export declare function auditNode(fileKey: string, nodeId: string, depth?: number): Promise<AuditReport>;
export declare function formatAuditReport(report: AuditReport): string;
//# sourceMappingURL=audit.d.ts.map