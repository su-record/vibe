/**
 * CLI: vibe sandbox [subcommand]
 *
 * vibe sandbox status   Show active containers
 * vibe sandbox cleanup  Remove inactive containers
 */

export async function sandboxStatusCmd(): Promise<void> {
  try {
    const { sandboxStatus } = await import('../../tools/sandbox/index.js');
    const result = await sandboxStatus({});
    const data = JSON.parse(result.content[0].text);

    if (data.error) {
      console.error(`Sandbox status failed: ${data.error}`);
      return;
    }

    console.log(`Sandbox Containers: ${data.total}`);
    if (data.total === 0) {
      console.log('  No active containers');
      return;
    }

    for (const c of data.containers) {
      console.log(`  ${c.containerId} | ${c.userId} | ${c.scope} | ${c.state} | CPU:${c.cpu} MEM:${c.memoryMb}MB`);
    }
  } catch (err) {
    console.error('Sandbox status failed:', err instanceof Error ? err.message : String(err));
  }
}

export async function sandboxCleanupCmd(): Promise<void> {
  try {
    const { sandboxStatus, shutdownSandboxService } = await import('../../tools/sandbox/index.js');

    // Get current count before cleanup
    const before = await sandboxStatus({});
    const beforeData = JSON.parse(before.content[0].text);

    if (beforeData.error) {
      console.error(`Sandbox cleanup failed: ${beforeData.error}`);
      return;
    }

    // Shutdown triggers cleanup
    await shutdownSandboxService();
    console.log(`Sandbox cleanup complete. Removed ${beforeData.total} container(s).`);
  } catch (err) {
    console.error('Sandbox cleanup failed:', err instanceof Error ? err.message : String(err));
  }
}

export function sandboxHelp(): void {
  console.log(`Sandbox Commands:
  vibe sandbox status    Show active containers
  vibe sandbox cleanup   Remove inactive containers
  `);
}
