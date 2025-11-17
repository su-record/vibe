// Context compression utility (v1.3)
// Intelligently compress context when approaching token limits
export class ContextCompressor {
    static MAX_CHUNK_SIZE = 500; // characters
    static DEFAULT_TARGET_TOKENS = 4000;
    static TOKENS_PER_CHAR_ESTIMATE = 0.25;
    static MAX_SCORE = 100;
    static MIN_SCORE = 0;
    static CODE_KEYWORDS = [
        'function', 'class', 'const', 'let', 'var', 'import', 'export',
        'def', 'async', 'await', 'return', 'if', 'for', 'while'
    ];
    static IMPORTANT_KEYWORDS = [
        'error', 'bug', 'fix', 'issue', 'problem', 'solution',
        '에러', '버그', '수정', '문제', '해결', 'TODO', 'FIXME'
    ];
    /**
     * Compress context by selecting most important chunks
     * @param context - Text content to compress
     * @param targetTokens - Target token count (default: 4000)
     * @returns Compression result with statistics
     */
    static compress(context, targetTokens = ContextCompressor.DEFAULT_TARGET_TOKENS) {
        // Handle empty or very short context
        if (!context || context.trim().length === 0) {
            return {
                compressed: '',
                originalSize: 0,
                compressedSize: 0,
                compressionRatio: 0,
                removedSections: [],
                retainedSections: []
            };
        }
        const chunks = this.splitIntoChunks(context);
        const scoredChunks = chunks.map(chunk => this.scoreChunk(chunk));
        // If content is already smaller than target, return as-is
        // Only skip compression if content is very small (use 1.2x instead of 4x)
        // This ensures compression activates more aggressively
        if (context.length <= targetTokens * 1.2) {
            return {
                compressed: context,
                originalSize: context.length,
                compressedSize: context.length,
                compressionRatio: 1,
                removedSections: [],
                retainedSections: scoredChunks.map(s => s.type),
                retentionStats: {
                    codeRetentionPercent: 100,
                    answerRetentionPercent: 100,
                    questionRetentionPercent: 100
                }
            };
        }
        // Sort by score (highest first)
        scoredChunks.sort((a, b) => b.score - a.score);
        // Select chunks until target size
        // TOKENS_PER_CHAR_ESTIMATE = 0.25 means 1 char ≈ 0.25 tokens, so 4 chars ≈ 1 token
        // Reserve space for headers and formatting (5% overhead, min 50 chars, max 300 chars)
        const HEADER_OVERHEAD = Math.max(50, Math.min(300, targetTokens * 4 * 0.05));
        const targetChars = (targetTokens * 4) - HEADER_OVERHEAD;
        const selected = [];
        const removed = [];
        let currentSize = 0;
        for (const chunk of scoredChunks) {
            if (currentSize + chunk.text.length <= targetChars) {
                selected.push(chunk);
                currentSize += chunk.text.length;
            }
            else {
                removed.push(this.summarizeChunk(chunk));
            }
        }
        // Reconstruct compressed context
        const compressed = this.reconstructContext(selected, removed);
        // Calculate retention statistics
        const retentionStats = this.calculateRetentionStats(scoredChunks, selected);
        return {
            compressed,
            originalSize: context.length,
            compressedSize: compressed.length,
            compressionRatio: compressed.length / context.length,
            removedSections: removed,
            retainedSections: selected.map(s => s.type),
            retentionStats
        };
    }
    /**
     * Calculate retention percentages by type
     */
    static calculateRetentionStats(allChunks, selectedChunks) {
        const countByType = (chunks, type) => {
            return chunks.filter(c => c.type === type).length;
        };
        const totalCode = countByType(allChunks, 'code');
        const totalAnswer = countByType(allChunks, 'answer');
        const totalQuestion = countByType(allChunks, 'question');
        const retainedCode = countByType(selectedChunks, 'code');
        const retainedAnswer = countByType(selectedChunks, 'answer');
        const retainedQuestion = countByType(selectedChunks, 'question');
        return {
            codeRetentionPercent: totalCode > 0 ? Math.round((retainedCode / totalCode) * 100) : 0,
            answerRetentionPercent: totalAnswer > 0 ? Math.round((retainedAnswer / totalAnswer) * 100) : 0,
            questionRetentionPercent: totalQuestion > 0 ? Math.round((retainedQuestion / totalQuestion) * 100) : 0
        };
    }
    /**
     * Split context into manageable chunks
     */
    static splitIntoChunks(context) {
        const chunks = [];
        const lines = context.split('\n');
        let currentChunk = '';
        for (const line of lines) {
            if (currentChunk.length + line.length > this.MAX_CHUNK_SIZE) {
                if (currentChunk.trim()) {
                    chunks.push(currentChunk.trim());
                }
                currentChunk = line;
            }
            else {
                currentChunk += '\n' + line;
            }
        }
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }
        return chunks;
    }
    /**
     * Score chunk importance (0-100)
     * @param text - Text chunk to score
     * @returns Scored chunk with type and keywords
     */
    static scoreChunk(text) {
        const lowerText = text.toLowerCase();
        const type = this.detectChunkType(lowerText, text);
        const keywords = this.extractKeywords(lowerText);
        const baseScore = this.calculateBaseScore(text, lowerText, type);
        const finalScore = Math.max(ContextCompressor.MIN_SCORE, Math.min(ContextCompressor.MAX_SCORE, baseScore));
        return { text, score: finalScore, type, keywords };
    }
    /**
     * Detect chunk type based on content
     */
    static detectChunkType(lowerText, text) {
        if (text.includes('```'))
            return 'code';
        if (lowerText.match(/^(answer|solution|결과|답변):/i))
            return 'answer';
        if (lowerText.match(/^(timestamp|date|author|file):/i))
            return 'metadata';
        if (lowerText.includes('?'))
            return 'question';
        if (this.CODE_KEYWORDS.some(kw => lowerText.includes(kw)))
            return 'code';
        return 'explanation';
    }
    /**
     * Extract important keywords from text
     */
    static extractKeywords(lowerText) {
        const keywords = [];
        for (const keyword of this.IMPORTANT_KEYWORDS) {
            if (lowerText.includes(keyword.toLowerCase())) {
                keywords.push(keyword);
            }
        }
        return keywords;
    }
    /**
     * Calculate base score for chunk
     */
    static calculateBaseScore(text, lowerText, type) {
        let score = 0;
        // Type-based scoring
        score += this.getTypeScore(type, lowerText);
        // Keyword bonus
        score += this.getKeywordScore(lowerText);
        // Structure bonuses
        score += this.getStructureScore(text);
        return score;
    }
    /**
     * Get score based on chunk type
     */
    static getTypeScore(type, lowerText) {
        const typeScores = {
            code: 30,
            answer: 35,
            question: 25,
            explanation: 0,
            metadata: -20
        };
        return typeScores[type];
    }
    /**
     * Get score for important keywords
     */
    static getKeywordScore(lowerText) {
        let score = 0;
        for (const keyword of this.IMPORTANT_KEYWORDS) {
            if (lowerText.includes(keyword.toLowerCase())) {
                score += 15;
            }
        }
        return score;
    }
    /**
     * Get score based on text structure
     */
    static getStructureScore(text) {
        let score = 0;
        // Penalize very long chunks
        if (text.length > 1000)
            score -= 10;
        // Boost short, concise chunks
        if (text.length < 200 && text.split('\n').length <= 5)
            score += 10;
        // Boost structured content (lists)
        if (text.match(/^[\d\-\*•]/m))
            score += 15;
        // Boost code blocks
        if (text.includes('```'))
            score += 20;
        return score;
    }
    /**
     * Summarize removed chunk (one-liner)
     */
    static summarizeChunk(chunk) {
        const firstLine = chunk.text.split('\n')[0].trim();
        const summary = firstLine.length > 80
            ? firstLine.substring(0, 77) + '...'
            : firstLine;
        return `[${chunk.type}] ${summary}`;
    }
    /**
     * Reconstruct compressed context
     */
    static reconstructContext(selected, removed) {
        // Group by type for better organization
        const byType = {
            code: [],
            answer: [],
            question: [],
            explanation: [],
            metadata: []
        };
        selected.forEach(chunk => {
            byType[chunk.type].push(chunk);
        });
        const sections = [];
        // Add header
        sections.push('[Compressed Context - High Priority Information]\n');
        // Add answers first (most important)
        if (byType.answer.length > 0) {
            sections.push('## Key Answers & Solutions');
            sections.push(byType.answer.map(c => c.text).join('\n\n'));
            sections.push('');
        }
        // Add code blocks
        if (byType.code.length > 0) {
            sections.push('## Code Snippets');
            sections.push(byType.code.map(c => c.text).join('\n\n'));
            sections.push('');
        }
        // Add questions
        if (byType.question.length > 0) {
            sections.push('## Questions');
            sections.push(byType.question.map(c => c.text).join('\n\n'));
            sections.push('');
        }
        // Add explanations
        if (byType.explanation.length > 0) {
            sections.push('## Context');
            sections.push(byType.explanation.map(c => c.text).join('\n\n'));
            sections.push('');
        }
        // Add summary of removed sections
        if (removed.length > 0) {
            sections.push('## Removed Sections (Low Priority)');
            sections.push(removed.join('\n'));
        }
        return sections.join('\n');
    }
    /**
     * Extract key entities (names, numbers, dates) from context
     */
    static extractKeyEntities(context) {
        const names = Array.from(new Set(context.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || []));
        const numbers = Array.from(new Set(context.match(/\b\d+(?:\.\d+)?\b/g) || []));
        const dates = Array.from(new Set(context.match(/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/g) || []));
        const files = Array.from(new Set(context.match(/[\w\-]+\.[a-z]{2,4}\b/gi) || []));
        return { names, numbers, dates, files };
    }
    /**
     * Estimate token count (rough approximation)
     */
    static estimateTokens(text) {
        // GPT-like tokenization: ~1 token per 4 characters
        // More accurate would require actual tokenizer
        return Math.ceil(text.length / 4);
    }
}
