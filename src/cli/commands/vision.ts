/**
 * CLI: vibe vision [subcommand]
 *
 * vibe vision start [--mode full|region|window]
 * vibe vision stop
 * vibe vision snapshot [--region x,y,w,h]
 */

export async function visionStartCmd(mode?: string): Promise<void> {
  try {
    const { visionStart } = await import('../../tools/vision/index.js');
    const result = await visionStart({ mode });
    const data = JSON.parse(result.content[0].text);

    if (data.error) {
      console.error(`Vision start failed: ${data.error}`);
      return;
    }

    console.log('Vision Session Started');
    console.log(`  Session ID: ${data.sessionId}`);
    console.log(`  Mode: ${data.mode}`);
    console.log(`  State: ${data.state}`);
  } catch (err) {
    console.error('Vision start failed:', err instanceof Error ? err.message : String(err));
  }
}

export async function visionStopCmd(): Promise<void> {
  try {
    const { visionStop } = await import('../../tools/vision/index.js');
    const result = await visionStop();
    const data = JSON.parse(result.content[0].text);

    if (data.error) {
      console.error(`Vision stop failed: ${data.error}`);
      return;
    }

    console.log(data.message);
  } catch (err) {
    console.error('Vision stop failed:', err instanceof Error ? err.message : String(err));
  }
}

export async function visionSnapshotCmd(regionStr?: string): Promise<void> {
  try {
    const { visionSnapshot } = await import('../../tools/vision/index.js');

    let args: { mode?: string; x?: number; y?: number; width?: number; height?: number } = {};
    if (regionStr) {
      const parts = regionStr.split(',').map(Number);
      if (parts.length === 4 && parts.every(n => !isNaN(n))) {
        args = { mode: 'region', x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
      }
    }

    const result = await visionSnapshot(args);
    const data = JSON.parse(result.content[0].text);

    if (data.error) {
      console.error(`Snapshot failed: ${data.error}`);
      return;
    }

    console.log('Snapshot captured');
    console.log(`  Mode: ${data.mode}`);
    console.log(`  Format: ${data.format}`);
    console.log(`  Size: ${data.width}x${data.height}`);
    console.log(`  Bytes: ${data.sizeBytes}`);
  } catch (err) {
    console.error('Snapshot failed:', err instanceof Error ? err.message : String(err));
  }
}

export function visionHelp(): void {
  console.log(`Vision Commands:
  vibe vision start [--mode full|region|window]  Start vision session
  vibe vision stop                                Stop vision session
  vibe vision snapshot [--region x,y,w,h]         Take a screenshot
  `);
}
