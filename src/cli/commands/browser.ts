/**
 * Browser CLI Commands
 *
 * vibe browser status   — 브라우저 연결 상태
 * vibe browser open <url> — URL 열기
 * vibe browser snapshot — 현재 페이지 ARIA 스냅샷
 */

export async function browserStatus(): Promise<void> {
  try {
    const { browserStatus: status } = await import('../../tools/browser/index.js');
    const result = await status();
    console.log(result.content[0].text);
  } catch (err) {
    console.error('❌ Browser status failed:', (err as Error).message);
  }
}

export async function browserOpen(url?: string): Promise<void> {
  if (!url) {
    console.log('Usage: vibe browser open <url>');
    return;
  }

  try {
    const { browserNavigate } = await import('../../tools/browser/index.js');
    const result = await browserNavigate({ url });
    console.log(result.content[0].text);
  } catch (err) {
    console.error('❌ Browser open failed:', (err as Error).message);
  }
}

export async function browserSnapshot(): Promise<void> {
  try {
    const { browserSnapshot: snapshot } = await import('../../tools/browser/index.js');
    const result = await snapshot({ interactive: true, compact: true });
    console.log(result.content[0].text);
  } catch (err) {
    console.error('❌ Browser snapshot failed:', (err as Error).message);
  }
}

export function browserHelp(): void {
  console.log(`
Browser Commands:
  vibe browser status       Check browser connection status
  vibe browser open <url>   Open URL in browser
  vibe browser snapshot     Capture ARIA snapshot of current page
  `);
}
