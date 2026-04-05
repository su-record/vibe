/**
 * vibe stats — Session statistics and quality trends from telemetry data
 *
 * Subcommands:
 *   vibe stats           Session summary (all time)
 *   vibe stats --week    Last 7 days with day-by-day breakdown
 *   vibe stats --quality Quality trends (reviews, errors, decisions)
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import type { SkillEvent, SkillSummary } from '../../infra/lib/telemetry/SkillTelemetry.js';
import type { VibeSpan } from '../../infra/lib/telemetry/VibeSpan.js';
import type { DecisionRecord } from '../../infra/lib/DecisionTracer.js';

// ============================================================================
// Constants
// ============================================================================

const ANALYTICS_DIR = path.join(os.homedir(), '.vibe', 'analytics');
const SKILL_USAGE_PATH = path.join(ANALYTICS_DIR, 'skill-usage.jsonl');
const SPANS_PATH = path.join(ANALYTICS_DIR, 'spans.jsonl');
const DECISIONS_PATH = path.join(ANALYTICS_DIR, 'decisions.jsonl');
const DIVIDER = chalk.dim('━'.repeat(40));
const TOP_SKILLS_COUNT = 5;

// ============================================================================
// JSONL Readers
// ============================================================================

function readJsonlFile<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return [];
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content
      .split('\n')
      .filter(line => line.trim().length > 0)
      .flatMap(line => {
        try {
          return [JSON.parse(line) as T];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

function filterByDays<T extends { ts: string }>(items: T[], days: number): T[] {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  return items.filter(item => item.ts >= cutoff);
}

// ============================================================================
// Aggregation helpers
// ============================================================================

function aggregateSkillSummaries(events: SkillEvent[]): SkillSummary[] {
  const map = new Map<string, {
    count: number;
    successCount: number;
    errorCount: number;
    totalDuration: number;
    durationCount: number;
    lastUsed: string;
  }>();

  for (const event of events) {
    if (event.event_type !== 'skill_run') continue;
    const existing = map.get(event.skill) ?? {
      count: 0, successCount: 0, errorCount: 0,
      totalDuration: 0, durationCount: 0, lastUsed: event.ts,
    };
    existing.count++;
    if (event.outcome === 'success') existing.successCount++;
    if (event.outcome === 'error') existing.errorCount++;
    if (event.duration_s !== null) {
      existing.totalDuration += event.duration_s;
      existing.durationCount++;
    }
    if (event.ts > existing.lastUsed) existing.lastUsed = event.ts;
    map.set(event.skill, existing);
  }

  return [...map.entries()]
    .map(([skill, data]) => ({
      skill,
      count: data.count,
      successCount: data.successCount,
      errorCount: data.errorCount,
      avgDurationS: data.durationCount > 0
        ? Math.round((data.totalDuration / data.durationCount) * 10) / 10
        : null,
      lastUsed: data.lastUsed,
    }))
    .sort((a, b) => b.count - a.count);
}

function computeOverallSuccessRate(events: SkillEvent[]): number | null {
  const runs = events.filter(e => e.event_type === 'skill_run');
  if (runs.length === 0) return null;
  const successes = runs.filter(e => e.outcome === 'success').length;
  return Math.round((successes / runs.length) * 100);
}

function computeAvgDuration(events: SkillEvent[]): number | null {
  const withDuration = events
    .filter(e => e.event_type === 'skill_run' && e.duration_s !== null)
    .map(e => e.duration_s as number);
  if (withDuration.length === 0) return null;
  const avg = withDuration.reduce((sum, d) => sum + d, 0) / withDuration.length;
  return Math.round(avg * 10) / 10;
}

function estimateSessionCount(events: SkillEvent[]): number {
  if (events.length === 0) return 0;
  const dates = new Set(events.map(e => e.ts.slice(0, 10)));
  return dates.size;
}

// ============================================================================
// Formatters
// ============================================================================

function formatSuccessRate(successCount: number, total: number): string {
  if (total === 0) return chalk.dim('n/a');
  const rate = Math.round((successCount / total) * 100);
  const color = rate >= 90 ? chalk.green : rate >= 70 ? chalk.yellow : chalk.red;
  return color(`${rate}% ✓`);
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str : str + ' '.repeat(len - str.length);
}

function printHeader(title: string): void {
  console.log('');
  console.log(chalk.bold(`📊 ${title}`));
  console.log(DIVIDER);
}

// ============================================================================
// Default stats (all-time summary)
// ============================================================================

function printSummarySection(events: SkillEvent[], decisions: DecisionRecord[]): void {
  const totalRuns = events.filter(e => e.event_type === 'skill_run').length;
  const successRate = computeOverallSuccessRate(events);
  const avgDuration = computeAvgDuration(events);
  const sessions = estimateSessionCount(events);

  const runsLabel = successRate !== null
    ? `${totalRuns} (${successRate}% success)`
    : `${totalRuns}`;

  console.log(`${chalk.white(padRight('Sessions:', 16))} ${chalk.cyan(sessions)}`);
  console.log(`${chalk.white(padRight('Skill Runs:', 16))} ${chalk.cyan(runsLabel)}`);

  if (avgDuration !== null) {
    console.log(`${chalk.white(padRight('Avg Duration:', 16))} ${chalk.cyan(`${avgDuration}s`)}`);
  }

  console.log(`${chalk.white(padRight('Total Decisions:', 16))} ${chalk.cyan(decisions.length)}`);
}

function printTopSkills(summaries: SkillSummary[]): void {
  if (summaries.length === 0) {
    console.log(chalk.dim('  No skill data yet.'));
    return;
  }

  console.log('');
  console.log(chalk.bold('Top Skills:'));
  const top = summaries.slice(0, TOP_SKILLS_COUNT);
  top.forEach((s, i) => {
    const rank = chalk.dim(`  ${i + 1}.`);
    const name = chalk.white(padRight(s.skill, 18));
    const runs = chalk.cyan(`${s.count} runs`);
    const rate = formatSuccessRate(s.successCount, s.count);
    console.log(`${rank} ${name} ${runs}  (${rate})`);
  });
}

export function statsDefault(): void {
  const events = readJsonlFile<SkillEvent>(SKILL_USAGE_PATH);
  const decisions = readJsonlFile<DecisionRecord>(DECISIONS_PATH);
  const summaries = aggregateSkillSummaries(events);

  printHeader('Vibe Stats');
  printSummarySection(events, decisions);
  printTopSkills(summaries);
  console.log('');
}

// ============================================================================
// --week: Last 7 days with day-by-day breakdown
// ============================================================================

function printWeeklyBreakdown(events: SkillEvent[]): void {
  console.log('');
  console.log(chalk.bold('Day-by-Day Breakdown:'));

  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);
    const dayEvents = events.filter(
      e => e.event_type === 'skill_run' && e.ts.startsWith(dateStr),
    );
    const successCount = dayEvents.filter(e => e.outcome === 'success').length;
    const label = i === 0 ? chalk.cyan('today') : chalk.dim(dateStr);
    const count = chalk.white(`${dayEvents.length} runs`);
    const rate = dayEvents.length > 0
      ? `  (${formatSuccessRate(successCount, dayEvents.length)})`
      : '';
    console.log(`  ${label}  ${count}${rate}`);
  }
}

export function statsWeek(): void {
  const allEvents = readJsonlFile<SkillEvent>(SKILL_USAGE_PATH);
  const allDecisions = readJsonlFile<DecisionRecord>(DECISIONS_PATH);
  const events = filterByDays(allEvents, 7);
  const decisions = filterByDays(allDecisions, 7);
  const summaries = aggregateSkillSummaries(events);

  printHeader('Vibe Stats — Last 7 Days');
  printSummarySection(events, decisions);
  printTopSkills(summaries);
  printWeeklyBreakdown(events);
  console.log('');
}

// ============================================================================
// --quality: Quality trends
// ============================================================================

function printReviewStats(spans: VibeSpan[]): void {
  const reviewSpans = spans.filter(s => s.type === 'review');
  const p1Spans = reviewSpans.filter(
    s => s.attributes['p1_count'] !== undefined && Number(s.attributes['p1_count']) > 0,
  );

  console.log(chalk.bold('Review Quality:'));
  console.log(`  ${chalk.white(padRight('Review spans:', 20))} ${chalk.cyan(reviewSpans.length)}`);
  console.log(`  ${chalk.white(padRight('With P1 issues:', 20))} ${chalk.red(p1Spans.length)}`);

  const errorSpans = spans.filter(s => s.status === 'error');
  console.log(`  ${chalk.white(padRight('Error spans:', 20))} ${chalk.yellow(errorSpans.length)}`);
}

function printErrorTypes(spans: VibeSpan[]): void {
  const errorSpans = spans.filter(s => s.status === 'error');
  if (errorSpans.length === 0) return;

  const errorMap = new Map<string, number>();
  for (const span of errorSpans) {
    const key = `${span.type}/${span.name}`;
    errorMap.set(key, (errorMap.get(key) ?? 0) + 1);
  }

  console.log('');
  console.log(chalk.bold('Most Common Errors:'));
  [...errorMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([name, count]) => {
      console.log(`  ${chalk.red(padRight(name, 30))} ${chalk.white(count)}x`);
    });
}

function printDecisionQuality(decisions: DecisionRecord[]): void {
  console.log('');
  console.log(chalk.bold('Decision Success Rate by Category:'));

  if (decisions.length === 0) {
    console.log(chalk.dim('  No decision data yet.'));
    return;
  }

  const categoryMap = new Map<string, { total: number; success: number; withOutcome: number }>();
  for (const d of decisions) {
    const cat = categoryMap.get(d.category) ?? { total: 0, success: 0, withOutcome: 0 };
    cat.total++;
    if (d.outcome !== undefined) {
      cat.withOutcome++;
      if (d.outcome.success) cat.success++;
    }
    categoryMap.set(d.category, cat);
  }

  for (const [category, data] of [...categoryMap.entries()].sort((a, b) => b[1].total - a[1].total)) {
    const rate = data.withOutcome > 0
      ? formatSuccessRate(data.success, data.withOutcome)
      : chalk.dim('no outcome');
    console.log(`  ${chalk.white(padRight(category, 20))} ${chalk.cyan(`${data.total} decisions`)}  ${rate}`);
  }
}

export function statsQuality(): void {
  const spans = readJsonlFile<VibeSpan>(SPANS_PATH);
  const decisions = readJsonlFile<DecisionRecord>(DECISIONS_PATH);

  printHeader('Vibe Stats — Quality Trends');
  printReviewStats(spans);
  printErrorTypes(spans);
  printDecisionQuality(decisions);
  console.log('');
}

// ============================================================================
// Help
// ============================================================================

export function statsHelp(): void {
  console.log(`
Stats Commands:
  vibe stats              All-time session summary
  vibe stats --week       Last 7 days with daily breakdown
  vibe stats --quality    Quality trends (reviews, errors, decisions)
  vibe stats --help       Show this help
  `);
}
