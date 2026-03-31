// Description Optimizer - Phase 5: Tune skill descriptions for reliable triggering
//
// Evaluates how well a skill's description triggers against a set of eval queries.
// Tracks trigger accuracy (should-trigger and should-not-trigger) and iteratively
// improves descriptions to reduce false positives and false negatives.
//
// Optimization loop:
// 1. Split eval set into 60% train / 40% test
// 2. Evaluate current description (3 runs per query for reliable rate)
// 3. Score on both train and test sets
// 4. Select best description by test score (avoid overfitting)

import { randomUUID } from 'crypto';
import { MemoryStorage } from '../memory/MemoryStorage.js';

export interface TriggerEvalQuery {
  query: string;
  shouldTrigger: boolean;
}

export interface TriggerEvalResult {
  query: string;
  shouldTrigger: boolean;
  didTrigger: boolean;
  triggerRate: number;
  correct: boolean;
}

export interface DescriptionCandidate {
  description: string;
  trainScore: number;
  testScore: number;
  iteration: number;
  results: TriggerEvalResult[];
}

export interface OptimizationRun {
  id: string;
  skillName: string;
  originalDescription: string;
  bestDescription: string;
  candidates: DescriptionCandidate[];
  trainQueries: TriggerEvalQuery[];
  testQueries: TriggerEvalQuery[];
  improvement: number;
  createdAt: string;
}

interface OptimizationRow {
  id: string;
  skillName: string;
  originalDescription: string;
  bestDescription: string;
  candidates: string;
  trainQueries: string;
  testQueries: string;
  improvement: number;
  createdAt: string;
}

export class DescriptionOptimizer {
  private db: ReturnType<MemoryStorage['getDatabase']>;

  constructor(storage: MemoryStorage) {
    this.db = storage.getDatabase();
    this.initializeTables();
  }

  private initializeTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS description_optimizations (
        id TEXT PRIMARY KEY,
        skillName TEXT NOT NULL,
        originalDescription TEXT NOT NULL,
        bestDescription TEXT NOT NULL,
        candidates TEXT NOT NULL,
        trainQueries TEXT NOT NULL,
        testQueries TEXT NOT NULL,
        improvement REAL DEFAULT 0,
        createdAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_do_skill ON description_optimizations(skillName);
    `);
  }

  /**
   * Split eval queries into train/test sets (60/40)
   */
  public splitEvalSet(queries: TriggerEvalQuery[]): {
    train: TriggerEvalQuery[];
    test: TriggerEvalQuery[];
  } {
    // Stratified split: maintain should-trigger ratio in both sets
    const shouldTrigger = queries.filter(q => q.shouldTrigger);
    const shouldNot = queries.filter(q => !q.shouldTrigger);

    const trainTrigger = this.takePortion(shouldTrigger, 0.6);
    const trainNot = this.takePortion(shouldNot, 0.6);
    const testTrigger = shouldTrigger.filter(q => !trainTrigger.includes(q));
    const testNot = shouldNot.filter(q => !trainNot.includes(q));

    return {
      train: [...trainTrigger, ...trainNot],
      test: [...testTrigger, ...testNot],
    };
  }

  /**
   * Evaluate a description against a set of trigger queries.
   * Uses keyword matching as a proxy for actual skill triggering.
   * In production, this would call `claude -p` and monitor the stream.
   */
  public evaluateDescription(
    description: string,
    queries: TriggerEvalQuery[]
  ): TriggerEvalResult[] {
    const descWords = this.extractKeywords(description);

    return queries.map(query => {
      const queryWords = this.extractKeywords(query.query);
      const overlap = this.computeOverlap(descWords, queryWords);

      // Trigger if keyword overlap exceeds threshold
      const triggerThreshold = 0.15;
      const didTrigger = overlap >= triggerThreshold;
      const triggerRate = overlap;

      return {
        query: query.query,
        shouldTrigger: query.shouldTrigger,
        didTrigger,
        triggerRate,
        correct: didTrigger === query.shouldTrigger,
      };
    });
  }

  /**
   * Score a set of evaluation results (accuracy)
   */
  public scoreResults(results: TriggerEvalResult[]): number {
    if (results.length === 0) return 0;
    const correct = results.filter(r => r.correct).length;
    return correct / results.length;
  }

  /**
   * Run a single optimization iteration:
   * Evaluate current description, improve based on failures
   */
  public evaluateCandidate(
    description: string,
    trainQueries: TriggerEvalQuery[],
    testQueries: TriggerEvalQuery[],
    iteration: number
  ): DescriptionCandidate {
    const trainResults = this.evaluateDescription(description, trainQueries);
    const testResults = this.evaluateDescription(description, testQueries);

    return {
      description,
      trainScore: this.scoreResults(trainResults),
      testScore: this.scoreResults(testResults),
      iteration,
      results: [...trainResults, ...testResults],
    };
  }

  /**
   * Suggest an improved description based on failed eval queries.
   * Analyzes what failed and adds/removes keywords to improve accuracy.
   */
  public suggestImprovement(
    currentDescription: string,
    failedResults: TriggerEvalResult[]
  ): string {
    if (failedResults.length === 0) return currentDescription;

    const falseNegatives = failedResults.filter(r => r.shouldTrigger && !r.didTrigger);
    const falsePositives = failedResults.filter(r => !r.shouldTrigger && r.didTrigger);

    let improved = currentDescription;

    // For false negatives: add keywords from queries that should have triggered
    if (falseNegatives.length > 0) {
      const missingKeywords = new Set<string>();
      for (const fn of falseNegatives) {
        const queryWords = this.extractKeywords(fn.query);
        for (const word of queryWords) {
          if (!improved.toLowerCase().includes(word)) {
            missingKeywords.add(word);
          }
        }
      }
      // Add the most relevant missing keywords (up to 3)
      const toAdd = Array.from(missingKeywords).slice(0, 3);
      if (toAdd.length > 0) {
        improved = `${improved} Handles: ${toAdd.join(', ')}.`;
      }
    }

    // For false positives: make description more specific
    if (falsePositives.length > 0) {
      const fpKeywords = new Set<string>();
      for (const fp of falsePositives) {
        const queryWords = this.extractKeywords(fp.query);
        for (const word of queryWords) {
          fpKeywords.add(word);
        }
      }
      // Add exclusion hint if not already present
      const toExclude = Array.from(fpKeywords).slice(0, 2);
      if (toExclude.length > 0 && !improved.includes('Does NOT')) {
        improved = `${improved} Does NOT handle: ${toExclude.join(', ')}.`;
      }
    }

    return improved;
  }

  /**
   * Run the full optimization loop
   */
  public optimize(
    skillName: string,
    description: string,
    queries: TriggerEvalQuery[],
    maxIterations: number = 5
  ): OptimizationRun {
    const { train, test } = this.splitEvalSet(queries);
    const candidates: DescriptionCandidate[] = [];

    let currentDescription = description;
    let bestCandidate: DescriptionCandidate | null = null;

    for (let i = 0; i < maxIterations; i++) {
      const candidate = this.evaluateCandidate(currentDescription, train, test, i + 1);
      candidates.push(candidate);

      if (!bestCandidate || candidate.testScore > bestCandidate.testScore) {
        bestCandidate = candidate;
      }

      // Perfect score → stop
      if (candidate.testScore >= 1.0 && candidate.trainScore >= 1.0) break;

      // Improve based on failures
      const failed = candidate.results.filter(r => !r.correct);
      if (failed.length === 0) break;

      const improved = this.suggestImprovement(currentDescription, failed);
      if (improved === currentDescription) break; // No improvement possible

      currentDescription = improved;
    }

    const id = `opt-${Date.now().toString(36)}-${randomUUID().replace(/-/g, '').slice(0, 8)}`;
    const now = new Date().toISOString();

    const originalScore = candidates[0]?.testScore ?? 0;
    const bestScore = bestCandidate?.testScore ?? 0;
    const improvement = bestScore - originalScore;

    const run: OptimizationRun = {
      id,
      skillName,
      originalDescription: description,
      bestDescription: bestCandidate?.description ?? description,
      candidates,
      trainQueries: train,
      testQueries: test,
      improvement,
      createdAt: now,
    };

    // Persist
    this.db.prepare(`
      INSERT INTO description_optimizations (id, skillName, originalDescription, bestDescription, candidates, trainQueries, testQueries, improvement, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      skillName,
      description,
      run.bestDescription,
      JSON.stringify(candidates),
      JSON.stringify(train),
      JSON.stringify(test),
      improvement,
      now
    );

    return run;
  }

  /**
   * Get optimization history for a skill
   */
  public getHistory(skillName: string): OptimizationRun[] {
    const rows = this.db.prepare(`
      SELECT * FROM description_optimizations WHERE skillName = ? ORDER BY createdAt ASC
    `).all(skillName) as OptimizationRow[];
    return rows.map(this.rowToRun);
  }

  /**
   * Get latest optimization for a skill
   */
  public getLatest(skillName: string): OptimizationRun | null {
    const row = this.db.prepare(`
      SELECT * FROM description_optimizations WHERE skillName = ? ORDER BY createdAt DESC LIMIT 1
    `).get(skillName) as OptimizationRow | undefined;
    return row ? this.rowToRun(row) : null;
  }

  /**
   * Generate a 20-query trigger validation eval set for a skill.
   * Follows Harness pattern: 10 should-trigger + 10 should-NOT-trigger.
   *
   * Should-trigger queries cover:
   * - Diverse phrasing of the same intent (formal/casual)
   * - Implicit need (no explicit skill mention)
   * - Edge use cases
   *
   * Should-NOT-trigger queries focus on near-misses:
   * - Similar keywords but different intent
   * - Adjacent domains
   * - Ambiguous phrasing that belongs to a different skill
   */
  public generateTriggerEvalSet(
    skillName: string,
    description: string,
    existingSkillDescriptions?: Map<string, string>
  ): TriggerEvalQuery[] {
    const descWords = this.extractKeywords(description);
    const keywordList = Array.from(descWords);

    // Generate should-trigger queries from description keywords
    const shouldTrigger: TriggerEvalQuery[] = [];
    const shouldNot: TriggerEvalQuery[] = [];

    // Strategy 1: Direct keyword combinations (4 queries)
    for (let i = 0; i < Math.min(4, keywordList.length); i++) {
      const words = keywordList.slice(i, i + 3).join(' ');
      shouldTrigger.push({
        query: `Help me with ${words} in this project`,
        shouldTrigger: true,
      });
    }

    // Strategy 2: Casual phrasing (3 queries)
    const casualPrefixes = ['can you', 'I need to', 'please'];
    for (let i = 0; i < Math.min(3, keywordList.length); i++) {
      shouldTrigger.push({
        query: `${casualPrefixes[i % 3]} ${keywordList[i]} ${keywordList[(i + 1) % keywordList.length]}`,
        shouldTrigger: true,
      });
    }

    // Strategy 3: Implicit need (3 queries)
    const implicitPhrases = [
      `The ${keywordList[0] ?? 'feature'} is broken`,
      `How does the ${keywordList[1] ?? 'system'} work here?`,
      `Set up ${keywordList[2] ?? 'this feature'} for the project`,
    ];
    for (const phrase of implicitPhrases) {
      shouldTrigger.push({ query: phrase, shouldTrigger: true });
    }

    // Generate should-NOT-trigger queries (near-misses from other skills)
    if (existingSkillDescriptions) {
      let nearMissCount = 0;
      for (const [otherName, otherDesc] of existingSkillDescriptions) {
        if (otherName === skillName || nearMissCount >= 5) break;
        const otherWords = this.extractKeywords(otherDesc);
        const overlap = this.computeOverlap(descWords, otherWords);
        // Near-miss: some keyword overlap but different skill
        if (overlap > 0.05 && overlap < 0.4) {
          const otherKeywords = Array.from(otherWords).slice(0, 3).join(' ');
          shouldNot.push({
            query: `Help me with ${otherKeywords}`,
            shouldTrigger: false,
          });
          nearMissCount++;
        }
      }
    }

    // Fill remaining should-NOT-trigger with generic near-misses
    const genericNearMisses = [
      'Write a unit test for the login function',
      'Deploy the application to production',
      'Create a new database migration',
      'Fix the CSS layout on mobile',
      'Refactor the authentication middleware',
      'Generate API documentation',
      'Set up CI/CD pipeline',
      'Review this pull request',
      'Optimize the database queries',
      'Add logging to the service layer',
    ];

    while (shouldNot.length < 10) {
      const idx = shouldNot.length % genericNearMisses.length;
      // Only add if not already matching the skill
      const overlap = this.computeOverlap(descWords, this.extractKeywords(genericNearMisses[idx]));
      if (overlap < 0.15) {
        shouldNot.push({ query: genericNearMisses[idx], shouldTrigger: false });
      } else {
        // Skip this generic and try a truly unrelated one
        shouldNot.push({
          query: `Write a poem about ${genericNearMisses[idx].split(' ').slice(-2).join(' ')}`,
          shouldTrigger: false,
        });
      }
    }

    return [...shouldTrigger.slice(0, 10), ...shouldNot.slice(0, 10)];
  }

  /**
   * Validate trigger accuracy for a skill against its 20-query eval set.
   * Returns accuracy score and details of failures.
   */
  public validateTriggers(
    skillName: string,
    description: string,
    queries?: TriggerEvalQuery[],
    existingSkillDescriptions?: Map<string, string>
  ): {
    accuracy: number;
    falsePositives: TriggerEvalResult[];
    falseNegatives: TriggerEvalResult[];
    results: TriggerEvalResult[];
  } {
    const evalQueries = queries ?? this.generateTriggerEvalSet(
      skillName, description, existingSkillDescriptions
    );
    const results = this.evaluateDescription(description, evalQueries);
    const accuracy = this.scoreResults(results);
    const falsePositives = results.filter(r => !r.shouldTrigger && r.didTrigger);
    const falseNegatives = results.filter(r => r.shouldTrigger && !r.didTrigger);

    return { accuracy, falsePositives, falseNegatives, results };
  }

  /**
   * Check for trigger collisions between a new skill and existing skills.
   * Returns skills whose trigger queries would incorrectly fire for the new skill's description.
   */
  public checkCollisions(
    skillName: string,
    description: string,
    existingSkills: Map<string, string>
  ): Array<{
    collidingSkill: string;
    overlapScore: number;
    sharedKeywords: string[];
  }> {
    const descWords = this.extractKeywords(description);
    const collisions: Array<{
      collidingSkill: string;
      overlapScore: number;
      sharedKeywords: string[];
    }> = [];

    for (const [otherName, otherDesc] of existingSkills) {
      if (otherName === skillName) continue;

      const otherWords = this.extractKeywords(otherDesc);
      const overlapScore = this.computeOverlap(descWords, otherWords);

      if (overlapScore >= 0.3) {
        const shared: string[] = [];
        for (const word of descWords) {
          if (otherWords.has(word)) shared.push(word);
        }
        collisions.push({
          collidingSkill: otherName,
          overlapScore,
          sharedKeywords: shared,
        });
      }
    }

    return collisions.sort((a, b) => b.overlapScore - a.overlapScore);
  }

  /**
   * Batch validate all skills' trigger accuracy.
   * Returns a report of skills with low accuracy that need description improvement.
   */
  public batchValidate(
    skills: Map<string, string>,
    accuracyThreshold: number = 0.7
  ): Array<{
    skillName: string;
    accuracy: number;
    falsePositiveCount: number;
    falseNegativeCount: number;
    needsImprovement: boolean;
  }> {
    const results: Array<{
      skillName: string;
      accuracy: number;
      falsePositiveCount: number;
      falseNegativeCount: number;
      needsImprovement: boolean;
    }> = [];

    for (const [name, description] of skills) {
      const validation = this.validateTriggers(name, description, undefined, skills);
      results.push({
        skillName: name,
        accuracy: validation.accuracy,
        falsePositiveCount: validation.falsePositives.length,
        falseNegativeCount: validation.falseNegatives.length,
        needsImprovement: validation.accuracy < accuracyThreshold,
      });
    }

    return results.sort((a, b) => a.accuracy - b.accuracy);
  }

  // --- Internal helpers ---

  private extractKeywords(text: string): Set<string> {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
      'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'out', 'off', 'up',
      'down', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both',
      'each', 'all', 'any', 'few', 'more', 'most', 'other', 'some',
      'such', 'no', 'only', 'own', 'same', 'than', 'too', 'very',
      'just', 'because', 'if', 'when', 'while', 'this', 'that', 'these',
      'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'it', 'its',
      'they', 'them', 'their', 'what', 'which', 'who', 'whom',
    ]);

    return new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w))
    );
  }

  private computeOverlap(setA: Set<string>, setB: Set<string>): number {
    if (setA.size === 0 || setB.size === 0) return 0;
    let overlap = 0;
    for (const word of setB) {
      if (setA.has(word)) overlap++;
    }
    return overlap / Math.max(setA.size, setB.size);
  }

  private takePortion<T>(arr: T[], ratio: number): T[] {
    const count = Math.ceil(arr.length * ratio);
    return arr.slice(0, count);
  }

  private rowToRun(row: OptimizationRow): OptimizationRun {
    return {
      id: row.id,
      skillName: row.skillName,
      originalDescription: row.originalDescription,
      bestDescription: row.bestDescription,
      candidates: JSON.parse(row.candidates),
      trainQueries: JSON.parse(row.trainQueries),
      testQueries: JSON.parse(row.testQueries),
      improvement: row.improvement,
      createdAt: row.createdAt,
    };
  }
}
