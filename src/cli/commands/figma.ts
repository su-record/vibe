/**
 * CLI Commands: vibe figma <subcommand>
 *
 * Figma configuration management.
 * Extraction is handled by src/infra/lib/figma/ (Figma REST API direct).
 * Token stored in ~/.vibe/config.json is required for API access.
 */

import {
  readGlobalConfig,
  patchGlobalConfig,
} from '../../infra/lib/config/GlobalConfigManager.js';
import type { FigmaBreakpoints, FigmaCredentials } from '../types.js';

const DEFAULT_BREAKPOINTS: FigmaBreakpoints = {
  breakpoint: 1024,
  pcTarget: 1920,
  mobilePortrait: 480,
  mobileMinimum: 360,
  designPc: 2560,
  designMobile: 720,
};

function loadFigmaConfig(): FigmaCredentials | null {
  return readGlobalConfig().credentials?.figma ?? null;
}

function loadBreakpoints(): FigmaBreakpoints {
  const userBp = readGlobalConfig().figma?.breakpoints;
  if (!userBp) return DEFAULT_BREAKPOINTS;
  return { ...DEFAULT_BREAKPOINTS, ...userBp };
}

/**
 * vibe figma setup <token>
 */
export function figmaSetup(token?: string): void {
  if (!token) {
    console.log('Usage: vibe figma setup <access-token>');
    console.log('  Get a token from: Figma > Settings > Personal access tokens');
    return;
  }

  patchGlobalConfig({
    credentials: {
      figma: {
        accessToken: token,
        createdAt: new Date().toISOString(),
      },
    },
  });
  console.log('Figma access token saved');
}

/**
 * vibe figma status
 */
export function figmaStatus(): void {
  const config = loadFigmaConfig();
  const envToken = process.env.FIGMA_ACCESS_TOKEN;

  if (!config?.accessToken && !envToken) {
    console.log('Figma: not configured');
    console.log('  Run: vibe figma setup <access-token>');
    return;
  }

  if (config?.accessToken) {
    const token = config.accessToken;
    const preview = token.slice(0, 8) + '...' + token.slice(-4);
    console.log(`Figma: configured (${preview})`);
    if (config.createdAt) {
      console.log(`  Added: ${config.createdAt}`);
    }
  } else if (envToken) {
    console.log('Figma: configured (via FIGMA_ACCESS_TOKEN env)');
  }
}

/**
 * vibe figma logout
 */
export function figmaLogout(): void {
  const config = loadFigmaConfig();
  if (!config?.accessToken) {
    console.log('Figma: not configured');
    return;
  }

  patchGlobalConfig({
    credentials: {
      figma: { accessToken: undefined, createdAt: undefined },
    },
  });
  console.log('Figma access token removed');
}

/**
 * vibe figma breakpoints [--set key=value]
 * Show or update responsive breakpoint defaults.
 */
export function figmaBreakpoints(setArg?: string): void {
  if (setArg) {
    const [key, val] = setArg.split('=');
    const num = Number(val);
    if (!key || Number.isNaN(num)) {
      console.error('Usage: vibe figma breakpoints --set <key>=<value>');
      console.error('  Keys: breakpoint, pcTarget, mobilePortrait, mobileMinimum, designPc, designMobile');
      return;
    }
    const validKeys = Object.keys(DEFAULT_BREAKPOINTS);
    if (!validKeys.includes(key)) {
      console.error(`Unknown key: ${key}. Valid keys: ${validKeys.join(', ')}`);
      return;
    }
    patchGlobalConfig({
      figma: { breakpoints: { [key]: num } },
    });
    console.log(`Breakpoint updated: ${key} = ${num}px`);
  }

  const bp = loadBreakpoints();
  const isCustom = readGlobalConfig().figma?.breakpoints;
  console.log(`Figma Breakpoints${isCustom ? ' (customized)' : ' (defaults)'}:`);
  console.log(`  breakpoint:     ${bp.breakpoint}px  (PC↔Mobile boundary)`);
  console.log(`  pcTarget:       ${bp.pcTarget}px  (PC main target)`);
  console.log(`  mobilePortrait: ${bp.mobilePortrait}px  (Mobile portrait max)`);
  console.log(`  mobileMinimum:  ${bp.mobileMinimum}px  (Mobile minimum)`);
  console.log(`  designPc:       ${bp.designPc}px  (Figma PC artboard)`);
  console.log(`  designMobile:   ${bp.designMobile}px  (Figma Mobile artboard)`);
  if (!isCustom) {
    console.log('\n  Customize: vibe figma breakpoints --set breakpoint=768');
  }
}

/**
 * vibe figma help
 */
export function figmaHelp(): void {
  console.log(`
Figma Commands:
  vibe figma setup <token>                Set Figma access token
  vibe figma breakpoints                  Show current breakpoint defaults
  vibe figma breakpoints --set key=value  Customize a breakpoint value
  vibe figma status                       Show configuration
  vibe figma logout                       Remove access token
  vibe figma help                         Show this help

Breakpoint keys:
  breakpoint      PC↔Mobile boundary (default: 1024px)
  pcTarget        PC main target resolution (default: 1920px)
  mobilePortrait  Mobile portrait max width (default: 480px)
  mobileMinimum   Mobile minimum width (default: 360px)
  designPc        Figma PC artboard width (default: 2560px)
  designMobile    Figma Mobile artboard width (default: 720px)

Workflow:
  1. vibe figma setup <token>
  2. claude /vibe.figma "figma-url"
  `);
}
