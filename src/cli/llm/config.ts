/**
 * LLM 설정 관리
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { ExternalLLMConfig, VibeConfig } from '../types.js';

/**
 * 외부 LLM 설정
 */
export const EXTERNAL_LLMS: Record<string, ExternalLLMConfig> = {
  claude: {
    name: 'core-claude',
    role: 'fallback',
    description: 'Claude API (Anthropic Direct)',
    package: '',
    envKey: 'ANTHROPIC_API_KEY'
  },
  gpt: {
    name: 'core-gpt',
    role: 'architecture',
    description: 'Architecture/Debugging (GPT 5.2)',
    package: '@anthropics/openai-mcp',
    envKey: 'OPENAI_API_KEY'
  },
  gemini: {
    name: 'core-gemini',
    role: 'ui-ux',
    description: 'UI/UX Design (Gemini 3)',
    package: '@anthropics/gemini-mcp',
    envKey: 'GOOGLE_API_KEY'
  },
  az: {
    name: 'core-az',
    role: 'code-review',
    description: 'Multi-model orchestration (Azure Foundry)',
    package: '',
    envKey: 'AZ_API_KEY'
  },
  kimi: {
    name: 'core-kimi',
    role: 'code-review',
    description: 'Kimi K2.5 Direct (Moonshot API)',
    package: '',
    envKey: 'KIMI_API_KEY'
  }
};

/**
 * 전역 설정 디렉토리 경로 가져오기
 */
export function getGlobalConfigDir(): string {
  return process.platform === 'win32'
    ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'vibe')
    : path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'vibe');
}

/**
 * 외부 LLM API 키로 설정 (전역 저장소)
 */
export function setupExternalLLM(llmType: string, apiKey: string): void {
  if (!apiKey) {
    console.log(`
❌ API key required.

Usage:
  vibe ${llmType} key <api-key>

${llmType === 'gpt' ? 'OpenAI API key: https://platform.openai.com/api-keys' : 'Google API key: https://aistudio.google.com/apikey'}
    `);
    return;
  }

  // 전역 설정 디렉토리에 저장
  const globalConfigDir = getGlobalConfigDir();
  if (!fs.existsSync(globalConfigDir)) {
    fs.mkdirSync(globalConfigDir, { recursive: true });
  }

  const authFile = path.join(globalConfigDir, `${llmType}-apikey.json`);
  const authData = {
    type: 'apikey',
    apiKey: apiKey,
    createdAt: Date.now()
  };

  fs.writeFileSync(authFile, JSON.stringify(authData, null, 2));

  const llmConfig = EXTERNAL_LLMS[llmType];

  // 프로젝트 config.json도 업데이트 (선택적)
  const projectRoot = process.cwd();
  const coreDir = path.join(projectRoot, '.claude', 'vibe');
  const configPath = path.join(coreDir, 'config.json');

  if (fs.existsSync(configPath)) {
    try {
      const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (!config.models) config.models = {};
      config.models[llmType as 'gpt' | 'gemini'] = {
        enabled: true,
        authType: 'apikey',
        role: llmConfig.role,
        description: llmConfig.description,
      };
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch { /* ignore: optional operation */ }
  }

  console.log(`
✅ ${llmType.toUpperCase()} API key configured!

Role: ${llmConfig.description}
Stored: ${authFile}

${llmType.toUpperCase()} is called directly via Hooks:
  - Auto-called with "${llmType}. query" prefix
  - Direct use: import('@su-record/core/lib/${llmType}')

Disable: vibe ${llmType} remove
  `);
}

/**
 * 외부 LLM 제거 (전역 + 프로젝트)
 */
export function removeExternalLLM(llmType: string): void {
  const globalConfigDir = getGlobalConfigDir();
  let removed = false;

  // 1. 전역 API 키 파일 삭제
  const apiKeyFile = path.join(globalConfigDir, `${llmType}-apikey.json`);
  if (fs.existsSync(apiKeyFile)) {
    fs.unlinkSync(apiKeyFile);
    removed = true;
  }

  // 2. 전역 OAuth 토큰 파일 삭제
  const authFile = path.join(globalConfigDir, `${llmType}-auth.json`);
  if (fs.existsSync(authFile)) {
    fs.unlinkSync(authFile);
    removed = true;
  }

  // 3. 프로젝트 config.json 비활성화 (선택적)
  const projectRoot = process.cwd();
  const coreDir = path.join(projectRoot, '.claude', 'vibe');
  const configPath = path.join(coreDir, 'config.json');

  if (fs.existsSync(configPath)) {
    try {
      const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.models?.[llmType as 'gpt' | 'gemini']) {
        config.models[llmType as 'gpt' | 'gemini']!.enabled = false;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      }
    } catch { /* ignore */ }
  }

  if (removed) {
    console.log(`✅ ${llmType.toUpperCase()} credentials removed`);
  } else {
    console.log(`ℹ️ ${llmType.toUpperCase()} no credentials found`);
  }
}

// ============================================================================
// Azure OpenAI 설정
// ============================================================================

export interface AzureOpenAIConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
  createdAt: number;
}

/**
 * Azure 설정 저장 (내부 공통)
 */
function saveAzureConfig(config: AzureOpenAIConfig): void {
  const globalConfigDir = getGlobalConfigDir();
  if (!fs.existsSync(globalConfigDir)) {
    fs.mkdirSync(globalConfigDir, { recursive: true });
  }

  const configPath = path.join(globalConfigDir, 'gpt-azure.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });

  console.log(`
✅ Azure OpenAI configured!

Endpoint:    ${config.endpoint}
Deployment:  ${config.deployment}
API Version: ${config.apiVersion}
Stored: ${configPath}

Auth order: oauth → apikey → azure
  `);
}

/**
 * az CLI 실행 (동기, JSON 파싱)
 */
function azCliExec(command: string): unknown | null {
  try {
    const { execSync } = require('child_process') as typeof import('child_process');
    const result = execSync(command, { encoding: 'utf-8', timeout: 15_000, stdio: ['pipe', 'pipe', 'pipe'] });
    return JSON.parse(result);
  } catch {
    return null;
  }
}

/**
 * GPT 모델 등급 점수 (높을수록 우수)
 */
function modelScore(model: string): number {
  const m = model.toLowerCase();
  const match = m.match(/gpt-?(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  const ver = parseFloat(match[1]);
  if (/\bo[134]\b/.test(m)) return ver + 100;
  if (/chat|turbo/.test(m)) return ver + 0.1;
  return ver;
}

function selectBestDeploy<T extends { model: string }>(deploys: T[]): T {
  return deploys.reduce((best, cur) =>
    modelScore(cur.model) > modelScore(best.model) ? cur : best
  );
}

/**
 * az CLI로 Azure OpenAI 리소스 자동 탐지 + 설정
 */
export async function setupAzureFromCli(): Promise<void> {
  // 1. az CLI 존재 확인
  try {
    const { execSync } = require('child_process') as typeof import('child_process');
    execSync('az --version', { stdio: 'pipe', timeout: 5_000 });
  } catch {
    console.log(`
❌ az CLI not found. Install: https://learn.microsoft.com/cli/azure/install-azure-cli

Or set manually:
  vibe gpt azure --endpoint <url> --key <key> --deployment <name>
    `);
    return;
  }

  // 2. 로그인 확인
  const account = azCliExec('az account show -o json') as Record<string, unknown> | null;
  if (!account) {
    console.log(`
❌ Not logged in to Azure. Run: az login
    `);
    return;
  }
  console.log(`Azure account: ${account.name} (${(account.user as Record<string, string>)?.name})`);

  // 3. Cognitive Services / AI Services 리소스 탐색
  type AzResource = { name: string; resourceGroup: string; endpoint: string; kind: string };
  const resources = azCliExec(
    'az cognitiveservices account list --query "[].{name:name, resourceGroup:resourceGroup, endpoint:properties.endpoint, kind:kind}" -o json'
  ) as AzResource[] | null;

  if (!resources || resources.length === 0) {
    console.log('❌ No Azure AI/OpenAI resources found in this subscription.');
    return;
  }

  // OpenAI 또는 AIServices 리소스 필터
  const aiResources = resources.filter(r => r.kind === 'OpenAI' || r.kind === 'AIServices' || r.kind === 'CognitiveServices');
  if (aiResources.length === 0) {
    console.log('❌ No Azure OpenAI-compatible resources found.');
    return;
  }

  // 4. 모든 리소스에서 chat 가능 디플로이먼트 수집
  type AzDeployment = { name: string; model: string; format: string };
  type Candidate = { resource: AzResource; deploy: AzDeployment; apiKey: string };
  const candidates: Candidate[] = [];

  const EXCLUDE_MODELS = /embedding|whisper|dall-e|tts/i;

  for (const resource of aiResources) {
    const deployments = azCliExec(
      `az cognitiveservices account deployment list --name "${resource.name}" --resource-group "${resource.resourceGroup}" --query "[].{name:name, model:properties.model.name, format:properties.model.format}" -o json`
    ) as AzDeployment[] | null;

    if (!deployments || deployments.length === 0) continue;

    const chatDeploys = deployments.filter(
      d => d.format === 'OpenAI' && !EXCLUDE_MODELS.test(d.model)
    );
    if (chatDeploys.length === 0) continue;

    const keys = azCliExec(
      `az cognitiveservices account keys list --name "${resource.name}" --resource-group "${resource.resourceGroup}" -o json`
    ) as { key1?: string; key2?: string } | null;

    if (!keys?.key1) {
      console.log(`⚠️ Resource ${resource.name}: no API keys found, skipping.`);
      continue;
    }

    for (const deploy of chatDeploys) {
      candidates.push({ resource, deploy, apiKey: keys.key1 });
    }
  }

  if (candidates.length === 0) {
    console.log('❌ No chat-capable OpenAI deployments found.');
    return;
  }

  // 5. 전체 후보 중 최상위 모델 선택
  const best = candidates.reduce((a, b) =>
    modelScore(b.deploy.model) > modelScore(a.deploy.model) ? b : a
  );

  console.log(`Found: ${best.resource.name} / ${best.deploy.name} (${best.deploy.model})`);

  saveAzureConfig({
    endpoint: best.resource.endpoint.replace(/\/$/, ''),
    apiKey: best.apiKey,
    deployment: best.deploy.name,
    apiVersion: '2024-12-01-preview',
    createdAt: Date.now(),
  });

  console.log('❌ No OpenAI deployments found in any resource.');
}

/**
 * Azure OpenAI 수동 설정 (--endpoint, --key, --deployment)
 */
export function setupAzureConfig(endpoint: string, apiKey: string, deployment: string, apiVersion?: string): void {
  if (!endpoint || !apiKey || !deployment) {
    console.log(`
❌ Azure OpenAI requires endpoint, key, and deployment.

Usage:
  vibe gpt azure                                    Auto-detect from az CLI
  vibe gpt azure --endpoint <url> --key <key> --deployment <name>   Manual

Example:
  vibe gpt azure --endpoint https://my-resource.openai.azure.com/ --key abc123 --deployment gpt-high
    `);
    return;
  }

  saveAzureConfig({
    endpoint: endpoint.replace(/\/$/, ''),
    apiKey,
    deployment,
    apiVersion: apiVersion || '2024-12-01-preview',
    createdAt: Date.now(),
  });
}

/**
 * Azure OpenAI 설정 읽기
 */
export function getAzureConfig(): AzureOpenAIConfig | null {
  try {
    const configPath = path.join(getGlobalConfigDir(), 'gpt-azure.json');
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
      if (
        typeof data.endpoint === 'string' &&
        typeof data.apiKey === 'string' &&
        typeof data.deployment === 'string'
      ) {
        return {
          endpoint: data.endpoint as string,
          apiKey: data.apiKey as string,
          deployment: data.deployment as string,
          apiVersion: (data.apiVersion as string) || '2024-12-01-preview',
          createdAt: (data.createdAt as number) || 0,
        };
      }
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Azure OpenAI 설정 제거
 */
export function removeAzureConfig(): void {
  try {
    const configPath = path.join(getGlobalConfigDir(), 'gpt-azure.json');
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
      console.log('✅ Azure OpenAI config removed');
    } else {
      console.log('ℹ️ Azure OpenAI config not found');
    }
  } catch { /* ignore */ }
}

