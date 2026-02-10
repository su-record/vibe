/**
 * GPT 인증 관리
 * - 고정 순서: oauth → apikey → azure
 * - Azure: az CLI 자동 탐지 또는 수동 설정
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';
import { getValidAccessToken } from '../gpt-oauth.js';
import { warnLog } from '../utils.js';
import { getAuthProfileManager } from '../llm/auth/AuthProfileManager.js';
import type { AuthInfo, GptAuthMethod, AzureOpenAIConfig } from './types.js';

// 고정 인증 순서: oauth → apikey → azure
// OAuth(Codex CLI) → chatgpt.com/backend-api/codex, API Key → api.openai.com/v1
const AUTH_ORDER: GptAuthMethod[] = ['oauth', 'apikey', 'azure'];

// 전역 설정 디렉토리 경로
export function getGlobalConfigDir(): string {
  return process.platform === 'win32'
    ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'vibe')
    : path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'vibe');
}

// API Key 가져오기 (전역 저장소)
export function getApiKeyFromConfig(): string | null {
  try {
    const globalKeyPath = path.join(getGlobalConfigDir(), 'gpt-apikey.json');
    if (fs.existsSync(globalKeyPath)) {
      const data = JSON.parse(fs.readFileSync(globalKeyPath, 'utf-8'));
      if (data.apiKey) {
        return data.apiKey;
      }
    }
  } catch (e) {
    warnLog('GPT API key read failed', e);
  }
  return null;
}

// Azure 설정 가져오기
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
  } catch (e) {
    warnLog('Azure config read failed', e);
  }
  return null;
}

// OAuth 토큰 없을 때 config에서 email 제거
export function removeEmailFromConfigIfNoToken(): void {
  try {
    const configPath = path.join(process.cwd(), '.claude', 'vibe', 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.models?.gpt?.email) {
        delete config.models.gpt.email;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      }
    }
  } catch (e) {
    warnLog('Failed to remove email from GPT config', e);
  }
}

/**
 * az CLI 명령 실행 (동기, JSON 파싱)
 * 실패 시 null 반환
 */
function azCliExec(command: string): unknown | null {
  try {
    const result = execSync(command, {
      encoding: 'utf-8',
      timeout: 15_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return JSON.parse(result);
  } catch {
    return null;
  }
}

/**
 * Azure 설정 저장 (자동 탐지 결과를 ~/.config/vibe/gpt-azure.json에 저장)
 */
function saveAzureConfig(config: AzureOpenAIConfig): void {
  const globalConfigDir = getGlobalConfigDir();
  if (!fs.existsSync(globalConfigDir)) {
    fs.mkdirSync(globalConfigDir, { recursive: true });
  }
  const configPath = path.join(globalConfigDir, 'gpt-azure.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
}

/**
 * GPT 모델 등급 점수 (높을수록 우수)
 * gpt-5.3 > gpt-5.2 > gpt-5
 */
function modelScore(model: string): number {
  const m = model.toLowerCase();
  // 버전 번호 추출 (gpt-5.2, gpt-4o, gpt-3.5 등)
  const match = m.match(/gpt-?(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  const ver = parseFloat(match[1]);
  // o1/o3 같은 reasoning 모델 보너스
  if (/\bo[134]\b/.test(m)) return ver + 100;
  // -chat, -turbo 등은 같은 버전 내 우선
  if (/chat|turbo/.test(m)) return ver + 0.1;
  return ver;
}

/**
 * 디플로이먼트 중 최상위 모델 선택
 */
function selectBestDeploy<T extends { model: string }>(deploys: T[]): T {
  return deploys.reduce((best, cur) =>
    modelScore(cur.model) > modelScore(best.model) ? cur : best
  );
}

/**
 * az CLI에서 Azure OpenAI 리소스 자동 탐지
 * Gemini CLI 크레덴셜 자동 수집(getGeminiCliCredentials)과 동일한 패턴:
 * - 저장된 설정 없을 때 자동으로 az CLI 탐색
 * - 발견하면 저장 후 반환, 실패하면 null
 */
function discoverAzureFromCli(): AzureOpenAIConfig | null {
  // 1. az CLI 존재 확인
  try {
    execSync('az --version', { stdio: 'pipe', timeout: 5_000 });
  } catch {
    return null;
  }

  // 2. 로그인 확인
  const account = azCliExec('az account show -o json') as Record<string, unknown> | null;
  if (!account) return null;

  // 3. Cognitive Services / AI Services 리소스 탐색
  type AzResource = { name: string; resourceGroup: string; endpoint: string; kind: string };
  const resources = azCliExec(
    'az cognitiveservices account list --query "[].{name:name, resourceGroup:resourceGroup, endpoint:properties.endpoint, kind:kind}" -o json'
  ) as AzResource[] | null;

  if (!resources || resources.length === 0) return null;

  // OpenAI 또는 AIServices 리소스 필터
  const aiResources = resources.filter(
    r => r.kind === 'OpenAI' || r.kind === 'AIServices' || r.kind === 'CognitiveServices'
  );
  if (aiResources.length === 0) return null;

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

    // API 키 가져오기
    const keys = azCliExec(
      `az cognitiveservices account keys list --name "${resource.name}" --resource-group "${resource.resourceGroup}" -o json`
    ) as { key1?: string; key2?: string } | null;

    if (!keys?.key1) continue;

    for (const deploy of chatDeploys) {
      candidates.push({ resource, deploy, apiKey: keys.key1 });
    }
  }

  if (candidates.length === 0) return null;

  // 5. 전체 후보 중 최상위 모델 선택
  const best = candidates.reduce((a, b) =>
    modelScore(b.deploy.model) > modelScore(a.deploy.model) ? b : a
  );

  // 6. 설정 저장 및 반환
  const config: AzureOpenAIConfig = {
    endpoint: best.resource.endpoint.replace(/\/$/, ''),
    apiKey: best.apiKey,
    deployment: best.deploy.name,
    apiVersion: '2024-12-01-preview',
    createdAt: Date.now(),
  };

  saveAzureConfig(config);
  return config;
}

/**
 * 개별 인증 방식 시도
 */
async function tryAuthMethod(method: GptAuthMethod): Promise<AuthInfo | null> {
  switch (method) {
    case 'oauth': {
      try {
        const { accessToken, email, accountId } = await getValidAccessToken();
        return { type: 'oauth', accessToken, email, accountId };
      } catch {
        removeEmailFromConfigIfNoToken();
        return null;
      }
    }
    case 'apikey': {
      const apiKey = getApiKeyFromConfig();
      if (apiKey) {
        return { type: 'apikey', apiKey };
      }
      return null;
    }
    case 'azure': {
      // 1. 저장된 설정 확인
      let config = getAzureConfig();

      // 2. 없으면 az CLI에서 자동 탐지 (Gemini CLI 자동 수집과 동일 패턴)
      if (!config) {
        config = discoverAzureFromCli();
      }

      if (config) {
        return {
          type: 'azure',
          azureEndpoint: config.endpoint,
          azureApiKey: config.apiKey,
          azureDeployment: config.deployment,
          azureApiVersion: config.apiVersion,
        };
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * 인증 방식 확인 (고정 순서: oauth → apikey → azure)
 * 순서대로 시도, 실패 시 다음 방식으로 fallback
 */
export async function getAuthInfo(): Promise<AuthInfo> {
  for (const method of AUTH_ORDER) {
    const auth = await tryAuthMethod(method);
    if (auth) return auth;
  }

  throw new Error(
    'GPT credentials not found. Tried: oauth, apikey, azure. ' +
    'Run vibe gpt auth (OAuth) or vibe gpt key <key> (API Key) to configure.'
  );
}

/**
 * Auth Profile 기반 성공/실패 마킹 (optional)
 */
export async function markAuthSuccess(profileId: string): Promise<void> {
  try {
    const manager = getAuthProfileManager();
    await manager.markSuccess(profileId);
  } catch {
    // Profile rotation is optional — ignore errors
  }
}

export async function markAuthFailure(profileId: string, errorMsg?: string): Promise<void> {
  try {
    const manager = getAuthProfileManager();
    await manager.markFailure(profileId, errorMsg);
  } catch {
    // Profile rotation is optional — ignore errors
  }
}
