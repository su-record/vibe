/**
 * CLI Commands: vibe autostart <subcommand>
 * Cross-platform daemon auto-start on boot/login
 *
 * Supports:
 * - macOS: ~/Library/LaunchAgents/com.vibe.daemon.plist
 * - Windows: Startup folder shortcut (.vbs)
 * - Linux: ~/.config/systemd/user/vibe-daemon.service
 *
 * Commands:
 * - vibe autostart enable   - Enable auto-start
 * - vibe autostart disable  - Disable auto-start
 * - vibe autostart status   - Show auto-start status
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as url from 'node:url';
import { execSync } from 'node:child_process';

type Platform = 'darwin' | 'win32' | 'linux';

interface AutostartPaths {
  configPath: string;
  nodePath: string;
  vibePath: string;
  logsDir: string;
}

function resolveVibePaths(): AutostartPaths {
  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
  const vibePath = path.resolve(__dirname, '..', '..', 'cli', 'index.js');
  const nodePath = process.execPath;
  const logsDir = path.join(os.homedir(), '.vibe', 'logs');

  let configPath: string;
  const platform = os.platform() as Platform;

  switch (platform) {
    case 'darwin':
      configPath = path.join(os.homedir(), 'Library', 'LaunchAgents', 'com.vibe.daemon.plist');
      break;
    case 'win32':
      configPath = path.join(
        process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
        'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup',
        'vibe-daemon.vbs'
      );
      break;
    case 'linux':
      configPath = path.join(os.homedir(), '.config', 'systemd', 'user', 'vibe-daemon.service');
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }

  return { configPath, nodePath, vibePath, logsDir };
}

function generateMacOsPlist(paths: AutostartPaths): string {
  const nodeDir = path.dirname(paths.nodePath);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.vibe.daemon</string>

    <key>ProgramArguments</key>
    <array>
        <string>${paths.nodePath}</string>
        <string>${paths.vibePath}</string>
        <string>daemon</string>
        <string>start</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <false/>

    <key>StandardOutPath</key>
    <string>${path.join(paths.logsDir, 'launchd-stdout.log')}</string>

    <key>StandardErrorPath</key>
    <string>${path.join(paths.logsDir, 'launchd-stderr.log')}</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>${nodeDir}:/usr/local/bin:/usr/bin:/bin</string>
        <key>HOME</key>
        <string>${os.homedir()}</string>
    </dict>
</dict>
</plist>`;
}

function generateWindowsVbs(paths: AutostartPaths): string {
  const escapedNode = paths.nodePath.replace(/\\/g, '\\\\');
  const escapedVibe = paths.vibePath.replace(/\\/g, '\\\\');
  return `Set WshShell = CreateObject("WScript.Shell")
WshShell.Run """${escapedNode}"" ""${escapedVibe}"" daemon start", 0, False
Set WshShell = Nothing
`;
}

function generateLinuxService(paths: AutostartPaths): string {
  return `[Unit]
Description=Vibe Daemon
After=network.target

[Service]
Type=forking
ExecStart=${paths.nodePath} ${paths.vibePath} daemon start
Restart=no
Environment=HOME=${os.homedir()}
Environment=PATH=${path.dirname(paths.nodePath)}:/usr/local/bin:/usr/bin:/bin

[Install]
WantedBy=default.target
`;
}

export function autostartEnable(): void {
  const platform = os.platform() as Platform;
  const paths = resolveVibePaths();

  // Ensure logs dir exists
  if (!fs.existsSync(paths.logsDir)) {
    fs.mkdirSync(paths.logsDir, { recursive: true });
  }

  // Ensure parent dir exists
  const parentDir = path.dirname(paths.configPath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  let content: string;
  switch (platform) {
    case 'darwin':
      content = generateMacOsPlist(paths);
      break;
    case 'win32':
      content = generateWindowsVbs(paths);
      break;
    case 'linux':
      content = generateLinuxService(paths);
      break;
    default:
      console.error(`❌ Unsupported platform: ${platform}`);
      process.exit(1);
  }

  fs.writeFileSync(paths.configPath, content, 'utf-8');

  // Platform-specific post-install
  if (platform === 'darwin') {
    console.log(`✅ LaunchAgent 등록 완료`);
    console.log(`   파일: ${paths.configPath}`);
    console.log(`   다음 로그인 시 자동 시작됩니다.`);
    console.log(`   지금 바로 로드하려면: launchctl load ${paths.configPath}`);
  } else if (platform === 'win32') {
    console.log(`✅ Windows 시작프로그램 등록 완료`);
    console.log(`   파일: ${paths.configPath}`);
    console.log(`   다음 로그인 시 자동 시작됩니다.`);
  } else if (platform === 'linux') {
    console.log(`✅ systemd user service 등록 완료`);
    console.log(`   파일: ${paths.configPath}`);
    console.log(`   활성화: systemctl --user enable vibe-daemon`);
    console.log(`   시작: systemctl --user start vibe-daemon`);
  }
}

export function autostartDisable(): void {
  const platform = os.platform() as Platform;
  const paths = resolveVibePaths();

  if (!fs.existsSync(paths.configPath)) {
    console.log('ℹ️  자동 시작이 설정되어 있지 않습니다.');
    return;
  }

  // Platform-specific pre-uninstall
  if (platform === 'darwin') {
    try {
      execSync(`launchctl unload "${paths.configPath}" 2>/dev/null`, { stdio: 'ignore' });
    } catch {
      // Not loaded, fine
    }
  }

  fs.unlinkSync(paths.configPath);

  switch (platform) {
    case 'darwin':
      console.log('✅ LaunchAgent 제거 완료');
      break;
    case 'win32':
      console.log('✅ Windows 시작프로그램 제거 완료');
      break;
    case 'linux':
      console.log('✅ systemd user service 제거 완료');
      console.log('   비활성화: systemctl --user disable vibe-daemon');
      break;
  }
}

export function autostartStatus(): void {
  const platform = os.platform() as Platform;
  const paths = resolveVibePaths();
  const exists = fs.existsSync(paths.configPath);

  const platformLabel: Record<Platform, string> = {
    darwin: 'macOS (LaunchAgent)',
    win32: 'Windows (Startup)',
    linux: 'Linux (systemd user)',
  };

  console.log(`
🔧 자동 시작 상태
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  플랫폼:    ${platformLabel[platform] || platform}
  상태:      ${exists ? '🟢 활성' : '⚪ 비활성'}
  설정 파일: ${paths.configPath}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `.trim());
}

export function autostartHelp(): void {
  console.log(`
Vibe Autostart Commands:
  vibe autostart enable    컴퓨터 시작 시 데몬 자동 실행
  vibe autostart disable   자동 실행 해제
  vibe autostart status    자동 실행 상태 확인

Supported Platforms:
  macOS   - LaunchAgent (~/Library/LaunchAgents/)
  Windows - Startup folder (shell:startup)
  Linux   - systemd user service (~/.config/systemd/user/)
  `);
}
