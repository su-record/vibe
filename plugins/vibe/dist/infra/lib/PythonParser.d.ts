export interface PythonSymbol {
    name: string;
    kind: 'function' | 'class' | 'variable' | 'import';
    line: number;
    column: number;
    endLine?: number;
    docstring?: string;
}
export interface PythonComplexity {
    cyclomaticComplexity: number;
    functions: Array<{
        name: string;
        complexity: number;
        line: number;
    }>;
    classes: Array<{
        name: string;
        methods: number;
        line: number;
    }>;
}
export declare class PythonParser {
    private static cleanupRegistered;
    private static pythonScript;
    private static scriptPath;
    /**
     * Register cleanup handlers on first use
     */
    private static registerCleanup;
    /**
     * Initialize Python script (singleton pattern)
     */
    private static ensureScriptExists;
    /**
     * Execute Python code analysis with improved memory management
     */
    private static executePython;
    static findSymbols(code: string): Promise<PythonSymbol[]>;
    static analyzeComplexity(code: string): Promise<PythonComplexity>;
    /**
     * Cleanup singleton script on process exit
     */
    static cleanup(): Promise<void>;
    static isPythonFile(filePath: string): boolean;
    static isPythonCode(code: string): boolean;
}
//# sourceMappingURL=PythonParser.d.ts.map