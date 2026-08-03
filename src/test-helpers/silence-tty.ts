/**
 * 테스트 워커의 raw stdout 쓰기를 억제한다.
 *
 * vitest 의 `silent` 는 console.* 를 가로채지만, `@clack/prompts` 는 배너·스피너·
 * 커서 제어(`\x1b[?25l`)를 `process.stdout.write` 로 직접 쓴다. 그래서 1700개가
 * 통과하는 동안에도 터미널이 진행 표시로 뒤덮여 실제 실패 신호를 찾기 어려웠다.
 *
 * 이 파일은 `setupFiles` 로 **테스트 워커에서만** 실행된다 — vitest 리포터는
 * 메인 프로세스에서 쓰므로 영향받지 않는다. 진단 정보는 console.* 로 남고,
 * vitest 가 실패한 테스트에 한해 그대로 보여준다.
 *
 * 저장소 전체에서 `process.stdout` 을 검증하는 테스트는 0건임을 확인하고 도입했다.
 * 원래 동작이 필요하면 `VITEST_ALLOW_TTY=1`.
 */

function swallowWrites(stream: NodeJS.WriteStream): void {
  stream.write = ((_chunk: string | Uint8Array, ...rest: unknown[]): boolean => {
    const callback = rest.find((arg): arg is () => void => typeof arg === 'function');
    callback?.();
    return true;
  }) as typeof stream.write;
}

if (!process.env.VITEST_ALLOW_TTY) {
  // stdout: @clack/prompts 의 배너·스피너·커서 제어
  swallowWrites(process.stdout);
  // stderr: CircuitBreaker·RollbackManager 등이 process.stderr.write 로 직접 쓴다
  swallowWrites(process.stderr);
}

export {};
