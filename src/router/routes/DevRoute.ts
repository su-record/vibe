/**
 * DevRoute - Development route for Claude Code operations
 * Handles coding, debugging, testing, git operations via ClaudeCodeBridge
 */

import { ClaudeCodeBridge } from '../../interface/ClaudeCodeBridge.js';
import { ClaudeStreamMessage, InterfaceLogger, PermissionRequest } from '../../interface/types.js';
import { ClassifiedIntent, RouteContext, RouteResult } from '../types.js';
import { BaseRoute } from './BaseRoute.js';
import { RepoResolver } from '../resolvers/RepoResolver.js';
import { DevSessionManager } from '../sessions/DevSessionManager.js';
import { TelegramQABridge } from '../qa/TelegramQABridge.js';
import { NotificationManager } from '../notifications/NotificationManager.js';

export class DevRoute extends BaseRoute {
  readonly name = 'dev';
  private repoResolver: RepoResolver;
  private sessionManager: DevSessionManager;
  private notificationManager: NotificationManager;

  constructor(
    logger: InterfaceLogger,
    repoResolver: RepoResolver,
    sessionManager: DevSessionManager,
    notificationManager: NotificationManager,
  ) {
    super(logger);
    this.repoResolver = repoResolver;
    this.sessionManager = sessionManager;
    this.notificationManager = notificationManager;
  }

  canHandle(intent: ClassifiedIntent): boolean {
    return intent.category === 'development';
  }

  protected async executeInternal(context: RouteContext): Promise<RouteResult> {
    const { intent, chatId, services } = context;
    const projectPath = this.resolveProjectPath(intent.rawQuery);

    if (!projectPath) {
      return {
        success: false,
        error: '프로젝트 경로를 찾을 수 없습니다. 설정을 확인해주세요.',
      };
    }

    // Notify start
    await this.notificationManager.send(chatId, `🔨 개발 작업 시작: ${projectPath}`);

    try {
      const bridge = await this.sessionManager.getSession(chatId, projectPath);
      const result = await this.executeBridge(bridge, intent, context);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      return { success: false, error: error.message };
    }
  }

  /** Extract and resolve project path from query */
  private resolveProjectPath(query: string): string | null {
    // Extract project name from query (first word or known alias)
    const words = query.split(/\s+/);
    for (const word of words) {
      const resolved = this.repoResolver.resolve(word);
      if (resolved) return resolved;
    }
    // Try resolving the entire query as a path
    return this.repoResolver.resolve(query);
  }

  /** Execute ClaudeCodeBridge with the given prompt */
  private async executeBridge(
    bridge: ClaudeCodeBridge,
    intent: ClassifiedIntent,
    context: RouteContext,
  ): Promise<RouteResult> {
    const { chatId, services } = context;

    // Setup QA bridge for permission handling
    const qaBridge = new TelegramQABridge(
      this.logger,
      services.config.qa,
      chatId,
    );
    qaBridge.setServices(services);

    return new Promise<RouteResult>((resolve) => {
      let resultText = '';
      let hasResolved = false;

      const cleanup = (): void => {
        bridge.removeAllListeners('response');
        bridge.removeAllListeners('result');
        bridge.removeAllListeners('error');
        bridge.removeAllListeners('permission_request');
        bridge.removeAllListeners('fatal');
        qaBridge.cleanup();
      };

      const finalize = (result: RouteResult): void => {
        if (hasResolved) return;
        hasResolved = true;
        cleanup();
        resolve(result);
      };

      // Handle streaming responses (progress notifications)
      bridge.on('response', (msg: ClaudeStreamMessage) => {
        const text = this.extractText(msg);
        if (text) {
          resultText += text;
          this.notificationManager.send(chatId, `💬 ${text.slice(0, 200)}`, 'normal');
        }
      });

      // Handle final result
      bridge.on('result', (result: string) => {
        finalize({ success: true, data: result || resultText });
      });

      // Handle errors
      bridge.on('error', (err: Error) => {
        finalize({ success: false, error: err.message });
      });

      // Handle permission requests
      bridge.on('permission_request', async (req: PermissionRequest) => {
        const approved = await qaBridge.handlePermissionRequest(req);
        bridge.sendPermissionResponse(approved);
      });

      // Handle fatal crashes
      bridge.on('fatal', () => {
        finalize({ success: false, error: 'Claude Code 프로세스가 비정상 종료되었습니다.' });
      });

      // Send the prompt
      bridge.sendMessage(intent.rawQuery);
    });
  }

  /** Extract text content from Claude stream message */
  private extractText(msg: ClaudeStreamMessage): string {
    if (typeof msg.message?.content === 'string') {
      return msg.message.content;
    }
    if (Array.isArray(msg.message?.content)) {
      return msg.message.content.map((c) => c.text || '').join('');
    }
    return '';
  }
}
