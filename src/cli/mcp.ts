/**
 * MCP 서버 관리 함수
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';
import { McpServerConfig, ClaudeSettings } from './types.js';

// Claude CLI 경로 캐시
let _claudePath: string | null = null;

/**
 * Claude CLI 경로 찾기 (Windows/macOS/Linux 지원)
 */
export function getClaudePath(): string {
  // 1. PATH에서 'claude' 찾기
  try {
    execSync('claude --version', { stdio: 'pipe' });
    return 'claude';
  } catch { /* ignore: optional operation */
    // PATH에 없으면 플랫폼별 기본 경로 확인
  }

  // 2. 플랫폼별 네이티브 설치 경로 확인
  if (process.platform === 'win32') {
    const possiblePaths = [
      path.join(os.homedir(), '.local', 'bin', 'claude.exe'),
      path.join(process.env.APPDATA || '', 'npm', 'claude.cmd'),
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', '@anthropic', 'claude-code', 'claude.exe'),
      path.join(os.homedir(), 'AppData', 'Local', 'AnthropicClaude', 'claude.exe'),
      path.join(os.homedir(), '.claude', 'local', 'claude.exe'),
      'C:\\Program Files\\Anthropic\\Claude\\claude.exe',
      'C:\\Program Files (x86)\\Anthropic\\Claude\\claude.exe',
    ];

    for (const p of possiblePaths) {
      if (p && fs.existsSync(p)) {
        return `"${p}"`;
      }
    }
  } else {
    const possiblePaths = [
      path.join(os.homedir(), '.local', 'bin', 'claude'),
      '/usr/local/bin/claude',
      '/usr/bin/claude',
      '/opt/homebrew/bin/claude',
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
  }

  return 'claude';
}

/**
 * Claude CLI 명령어 반환 (캐시됨)
 */
export function claudeCmd(): string {
  if (_claudePath === null) {
    _claudePath = getClaudePath();
  }
  return _claudePath;
}

/**
 * Claude CLI가 사용 가능한지 확인
 */
export function isClaudeCliAvailable(): boolean {
  const cmd = claudeCmd();
  try {
    execSync(`${cmd} --version`, { stdio: 'pipe' });
    return true;
  } catch { /* ignore: optional operation */
    return false;
  }
}

/**
 * Claude 설정 파일 경로
 */
export function getClaudeSettingsPath(): string {
  return path.join(os.homedir(), '.claude', 'settings.json');
}

/**
 * Claude 설정 파일 읽기
 */
export function readClaudeSettings(): ClaudeSettings {
  const settingsPath = getClaudeSettingsPath();
  if (fs.existsSync(settingsPath)) {
    try {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as ClaudeSettings;
    } catch { /* ignore: optional operation */
      return {};
    }
  }
  return {};
}

/**
 * Claude 설정 파일 쓰기
 */
export function writeClaudeSettings(settings: ClaudeSettings): void {
  const settingsPath = getClaudeSettingsPath();
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

/**
 * MCP 서버 추가 (설정 파일 직접 수정)
 */
export function addMcpServer(name: string, config: McpServerConfig): void {
  const settings = readClaudeSettings();
  if (!settings.mcpServers) {
    settings.mcpServers = {};
  }
  settings.mcpServers[name] = config;
  writeClaudeSettings(settings);
}

/**
 * MCP 서버 제거
 */
export function removeMcpServer(name: string): void {
  const settings = readClaudeSettings();
  if (settings.mcpServers && settings.mcpServers[name]) {
    delete settings.mcpServers[name];
    writeClaudeSettings(settings);
  }
}

/**
 * MCP 서버 등록 (CLI 우선, 실패시 직접 수정)
 */
export function registerMcp(name: string, config: McpServerConfig): void {
  const cmd = claudeCmd();

  // CLI로 먼저 시도
  try {
    const argsStr = config.args.map(a => `"${a}"`).join(' ');
    execSync(`${cmd} mcp add ${name} ${config.command} ${argsStr}`, {
      stdio: 'pipe'
    });
    return;
  } catch { /* ignore: optional operation */
    // CLI 실패시 직접 설정 파일 수정
  }

  // 설정 파일 직접 수정
  addMcpServer(name, config);
}

/**
 * MCP 서버 등록 해제
 */
export function unregisterMcp(name: string): void {
  // 설정 파일에서 직접 제거 (CLI 호출 없이)
  // CLI 호출 시 없는 MCP 제거 시도하면 무한 대기 문제 발생
  removeMcpServer(name);
}

/**
 * MCP 서버가 등록되어 있는지 확인
 */
export function isMcpRegistered(name: string): boolean {
  const settings = readClaudeSettings();
  return !!settings.mcpServers?.[name];
}
