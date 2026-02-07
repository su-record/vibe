/**
 * GitOpsHandler - Safe git operations via spawn args array
 * Never uses shell execution (security: no command injection)
 */

import { spawn } from 'node:child_process';
import { InterfaceLogger } from '../../interface/types.js';

const GIT_TIMEOUT_MS = 30_000;

export class GitOpsHandler {
  private logger: InterfaceLogger;

  constructor(logger: InterfaceLogger) {
    this.logger = logger;
  }

  /** Execute git commit */
  async commit(cwd: string, message: string): Promise<string> {
    await this.runGit(cwd, ['add', '-A']);
    const result = await this.runGit(cwd, ['commit', '-m', message]);
    return result;
  }

  /** Execute git push */
  async push(cwd: string): Promise<string> {
    return this.runGit(cwd, ['push']);
  }

  /** Create PR via gh CLI */
  async createPR(
    cwd: string,
    title: string,
    body: string,
  ): Promise<string> {
    return this.runCommand('gh', ['pr', 'create', '--title', title, '--body', body], cwd);
  }

  /** Get git status summary */
  async status(cwd: string): Promise<string> {
    return this.runGit(cwd, ['status', '--short']);
  }

  /** Get git log (recent commits) */
  async log(cwd: string, maxCount: number = 5): Promise<string> {
    return this.runGit(cwd, ['log', `--max-count=${maxCount}`, '--oneline']);
  }

  /** Run git command safely */
  private runGit(cwd: string, args: string[]): Promise<string> {
    return this.runCommand('git', args, cwd);
  }

  /** Run a command with args array (no shell) */
  private runCommand(command: string, args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.logger('debug', `Executing: ${command} ${args.join(' ')}`, { cwd });

      const child = spawn(command, args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        timeout: GIT_TIMEOUT_MS,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
      child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`${command} failed (code ${code}): ${stderr.trim()}`));
        }
      });

      child.on('error', (err) => {
        reject(new Error(`Failed to spawn ${command}: ${err.message}`));
      });
    });
  }
}
