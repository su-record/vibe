// Insight Extraction Engine for self-evolution Phase 2
// Extracts actionable patterns from reflections and observations

import { MemoryStorage } from '../memory/MemoryStorage.js';
import { ReflectionStore, Reflection } from '../memory/ReflectionStore.js';
import { ObservationStore, Observation } from '../memory/ObservationStore.js';
import { InsightStore, InsightInput } from './InsightStore.js';

interface ExtractionResult {
  newInsights: string[];
  mergedInsights: string[];
  skippedCount: number;
  errorCount: number;
}

export class InsightExtractor {
  private reflectionStore: ReflectionStore;
  private observationStore: ObservationStore;
  private insightStore: InsightStore;

  constructor(storage: MemoryStorage) {
    this.reflectionStore = new ReflectionStore(storage);
    this.observationStore = new ObservationStore(storage);
    this.insightStore = new InsightStore(storage);
  }

  /**
   * Extract insights from recent reflections and observations
   * @param limit Max items to process (default 50)
   */
  public extractFromRecent(limit: number = 50): ExtractionResult {
    const result: ExtractionResult = { newInsights: [], mergedInsights: [], skippedCount: 0, errorCount: 0 };

    // Collect recent data
    const reflections = this.reflectionStore.getRecent(limit);
    const observations = this.observationStore.getRecent(limit);

    // Build frequency map from reflections
    const topicCounts = new Map<string, { count: number; evidenceIds: string[]; descriptions: string[] }>();

    for (const refl of reflections) {
      try {
        this.processReflectionTopics(refl, topicCounts);
      } catch {
        result.errorCount++;
      }
    }

    for (const obs of observations) {
      try {
        this.processObservationTopics(obs, topicCounts);
      } catch {
        result.errorCount++;
      }
    }

    // Extract insights from topics with 3+ occurrences
    for (const [topic, data] of topicCounts) {
      if (data.count < 3) {
        result.skippedCount++;
        continue;
      }

      // Check for duplicate
      const existingId = this.insightStore.findAndMergeDuplicate(topic, data.descriptions[0] || '');
      if (existingId) {
        result.mergedInsights.push(existingId);
        continue;
      }

      // Determine insight type
      const type = this.classifyTopic(topic, data.descriptions);
      const confidence = Math.min(1.0, data.count * 0.2 + data.evidenceIds.length * 0.1);

      const input: InsightInput = {
        type,
        title: topic,
        description: data.descriptions.slice(0, 3).join('; '),
        evidence: data.evidenceIds.slice(0, 10),
        confidence,
        tags: this.extractTags(topic, data.descriptions),
        generatedFrom: 'reflection',
      };

      const id = this.insightStore.save(input);
      result.newInsights.push(id);
    }

    return result;
  }

  private processReflectionTopics(
    refl: Reflection,
    topicCounts: Map<string, { count: number; evidenceIds: string[]; descriptions: string[] }>
  ): void {
    const allTexts = [...refl.insights, ...refl.decisions, ...refl.patterns];
    for (const text of allTexts) {
      if (!text || typeof text !== 'string') continue;
      const normalized = text.toLowerCase().trim();
      if (normalized.length < 5) continue;

      // Extract key topic (first 100 chars)
      const topic = normalized.slice(0, 100);
      const existing = topicCounts.get(topic) || { count: 0, evidenceIds: [], descriptions: [] };
      existing.count++;
      existing.evidenceIds.push(refl.id);
      existing.descriptions.push(text);
      topicCounts.set(topic, existing);
    }
  }

  private processObservationTopics(
    obs: Observation,
    topicCounts: Map<string, { count: number; evidenceIds: string[]; descriptions: string[] }>
  ): void {
    const texts = [obs.title, ...(obs.facts || []), ...(obs.concepts || [])];
    for (const text of texts) {
      if (!text || typeof text !== 'string') continue;
      const normalized = text.toLowerCase().trim();
      if (normalized.length < 5) continue;

      const topic = normalized.slice(0, 100);
      const existing = topicCounts.get(topic) || { count: 0, evidenceIds: [], descriptions: [] };
      existing.count++;
      existing.evidenceIds.push(String(obs.id));
      existing.descriptions.push(text);
      topicCounts.set(topic, existing);
    }
  }

  private classifyTopic(topic: string, descriptions: string[]): 'pattern' | 'anti_pattern' | 'preference' | 'skill_gap' | 'optimization' {
    const text = (topic + ' ' + descriptions.join(' ')).toLowerCase();
    if (text.includes('anti') || text.includes('bad') || text.includes('avoid') || text.includes('wrong') || text.includes('bug')) {
      return 'anti_pattern';
    }
    if (text.includes('gap') || text.includes('missing') || text.includes('need') || text.includes('lack')) {
      return 'skill_gap';
    }
    if (text.includes('slow') || text.includes('performance') || text.includes('optimize') || text.includes('fast')) {
      return 'optimization';
    }
    if (text.includes('prefer') || text.includes('always') || text.includes('like')) {
      return 'preference';
    }
    return 'pattern';
  }

  private extractTags(topic: string, descriptions: string[]): string[] {
    const tags = new Set<string>();
    const text = (topic + ' ' + descriptions.join(' ')).toLowerCase();

    const keywords = ['typescript', 'react', 'node', 'sql', 'api', 'auth', 'test', 'security', 'performance', 'css', 'database'];
    for (const kw of keywords) {
      if (text.includes(kw)) tags.add(kw);
    }
    return [...tags].slice(0, 5);
  }
}
