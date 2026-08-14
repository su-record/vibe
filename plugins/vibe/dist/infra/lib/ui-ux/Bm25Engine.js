/**
 * UI/UX Design Intelligence — BM25 Search Engine
 *
 * Pure TypeScript BM25 implementation with no external dependencies.
 * - Algorithm: BM25 with k1=1.5, b=0.75
 * - Tokenization: NFKC normalization → lowercase → regex match → filter → stopword removal
 * - Deterministic scoring: sort by score desc, then by index asc on tie
 */
import { STOPWORDS, BM25_K1, BM25_B, MIN_TOKEN_LENGTH } from './constants.js';
export class Bm25Engine {
    k1;
    b;
    documents = [];
    tokenizedDocs = [];
    avgdl = 0;
    idf = new Map();
    docFreq = new Map();
    termFreqs = [];
    constructor(k1 = BM25_K1, b = BM25_B) {
        this.k1 = k1;
        this.b = b;
    }
    /**
     * Tokenize text with NFKC normalization, lowercase, regex match, filter, stopword removal.
     */
    tokenize(text) {
        const normalized = text.normalize('NFKC').toLowerCase();
        const tokens = normalized.match(/[a-z0-9가-힣]+/g) || [];
        return tokens.filter((token) => token.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(token));
    }
    /**
     * Fit documents: pre-compute IDF, avgdl, term frequencies.
     */
    fit(documents) {
        if (documents.length === 0) {
            this.avgdl = 0;
            this.documents = [];
            this.tokenizedDocs = [];
            this.idf.clear();
            this.docFreq.clear();
            this.termFreqs = [];
            return;
        }
        this.documents = documents;
        this.tokenizedDocs = documents.map((doc) => this.tokenize(doc));
        this.calculateAvgDocLength();
        this.calculateDocumentFrequency();
        this.calculateIdf();
        this.calculateTermFrequencies();
    }
    /**
     * Calculate average document length in tokens.
     */
    calculateAvgDocLength() {
        const totalLength = this.tokenizedDocs.reduce((sum, tokens) => sum + tokens.length, 0);
        this.avgdl = totalLength / this.tokenizedDocs.length;
    }
    /**
     * Calculate document frequency for each term.
     */
    calculateDocumentFrequency() {
        this.docFreq.clear();
        for (const tokens of this.tokenizedDocs) {
            const uniqueTokens = new Set(tokens);
            for (const token of uniqueTokens) {
                this.docFreq.set(token, (this.docFreq.get(token) || 0) + 1);
            }
        }
    }
    /**
     * Pre-compute IDF for each term.
     * IDF = log((N - df + 0.5) / (df + 0.5) + 1)
     */
    calculateIdf() {
        this.idf.clear();
        const N = this.documents.length;
        for (const [term, df] of this.docFreq) {
            const idfValue = Math.log((N - df + 0.5) / (df + 0.5) + 1);
            this.idf.set(term, idfValue);
        }
    }
    /**
     * Calculate term frequencies per document.
     */
    calculateTermFrequencies() {
        this.termFreqs = this.tokenizedDocs.map((tokens) => {
            const freqMap = new Map();
            for (const token of tokens) {
                freqMap.set(token, (freqMap.get(token) || 0) + 1);
            }
            return freqMap;
        });
    }
    /**
     * Score a query against fitted documents.
     * BM25 formula: score += idf(qi) * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLen / avgdl)))
     */
    score(query) {
        if (this.documents.length === 0) {
            return [];
        }
        const queryTokens = this.tokenize(query);
        if (queryTokens.length === 0) {
            return [];
        }
        const scores = this.calculateScores(queryTokens);
        return this.sortAndFilterScores(scores);
    }
    /**
     * Calculate BM25 scores for all documents.
     */
    calculateScores(queryTokens) {
        return this.documents.map((_, docIndex) => {
            const score = this.calculateDocumentScore(queryTokens, docIndex);
            return { index: docIndex, score };
        });
    }
    /**
     * Calculate BM25 score for a single document.
     */
    calculateDocumentScore(queryTokens, docIndex) {
        const docLen = this.tokenizedDocs[docIndex].length;
        const termFreq = this.termFreqs[docIndex];
        let score = 0;
        for (const token of queryTokens) {
            const tf = termFreq.get(token) || 0;
            const idfValue = this.idf.get(token) || 0;
            score += this.calculateTermScore(tf, idfValue, docLen);
        }
        return score;
    }
    /**
     * Calculate BM25 score for a single term in a document.
     */
    calculateTermScore(tf, idfValue, docLen) {
        const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / this.avgdl));
        return (idfValue * (tf * (this.k1 + 1))) / denominator;
    }
    /**
     * Filter zero scores and sort deterministically: score desc, then index asc.
     */
    sortAndFilterScores(scores) {
        return scores
            .filter((item) => item.score > 0)
            .sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return a.index - b.index;
        });
    }
}
//# sourceMappingURL=Bm25Engine.js.map