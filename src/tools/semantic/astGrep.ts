/**
 * ast-grep Tools - 패턴 기반 코드 검색/변환
 *
 * 지원 언어: JavaScript, TypeScript, TSX, JSX, HTML, CSS
 * (Python, Go, Rust 등은 ast-grep-napi에서 별도 동적 등록 필요)
 *
 * @ast-grep/napi는 네이티브 바이너리 optional dependency → 동적 import
 */

import { createRequire } from 'module';
import { readFile, readdir, stat, writeFile } from 'fs/promises';
import * as path from 'path';
import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';

// ast-grep 동적 로딩 (createRequire — 네이티브 바이너리에 안정적)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sgModule: any = null;
let sgLoadFailed = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadAstGrep(): any {
  if (sgModule) return sgModule;
  if (sgLoadFailed) {
    throw new Error('@ast-grep/napi is not installed. Run: npm install @ast-grep/napi');
  }
  try {
    const require = createRequire(import.meta.url);
    sgModule = require('@ast-grep/napi');
    return sgModule;
  } catch {
    sgLoadFailed = true;
    throw new Error('@ast-grep/napi is not installed. Run: npm install @ast-grep/napi');
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LangParser = any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getLangParsers(sg: any): Record<string, LangParser> {
  return {
    '.js': sg.js, '.mjs': sg.js, '.cjs': sg.js,
    '.jsx': sg.jsx,
    '.ts': sg.ts, '.mts': sg.ts, '.cts': sg.ts,
    '.tsx': sg.tsx,
    '.html': sg.html, '.htm': sg.html,
    '.css': sg.css, '.scss': sg.css,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getLangNameMap(sg: any): Record<string, LangParser> {
  return {
    javascript: sg.js, typescript: sg.ts,
    tsx: sg.tsx, jsx: sg.jsx,
    html: sg.html, css: sg.css,
  };
}

interface SearchMatch {
  file: string;
  line: number;
  column: number;
  matchedText: string;
  context: string;
}

interface ReplacePreview {
  file: string;
  line: number;
  original: string;
  replacement: string;
}

// Tool Definitions
export const astGrepSearchDefinition: ToolDefinition = {
  name: 'ast_grep_search',
  description: 'AST pattern search - Find code patterns using meta-variables ($VAR). Supports JS, TS, TSX, JSX, HTML, CSS.',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'AST pattern with meta-variables (e.g., "console.log($MSG)", "function $NAME($$$) { $$$ }")'
      },
      path: {
        type: 'string',
        description: 'Directory or file path to search'
      },
      lang: {
        type: 'string',
        enum: ['javascript', 'typescript', 'tsx', 'jsx', 'html', 'css'],
        description: 'Language to parse (auto-detected from file extension if not specified)'
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return (default: 50)'
      }
    },
    required: ['pattern', 'path']
  },
  annotations: {
    title: 'AST Grep Search',
    audience: ['user', 'assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

export const astGrepReplaceDefinition: ToolDefinition = {
  name: 'ast_grep_replace',
  description: 'AST pattern replace - Transform code using pattern matching. Supports JS, TS, TSX, JSX, HTML, CSS.',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'AST pattern to match (e.g., "console.log($MSG)")'
      },
      replacement: {
        type: 'string',
        description: 'Replacement pattern using captured meta-variables (e.g., "logger.info($MSG)")'
      },
      path: {
        type: 'string',
        description: 'Directory or file path'
      },
      lang: {
        type: 'string',
        enum: ['javascript', 'typescript', 'tsx', 'jsx', 'html', 'css'],
        description: 'Language to parse'
      },
      dryRun: {
        type: 'boolean',
        description: 'Preview changes without applying (default: true)'
      }
    },
    required: ['pattern', 'replacement', 'path']
  },
  annotations: {
    title: 'AST Grep Replace',
    audience: ['user', 'assistant'],
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false
  }
};

function getParserFromExtension(parsers: Record<string, LangParser>, filePath: string): LangParser | null {
  const ext = path.extname(filePath).toLowerCase();
  return parsers[ext] || null;
}

function getParserFromString(nameMap: Record<string, LangParser>, langStr: string): LangParser | null {
  return nameMap[langStr.toLowerCase()] || null;
}

async function getFilesRecursive(
  dir: string,
  parsers: Record<string, LangParser>,
  targetParser?: LangParser,
): Promise<string[]> {
  const files: string[] = [];
  const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '__pycache__', 'venv', '.venv'];

  async function walk(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!ignoreDirs.includes(entry.name) && !entry.name.startsWith('.')) {
          await walk(fullPath);
        }
      } else if (entry.isFile()) {
        const fileParser = getParserFromExtension(parsers, fullPath);
        if (fileParser !== null && (targetParser === undefined || fileParser === targetParser)) {
          files.push(fullPath);
        }
      }
    }
  }

  const stats = await stat(dir);
  if (stats.isFile()) {
    return [dir];
  }

  await walk(dir);
  return files;
}

function getContextLines(content: string, line: number, contextSize: number = 1): string {
  const lines = content.split('\n');
  const start = Math.max(0, line - 1 - contextSize);
  const end = Math.min(lines.length, line + contextSize);
  return lines.slice(start, end).join('\n');
}

export async function astGrepSearch(args: {
  pattern: string;
  path: string;
  lang?: string;
  maxResults?: number;
}): Promise<ToolResult> {
  const { pattern, path: searchPath, lang, maxResults = 50 } = args;

  try {
    const sg = loadAstGrep();
    const parsers = getLangParsers(sg);
    const nameMap = getLangNameMap(sg);

    const targetParser = lang ? getParserFromString(nameMap, lang) : undefined;
    const files = await getFilesRecursive(searchPath, parsers, targetParser ?? undefined);
    const matches: SearchMatch[] = [];

    for (const file of files) {
      if (matches.length >= maxResults) break;

      const fileParser = getParserFromExtension(parsers, file);
      if (!fileParser) continue;

      try {
        const content = await readFile(file, 'utf-8');
        const root = fileParser.parse(content).root();
        const nodes = root.findAll(pattern);

        for (const node of nodes) {
          if (matches.length >= maxResults) break;

          const range = node.range();
          matches.push({
            file,
            line: range.start.line + 1,
            column: range.start.column + 1,
            matchedText: node.text(),
            context: getContextLines(content, range.start.line + 1),
          });
        }
      } catch {
        // Skip files that can't be parsed
      }
    }

    if (matches.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No matches found for pattern: ${pattern}`
        }]
      };
    }

    const output = matches.map((m, i) =>
      `${i + 1}. ${m.file}:${m.line}:${m.column}\n   Match: ${m.matchedText.substring(0, 100)}${m.matchedText.length > 100 ? '...' : ''}`
    ).join('\n\n');

    return {
      content: [{
        type: 'text',
        text: `Found ${matches.length} matches for pattern: ${pattern}\n\n${output}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error searching: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]
    };
  }
}

export async function astGrepReplace(args: {
  pattern: string;
  replacement: string;
  path: string;
  lang?: string;
  dryRun?: boolean;
}): Promise<ToolResult> {
  const { pattern, replacement, path: searchPath, lang, dryRun = true } = args;

  try {
    const sg = loadAstGrep();
    const parsers = getLangParsers(sg);
    const nameMap = getLangNameMap(sg);

    const targetParser = lang ? getParserFromString(nameMap, lang) : undefined;
    const files = await getFilesRecursive(searchPath, parsers, targetParser ?? undefined);
    const previews: ReplacePreview[] = [];
    const fileChanges: Map<string, { content: string; edits: Array<{ start: number; end: number; text: string }> }> = new Map();

    for (const file of files) {
      const fileParser = getParserFromExtension(parsers, file);
      if (!fileParser) continue;

      try {
        const content = await readFile(file, 'utf-8');
        const root = fileParser.parse(content).root();
        const nodes = root.findAll(pattern);

        if (nodes.length === 0) continue;

        const edits: Array<{ start: number; end: number; text: string }> = [];

        for (const node of nodes) {
          const range = node.range();

          // Build replacement with captured meta-variables
          let replaced = replacement;

          // Get captured variables using getMatch
          const metaVarPattern = /\$([A-Z_][A-Z0-9_]*|\$\$)/g;
          let match;
          while ((match = metaVarPattern.exec(replacement)) !== null) {
            const varName = match[1];
            const captured = node.getMatch(varName);
            if (captured) {
              replaced = replaced.replace(new RegExp(`\\$${varName}`, 'g'), captured.text());
            }
          }

          previews.push({
            file,
            line: range.start.line + 1,
            original: node.text(),
            replacement: replaced,
          });

          edits.push({
            start: range.start.index,
            end: range.end.index,
            text: replaced,
          });
        }

        if (edits.length > 0) {
          fileChanges.set(file, { content, edits });
        }
      } catch {
        // Skip files that can't be parsed
      }
    }

    if (previews.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No matches found for pattern: ${pattern}`
        }]
      };
    }

    // Apply changes if not dry run
    if (!dryRun) {
      for (const [file, { content, edits }] of fileChanges) {
        // Sort edits by position (descending) to apply from end to start
        edits.sort((a, b) => b.start - a.start);

        let newContent = content;
        for (const edit of edits) {
          newContent = newContent.substring(0, edit.start) + edit.text + newContent.substring(edit.end);
        }

        await writeFile(file, newContent, 'utf-8');
      }
    }

    const output = previews.slice(0, 20).map((p, i) =>
      `${i + 1}. ${p.file}:${p.line}\n   - ${p.original.substring(0, 80)}${p.original.length > 80 ? '...' : ''}\n   + ${p.replacement.substring(0, 80)}${p.replacement.length > 80 ? '...' : ''}`
    ).join('\n\n');

    const modeText = dryRun ? '[DRY RUN] ' : '';
    const actionText = dryRun
      ? 'Use dryRun: false to apply changes.'
      : `Applied ${previews.length} replacements across ${fileChanges.size} files.`;

    return {
      content: [{
        type: 'text',
        text: `${modeText}Found ${previews.length} replacements for: ${pattern} → ${replacement}\n\n${output}\n\n${actionText}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error replacing: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]
    };
  }
}
