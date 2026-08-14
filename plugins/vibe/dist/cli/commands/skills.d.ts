/**
 * skills.sh 통합 — 외부 스킬 설치
 */
/**
 * skills.sh 에코시스템에서 스킬 설치
 */
export declare function skillsAdd(target?: string): void;
/**
 * 스택 기반 외부 스킬 자동 설치 (init/update 시 호출)
 * 이미 설치된 패키지는 config.json으로 추적하여 스킵
 */
export declare function installExternalSkills(projectRoot: string, stackTypes: string[], capabilities?: string[]): void;
//# sourceMappingURL=skills.d.ts.map