/**
 * UI/UX Design Intelligence — BM25 Search Engine
 *
 * Pure TypeScript BM25 implementation with no external dependencies.
 * - Algorithm: BM25 with k1=1.5, b=0.75
 * - Tokenization: NFKC normalization → lowercase → regex match → filter → stopword removal
 * - Deterministic scoring: sort by score desc, then by index asc on tie
 */
import type { Bm25ScoreItem } from './types.js';
export declare class Bm25Engine {
    private readonly k1;
    private readonly b;
    private documents;
    private tokenizedDocs;
    private avgdl;
    private idf;
    private docFreq;
    private termFreqs;
    constructor(k1?: number, b?: number);
    /**
     * Tokenize text with NFKC normalization, lowercase, regex match, filter, stopword removal.
     */
    tokenize(text: string): string[];
    /**
     * Fit documents: pre-compute IDF, avgdl, term frequencies.
     */
    fit(documents: string[]): void;
    /**
     * Calculate average document length in tokens.
     */
    private calculateAvgDocLength;
    /**
     * Calculate document frequency for each term.
     */
    private calculateDocumentFrequency;
    /**
     * Pre-compute IDF for each term.
     * IDF = log((N - df + 0.5) / (df + 0.5) + 1)
     */
    private calculateIdf;
    /**
     * Calculate term frequencies per document.
     */
    private calculateTermFrequencies;
    /**
     * Score a query against fitted documents.
     * BM25 formula: score += idf(qi) * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLen / avgdl)))
     */
    score(query: string): Bm25ScoreItem[];
    /**
     * Calculate BM25 scores for all documents.
     */
    private calculateScores;
    /**
     * Calculate BM25 score for a single document.
     */
    private calculateDocumentScore;
    /**
     * Calculate BM25 score for a single term in a document.
     */
    private calculateTermScore;
    /**
     * Filter zero scores and sort deterministically: score desc, then index asc.
     */
    private sortAndFilterScores;
}
//# sourceMappingURL=Bm25Engine.d.ts.map