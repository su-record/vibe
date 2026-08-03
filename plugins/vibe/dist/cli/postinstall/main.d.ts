#!/usr/bin/env node
/**
 * postinstall 메인 오케스트레이션
 */
/**
 * 이 저장소 자신에서 install 을 돌린 경우인지 판정한다.
 *
 * npm·pnpm 은 install 을 시작한 디렉토리를 INIT_CWD 로 넘긴다. 그것이 이 패키지의
 * 루트와 같다면 소비자 설치가 아니라 **개발자가 자기 작업 트리에서 install 한 것**이다.
 * 그대로 진행하면 작업 중인 브랜치의 자산이 개발자의 전역 홈(~/.claude, ~/.vibe)을
 * 덮어쓴다 — 브랜치를 옮길 때마다 전역 하네스가 조용히 바뀐다.
 *
 * @param packageRoot 이 패키지의 루트 (dist 기준으로 역산된 경로)
 */
export declare function isSelfInstall(packageRoot: string): boolean;
/**
 * postinstall 메인 함수
 */
export declare function main(): void;
//# sourceMappingURL=main.d.ts.map