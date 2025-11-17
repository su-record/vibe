/**
 * Language detection utility for code quality tools
 * Supports TypeScript, JavaScript, Python, and Dart/Flutter
 */
export function detectLanguage(code) {
    // Dart/Flutter indicators (check first - most specific)
    if (/\bWidget\b/.test(code) ||
        /\bStatelessWidget\b/.test(code) ||
        /\bStatefulWidget\b/.test(code) ||
        /\bBuildContext\b/.test(code) ||
        /Widget build\(/.test(code) ||
        /extends\s+(StatelessWidget|StatefulWidget|State)/.test(code) ||
        (/@override/i.test(code) && /Widget|BuildContext/.test(code))) {
        return 'dart';
    }
    // Python indicators
    if (/^(def|async def)\s/m.test(code) ||
        /^from\s+\w+\s+import/.test(code) ||
        /^\s+def\s/m.test(code) || // Indented function definitions
        /\belif\b/.test(code) ||
        /\b__init__\b/.test(code) ||
        /\bprint\(/m.test(code) ||
        (/:\s*$/m.test(code) && !/;/.test(code)) // Python colon without semicolon
    ) {
        return 'python';
    }
    // TypeScript indicators
    if (/:\s*(string|number|boolean|any|void|unknown|never)\b/.test(code) ||
        /interface\s+\w+/.test(code) ||
        /type\s+\w+\s*=/.test(code) ||
        /<[A-Z]\w*>/.test(code) // generics with capital letters
    ) {
        return 'typescript';
    }
    // JavaScript (default if none match)
    if (/\b(const|let|var|function|class|async|await|import|export)\b/.test(code)) {
        return 'javascript';
    }
    return 'unknown';
}
export function getLanguageName(lang) {
    const names = {
        typescript: 'TypeScript',
        javascript: 'JavaScript',
        python: 'Python',
        dart: 'Dart/Flutter',
        unknown: 'Unknown'
    };
    return names[lang];
}
