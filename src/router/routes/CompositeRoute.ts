/**
 * CompositeRoute - Multi-step task execution via DAG
 * Decomposes complex requests into executable DAG, runs TaskExecutor
 * Also handles natural language history queries
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { InterfaceLogger } from '../../interface/types.js';
import { ClassifiedIntent, RouteContext, RouteResult, SmartRouterLike } from '../types.js';
import { BaseRoute } from './BaseRoute.js';
import { TaskPlanner, DAGNode } from '../planner/TaskPlanner.js';
import { TaskExecutor } from '../planner/TaskExecutor.js';
import { NotificationManager } from '../notifications/NotificationManager.js';

const execFileAsync = promisify(execFile);

export class CompositeRoute extends BaseRoute {
  readonly name = 'composite';
  private planner: TaskPlanner;
  private smartRouter: SmartRouterLike;
  private notificationMgr: NotificationManager | null;

  constructor(
    logger: InterfaceLogger,
    smartRouter: SmartRouterLike,
    notificationMgr?: NotificationManager,
  ) {
    super(logger);
    this.smartRouter = smartRouter;
    this.planner = new TaskPlanner(logger, smartRouter);
    this.notificationMgr = notificationMgr ?? null;
  }

  canHandle(intent: ClassifiedIntent): boolean {
    return intent.category === 'composite';
  }

  protected async executeInternal(context: RouteContext): Promise<RouteResult> {
    const query = context.intent.rawQuery;

    if (this.isHistoryQuery(query)) {
      return this.handleHistory(query);
    }

    return this.handleComposite(query, context);
  }

  private async handleComposite(query: string, context: RouteContext): Promise<RouteResult> {
    // Step 1: Plan DAG
    const dag = await this.planner.plan(query);
    const preview = this.formatPreview(dag.nodes);
    this.logger('info', `복합 DAG 생성: ${dag.nodes.length}개 노드`);

    // Step 2: Send preview
    await context.services.sendTelegram(context.chatId, preview);

    // Step 3: Execute DAG
    const executor = new TaskExecutor(
      this.logger,
      this.notificationMgr ?? undefined,
      context.chatId,
    );
    const result = await executor.execute(dag, (node, ctx) =>
      this.executeNode(node, ctx),
    );

    // Step 4: Format and return result
    return {
      success: result.failedNodes === 0,
      data: TaskExecutor.formatResult(result),
      error: result.failedNodes > 0
        ? `${result.failedNodes}개 노드 실패`
        : undefined,
    };
  }

  private async handleHistory(query: string): Promise<RouteResult> {
    const period = this.extractPeriod(query);
    const [commits, summary] = await Promise.all([
      this.getRecentCommits(period),
      this.generateHistorySummary(query),
    ]);

    const parts: string[] = [];
    if (commits.length > 0) {
      parts.push(`📝 커밋 기록:\n${commits.map((c) => `  • ${c}`).join('\n')}`);
    }
    if (summary) {
      parts.push(`📋 요약:\n${summary}`);
    }

    return {
      success: true,
      data: parts.length > 0 ? parts.join('\n\n') : '기록된 활동이 없습니다.',
    };
  }

  /** Execute a single DAG node by routing to appropriate service */
  private async executeNode(
    node: DAGNode,
    context: Map<string, string>,
  ): Promise<string> {
    // Inject previous step results into params
    const prevResults = node.dependsOn
      .map((dep) => context.get(dep))
      .filter(Boolean)
      .join('\n');

    const prompt = prevResults
      ? `${node.action}\n\n이전 단계 결과:\n${prevResults}`
      : node.action;

    const result = await this.smartRouter.route({
      type: 'general',
      systemPrompt: `${node.type} 작업을 수행하세요. 결과만 반환하세요.`,
      prompt,
    });

    if (!result.success) {
      throw new Error(`노드 ${node.id} 실행 실패`);
    }
    return result.content;
  }

  private isHistoryQuery(query: string): boolean {
    return /어제|오늘|뭐\s*했|히스토리|history|기록/.test(query);
  }

  private extractPeriod(query: string): string {
    if (/어제/.test(query)) return 'yesterday';
    if (/이번\s*주/.test(query)) return 'week';
    return 'today';
  }

  private async getRecentCommits(period: string): Promise<string[]> {
    const since = period === 'yesterday' ? '2 days ago' : period === 'week' ? '1 week ago' : 'midnight';
    try {
      const { stdout } = await execFileAsync('git', [
        'log', `--since=${since}`, '--format=%s (%an, %ar)', '--no-merges', '-20',
      ], { timeout: 10_000 });
      return stdout.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  private async generateHistorySummary(query: string): Promise<string> {
    const result = await this.smartRouter.route({
      type: 'reasoning',
      systemPrompt: '업무 히스토리를 자연어로 요약하세요. 한국어로 3-5줄로 작성하세요.',
      prompt: query,
    });
    return result.success ? result.content : '';
  }

  private formatPreview(nodes: DAGNode[]): string {
    const steps = nodes.map((n, i) =>
      `${i + 1}. [${n.type}] ${n.action}${n.dependsOn.length > 0 ? ` (← ${n.dependsOn.join(', ')})` : ''}`,
    ).join('\n');
    return `🔄 복합 작업을 실행합니다:\n\n${steps}`;
  }
}
