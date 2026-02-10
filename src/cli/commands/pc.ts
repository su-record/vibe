/**
 * CLI: vibe pc [subcommand]
 *
 * vibe pc status    Show all module status
 * vibe pc modules   List modules
 * vibe pc health    Run health check
 */

export async function pcStatusCmd(): Promise<void> {
  try {
    const { pcStatus } = await import('../../tools/integration/index.js');
    const result = await pcStatus();
    const data = JSON.parse(result.content[0].text);

    if (data.error) {
      console.error(`PC status failed: ${data.error}`);
      return;
    }

    console.log(`PC Control Modules (${data.modules.length}):`);
    console.log(`Active Sessions: ${data.activeSessions}`);
    console.log('');

    for (const m of data.modules) {
      const icon = m.state === 'enabled' ? '[ON]' : m.state === 'error' ? '[ERR]' : '[OFF]';
      const extra = m.error ? ` - ${m.error}` : '';
      console.log(`  ${icon} ${m.name}${extra}`);
    }
  } catch (err) {
    console.error('PC status failed:', err instanceof Error ? err.message : String(err));
  }
}

export async function pcModulesCmd(): Promise<void> {
  try {
    const { pcModules } = await import('../../tools/integration/index.js');
    const result = await pcModules({ action: 'list' });
    const data = JSON.parse(result.content[0].text);

    if (data.error) {
      console.error(`PC modules failed: ${data.error}`);
      return;
    }

    console.log('Modules:');
    for (const m of data.modules) {
      console.log(`  ${m.name}: ${m.state}`);
    }
  } catch (err) {
    console.error('PC modules failed:', err instanceof Error ? err.message : String(err));
  }
}

export async function pcHealthCmd(): Promise<void> {
  try {
    const { pcStatus } = await import('../../tools/integration/index.js');
    const result = await pcStatus();
    const data = JSON.parse(result.content[0].text);

    if (data.error) {
      console.error(`Health check failed: ${data.error}`);
      return;
    }

    console.log('Health Check:');
    for (const m of data.modules) {
      const status = m.state === 'enabled' ? 'OK' : m.state === 'error' ? 'FAIL' : 'N/A';
      const failCount = m.healthFailCount > 0 ? ` (fails: ${m.healthFailCount})` : '';
      console.log(`  ${m.name}: ${status}${failCount}`);
    }
  } catch (err) {
    console.error('Health check failed:', err instanceof Error ? err.message : String(err));
  }
}

export function pcHelp(): void {
  console.log(`PC Control Commands:
  vibe pc status    Show all module status
  vibe pc modules   List modules
  vibe pc health    Run health check
  `);
}
