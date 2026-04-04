/**
 * LSP Tools - Language Server Protocol 기반 코드 인텔리전스
 *
 * 지원 기능:
 * - lsp_hover: 타입 정보
 * - lsp_goto_definition: 정의로 이동
 * - lsp_find_references: 참조 찾기
 * - lsp_document_symbols: 파일 심볼 목록
 * - lsp_workspace_symbols: 워크스페이스 심볼 검색
 * - lsp_diagnostics: 에러/경고
 * - lsp_rename: 리네임 프리뷰
 * - lsp_code_actions: 가능한 리팩토링
 *
 * 현재는 ts-morph 기반으로 TypeScript/JavaScript 지원
 */

import type { Project, Node as TsMorphNode, ReferencedSymbol, ReferenceEntry } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';
import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';
import { ProjectCache } from '../../infra/lib/ProjectCache.js';

async function loadTsMorph(): Promise<typeof import('ts-morph')> {
  return import('ts-morph');
}

// Tool Definitions
export const lspHoverDefinition: ToolDefinition = {
  name: 'lsp_hover',
  description: 'Get type information at a specific position in a file',
  inputSchema: {
    type: 'object',
    properties: {
      file: { type: 'string', description: 'File path' },
      line: { type: 'number', description: 'Line number (1-based)' },
      column: { type: 'number', description: 'Column number (1-based)' },
    },
    required: ['file', 'line', 'column']
  },
  annotations: { title: 'LSP Hover', audience: ['user', 'assistant'], readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
};

export const lspGotoDefinitionDefinition: ToolDefinition = {
  name: 'lsp_goto_definition',
  description: 'Find the definition location of a symbol',
  inputSchema: {
    type: 'object',
    properties: {
      file: { type: 'string', description: 'File path' },
      line: { type: 'number', description: 'Line number (1-based)' },
      column: { type: 'number', description: 'Column number (1-based)' },
    },
    required: ['file', 'line', 'column']
  },
  annotations: { title: 'LSP Goto Definition', audience: ['user', 'assistant'], readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
};

export const lspFindReferencesDefinition: ToolDefinition = {
  name: 'lsp_find_references',
  description: 'Find all references to a symbol',
  inputSchema: {
    type: 'object',
    properties: {
      file: { type: 'string', description: 'File path' },
      line: { type: 'number', description: 'Line number (1-based)' },
      column: { type: 'number', description: 'Column number (1-based)' },
      includeDeclaration: { type: 'boolean', description: 'Include the declaration itself (default: true)' },
    },
    required: ['file', 'line', 'column']
  },
  annotations: { title: 'LSP Find References', audience: ['user', 'assistant'], readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
};

export const lspDocumentSymbolsDefinition: ToolDefinition = {
  name: 'lsp_document_symbols',
  description: 'Get all symbols in a document (file outline)',
  inputSchema: {
    type: 'object',
    properties: {
      file: { type: 'string', description: 'File path' },
    },
    required: ['file']
  },
  annotations: { title: 'LSP Document Symbols', audience: ['user', 'assistant'], readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
};

export const lspWorkspaceSymbolsDefinition: ToolDefinition = {
  name: 'lsp_workspace_symbols',
  description: 'Search for symbols across the workspace',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Symbol name to search for' },
      projectPath: { type: 'string', description: 'Project root path' },
      maxResults: { type: 'number', description: 'Maximum results (default: 50)' },
    },
    required: ['query', 'projectPath']
  },
  annotations: { title: 'LSP Workspace Symbols', audience: ['user', 'assistant'], readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
};

export const lspDiagnosticsDefinition: ToolDefinition = {
  name: 'lsp_diagnostics',
  description: 'Get diagnostics (errors, warnings) for a file',
  inputSchema: {
    type: 'object',
    properties: {
      file: { type: 'string', description: 'File path' },
    },
    required: ['file']
  },
  annotations: { title: 'LSP Diagnostics', audience: ['user', 'assistant'], readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
};

export const lspDiagnosticsDirectoryDefinition: ToolDefinition = {
  name: 'lsp_diagnostics_directory',
  description: 'Get diagnostics for all files in a directory',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: { type: 'string', description: 'Project root path' },
      includeWarnings: { type: 'boolean', description: 'Include warnings (default: true)' },
    },
    required: ['projectPath']
  },
  annotations: { title: 'LSP Directory Diagnostics', audience: ['user', 'assistant'], readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
};

export const lspRenameDefinition: ToolDefinition = {
  name: 'lsp_rename',
  description: 'Preview renaming a symbol across files',
  inputSchema: {
    type: 'object',
    properties: {
      file: { type: 'string', description: 'File path' },
      line: { type: 'number', description: 'Line number (1-based)' },
      column: { type: 'number', description: 'Column number (1-based)' },
      newName: { type: 'string', description: 'New name for the symbol' },
    },
    required: ['file', 'line', 'column', 'newName']
  },
  annotations: { title: 'LSP Rename', audience: ['user', 'assistant'], readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false }
};

export const lspCodeActionsDefinition: ToolDefinition = {
  name: 'lsp_code_actions',
  description: 'Get available code actions (quick fixes, refactorings) at a position',
  inputSchema: {
    type: 'object',
    properties: {
      file: { type: 'string', description: 'File path' },
      line: { type: 'number', description: 'Line number (1-based)' },
      column: { type: 'number', description: 'Column number (1-based)' },
    },
    required: ['file', 'line', 'column']
  },
  annotations: { title: 'LSP Code Actions', audience: ['user', 'assistant'], readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
};

// Helper to get project path from file
function getProjectPath(filePath: string): string {
  let dir = path.dirname(filePath);
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'tsconfig.json')) ||
        fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return path.dirname(filePath);
}

// Get node at position
function getNodeAtPosition(project: Project, filePath: string, line: number, column: number): TsMorphNode | undefined {
  const sourceFile = project.getSourceFile(filePath);
  if (!sourceFile) return undefined;

  const pos = sourceFile.compilerNode.getPositionOfLineAndCharacter(line - 1, column - 1);
  return sourceFile.getDescendantAtPos(pos);
}

// Find identifier node for references/definitions
async function findIdentifierNode(node: TsMorphNode): Promise<TsMorphNode | undefined> {
  const { Node } = await loadTsMorph();
  if (Node.isIdentifier(node)) return node;
  if (Node.isPropertyAccessExpression(node)) return node.getNameNode();
  if (Node.isCallExpression(node)) {
    const expr = node.getExpression();
    if (Node.isPropertyAccessExpression(expr)) return expr.getNameNode();
    if (Node.isIdentifier(expr)) return expr;
  }
  // Try to find nearest identifier
  const parent = node.getParent();
  if (parent && Node.isIdentifier(parent)) return parent;
  return node;
}

// Implementations
export async function lspHover(args: { file: string; line: number; column: number }): Promise<ToolResult> {
  const { file, line, column } = args;

  try {
    const projectPath = getProjectPath(file);
    const project = await ProjectCache.getInstance().getOrCreate(projectPath);
    const node = getNodeAtPosition(project, file, line, column);

    if (!node) {
      return { content: [{ type: 'text', text: 'No symbol found at position' }] };
    }

    const type = node.getType();
    const typeText = type.getText(node);
    const symbol = node.getSymbol();
    const docs = symbol?.getJsDocTags().map(t => `@${t.getName()} ${t.getText().map(p => p.text).join('')}`).join('\n') || '';

    return {
      content: [{
        type: 'text',
        text: `**Type:** \`${typeText}\`\n\n${docs ? `**Documentation:**\n${docs}` : ''}`
      }]
    };
  } catch (error) {
    return { content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }] };
  }
}

export async function lspGotoDefinition(args: { file: string; line: number; column: number }): Promise<ToolResult> {
  const { file, line, column } = args;

  try {
    const projectPath = getProjectPath(file);
    const project = await ProjectCache.getInstance().getOrCreate(projectPath);
    const node = getNodeAtPosition(project, file, line, column);

    if (!node) {
      return { content: [{ type: 'text', text: 'No symbol found at position' }] };
    }

    const identNode = await findIdentifierNode(node);
    if (!identNode) {
      return { content: [{ type: 'text', text: 'No identifier found at position' }] };
    }

    // Use symbol to find definitions
    const symbol = identNode.getSymbol();
    if (!symbol) {
      return { content: [{ type: 'text', text: 'No symbol found' }] };
    }

    const declarations = symbol.getDeclarations();
    if (declarations.length === 0) {
      return { content: [{ type: 'text', text: 'No definition found' }] };
    }

    const results = declarations.map(decl => {
      const sf = decl.getSourceFile();
      const start = decl.getStartLineNumber();
      return `${sf.getFilePath()}:${start}`;
    });

    return {
      content: [{
        type: 'text',
        text: `**Definitions:**\n${results.map(r => `- ${r}`).join('\n')}`
      }]
    };
  } catch (error) {
    return { content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }] };
  }
}

export async function lspFindReferences(args: { file: string; line: number; column: number; includeDeclaration?: boolean }): Promise<ToolResult> {
  const { file, line, column, includeDeclaration = true } = args;

  try {
    const { Node } = await loadTsMorph();
    const projectPath = getProjectPath(file);
    const project = await ProjectCache.getInstance().getOrCreate(projectPath);
    const node = getNodeAtPosition(project, file, line, column);

    if (!node) {
      return { content: [{ type: 'text', text: 'No symbol found at position' }] };
    }

    const identNode = await findIdentifierNode(node);
    if (!identNode || !Node.isIdentifier(identNode)) {
      return { content: [{ type: 'text', text: 'No identifier found at position' }] };
    }

    const referencedSymbols: ReferencedSymbol[] = identNode.findReferences();
    const references: string[] = [];

    for (const ref of referencedSymbols) {
      const refEntries = ref.getReferences();
      for (const r of refEntries) {
        if (!includeDeclaration && r.isDefinition?.()) continue;
        const sf = r.getSourceFile();
        const start = r.getTextSpan().getStart();
        const pos = sf.getLineAndColumnAtPos(start);
        references.push(`${sf.getFilePath()}:${pos.line}:${pos.column}`);
      }
    }

    if (references.length === 0) {
      return { content: [{ type: 'text', text: 'No references found' }] };
    }

    return {
      content: [{
        type: 'text',
        text: `**Found ${references.length} references:**\n${references.slice(0, 50).map(r => `- ${r}`).join('\n')}${references.length > 50 ? `\n... and ${references.length - 50} more` : ''}`
      }]
    };
  } catch (error) {
    return { content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }] };
  }
}

export async function lspDocumentSymbols(args: { file: string }): Promise<ToolResult> {
  const { file } = args;

  try {
    const projectPath = getProjectPath(file);
    const project = await ProjectCache.getInstance().getOrCreate(projectPath);
    const sourceFile = project.getSourceFile(file);

    if (!sourceFile) {
      return { content: [{ type: 'text', text: 'File not found in project' }] };
    }

    const symbols: Array<{ name: string; kind: string; line: number }> = [];

    // Classes
    sourceFile.getClasses().forEach(c => {
      symbols.push({ name: c.getName() || 'anonymous', kind: 'Class', line: c.getStartLineNumber() });
      c.getMethods().forEach(m => symbols.push({ name: `  ${m.getName()}`, kind: 'Method', line: m.getStartLineNumber() }));
      c.getProperties().forEach(p => symbols.push({ name: `  ${p.getName()}`, kind: 'Property', line: p.getStartLineNumber() }));
    });

    // Interfaces
    sourceFile.getInterfaces().forEach(i => {
      symbols.push({ name: i.getName(), kind: 'Interface', line: i.getStartLineNumber() });
    });

    // Functions
    sourceFile.getFunctions().forEach(f => {
      symbols.push({ name: f.getName() || 'anonymous', kind: 'Function', line: f.getStartLineNumber() });
    });

    // Type aliases
    sourceFile.getTypeAliases().forEach(t => {
      symbols.push({ name: t.getName(), kind: 'Type', line: t.getStartLineNumber() });
    });

    // Enums
    sourceFile.getEnums().forEach(e => {
      symbols.push({ name: e.getName(), kind: 'Enum', line: e.getStartLineNumber() });
    });

    // Variables
    sourceFile.getVariableDeclarations().forEach(v => {
      symbols.push({ name: v.getName(), kind: 'Variable', line: v.getStartLineNumber() });
    });

    return {
      content: [{
        type: 'text',
        text: `**Document Symbols (${symbols.length}):**\n${symbols.map(s => `- ${s.name} (${s.kind}) :${s.line}`).join('\n')}`
      }]
    };
  } catch (error) {
    return { content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }] };
  }
}

export async function lspWorkspaceSymbols(args: { query: string; projectPath: string; maxResults?: number }): Promise<ToolResult> {
  const { query, projectPath, maxResults = 50 } = args;

  try {
    const project = await ProjectCache.getInstance().getOrCreate(projectPath);
    const symbols: Array<{ name: string; kind: string; file: string; line: number }> = [];

    for (const sourceFile of project.getSourceFiles()) {
      if (symbols.length >= maxResults) break;

      const filePath = sourceFile.getFilePath();
      if (filePath.includes('node_modules')) continue;

      // Search in all symbol types
      const searchIn = [
        ...sourceFile.getClasses().map(c => ({ node: c, kind: 'Class' })),
        ...sourceFile.getInterfaces().map(i => ({ node: i, kind: 'Interface' })),
        ...sourceFile.getFunctions().map(f => ({ node: f, kind: 'Function' })),
        ...sourceFile.getTypeAliases().map(t => ({ node: t, kind: 'Type' })),
        ...sourceFile.getEnums().map(e => ({ node: e, kind: 'Enum' })),
      ];

      for (const { node, kind } of searchIn) {
        const name = (node as { getName?: () => string | undefined }).getName?.() || '';
        if (name && name.toLowerCase().includes(query.toLowerCase())) {
          symbols.push({
            name,
            kind,
            file: filePath,
            line: node.getStartLineNumber(),
          });
          if (symbols.length >= maxResults) break;
        }
      }
    }

    if (symbols.length === 0) {
      return { content: [{ type: 'text', text: `No symbols found matching "${query}"` }] };
    }

    return {
      content: [{
        type: 'text',
        text: `**Found ${symbols.length} symbols matching "${query}":**\n${symbols.map(s => `- ${s.name} (${s.kind}) - ${s.file}:${s.line}`).join('\n')}`
      }]
    };
  } catch (error) {
    return { content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }] };
  }
}

export async function lspDiagnostics(args: { file: string }): Promise<ToolResult> {
  const { file } = args;

  try {
    const { ts } = await loadTsMorph();
    const projectPath = getProjectPath(file);
    const project = await ProjectCache.getInstance().getOrCreate(projectPath);
    const sourceFile = project.getSourceFile(file);

    if (!sourceFile) {
      return { content: [{ type: 'text', text: 'File not found in project' }] };
    }

    const diagnostics = sourceFile.getPreEmitDiagnostics();

    if (diagnostics.length === 0) {
      return { content: [{ type: 'text', text: '✓ No diagnostics (errors/warnings)' }] };
    }

    const formatted = diagnostics.map(d => {
      const start = d.getStart();
      const line = start ? sourceFile.getLineAndColumnAtPos(start).line : 0;
      const severity = d.getCategory() === ts.DiagnosticCategory.Error ? '❌ Error' : '⚠️ Warning';
      return `${severity} [line ${line}]: ${d.getMessageText()}`;
    });

    return {
      content: [{
        type: 'text',
        text: `**Diagnostics (${diagnostics.length}):**\n${formatted.join('\n')}`
      }]
    };
  } catch (error) {
    return { content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }] };
  }
}

export async function lspDiagnosticsDirectory(args: { projectPath: string; includeWarnings?: boolean }): Promise<ToolResult> {
  const { projectPath, includeWarnings = true } = args;

  try {
    const { ts } = await loadTsMorph();
    const project = await ProjectCache.getInstance().getOrCreate(projectPath);
    const allDiagnostics: Array<{ file: string; line: number; severity: string; message: string }> = [];

    for (const sourceFile of project.getSourceFiles()) {
      const filePath = sourceFile.getFilePath();
      if (filePath.includes('node_modules')) continue;

      const diagnostics = sourceFile.getPreEmitDiagnostics();

      for (const d of diagnostics) {
        const isError = d.getCategory() === ts.DiagnosticCategory.Error;
        if (!includeWarnings && !isError) continue;

        const start = d.getStart();
        const line = start ? sourceFile.getLineAndColumnAtPos(start).line : 0;

        allDiagnostics.push({
          file: filePath,
          line,
          severity: isError ? '❌' : '⚠️',
          message: String(d.getMessageText()),
        });
      }
    }

    if (allDiagnostics.length === 0) {
      return { content: [{ type: 'text', text: '✓ No diagnostics in project' }] };
    }

    const errors = allDiagnostics.filter(d => d.severity === '❌').length;
    const warnings = allDiagnostics.length - errors;

    return {
      content: [{
        type: 'text',
        text: `**Project Diagnostics:** ${errors} errors, ${warnings} warnings\n\n${allDiagnostics.slice(0, 50).map(d => `${d.severity} ${d.file}:${d.line}\n   ${d.message.substring(0, 100)}`).join('\n\n')}${allDiagnostics.length > 50 ? `\n\n... and ${allDiagnostics.length - 50} more` : ''}`
      }]
    };
  } catch (error) {
    return { content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }] };
  }
}

export async function lspRename(args: { file: string; line: number; column: number; newName: string }): Promise<ToolResult> {
  const { file, line, column, newName } = args;

  try {
    const { Node } = await loadTsMorph();
    const projectPath = getProjectPath(file);
    const project = await ProjectCache.getInstance().getOrCreate(projectPath);
    const node = getNodeAtPosition(project, file, line, column);

    if (!node) {
      return { content: [{ type: 'text', text: 'No symbol found at position' }] };
    }

    const identNode = await findIdentifierNode(node);
    if (!identNode || !Node.isIdentifier(identNode)) {
      return { content: [{ type: 'text', text: 'No identifier found at position' }] };
    }

    // Find all references that would be renamed
    const referencedSymbols: ReferencedSymbol[] = identNode.findReferences();
    const changes: Array<{ file: string; line: number; oldText: string }> = [];

    for (const ref of referencedSymbols) {
      const refEntries: ReferenceEntry[] = ref.getReferences();
      for (const r of refEntries) {
        const sf = r.getSourceFile();
        const span = r.getTextSpan();
        const start = span.getStart();
        const pos = sf.getLineAndColumnAtPos(start);
        const text = sf.getFullText().substring(start, start + span.getLength());
        changes.push({
          file: sf.getFilePath(),
          line: pos.line,
          oldText: text,
        });
      }
    }

    if (changes.length === 0) {
      return { content: [{ type: 'text', text: 'No references found to rename' }] };
    }

    return {
      content: [{
        type: 'text',
        text: `**Rename Preview:** ${changes.length} occurrences would be renamed to "${newName}"\n\n${changes.slice(0, 20).map(c => `- ${c.file}:${c.line} (${c.oldText})`).join('\n')}${changes.length > 20 ? `\n... and ${changes.length - 20} more` : ''}\n\n⚠️ This is a preview. Use your editor's rename feature to apply.`
      }]
    };
  } catch (error) {
    return { content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }] };
  }
}

export async function lspCodeActions(args: { file: string; line: number; column: number }): Promise<ToolResult> {
  const { file, line, column } = args;

  try {
    const { Node } = await loadTsMorph();
    const projectPath = getProjectPath(file);
    const project = await ProjectCache.getInstance().getOrCreate(projectPath);
    const sourceFile = project.getSourceFile(file);

    if (!sourceFile) {
      return { content: [{ type: 'text', text: 'File not found in project' }] };
    }

    // Get diagnostics at position for potential quick fixes
    const pos = sourceFile.compilerNode.getPositionOfLineAndCharacter(line - 1, column - 1);
    const diagnostics = sourceFile.getPreEmitDiagnostics().filter(d => {
      const start = d.getStart() || 0;
      const length = d.getLength() || 0;
      return pos >= start && pos <= start + length;
    });

    const actions: string[] = [];

    // Common code actions based on context
    const node = sourceFile.getDescendantAtPos(pos);

    if (node) {
      // Extract function
      if (Node.isBlock(node.getParent())) {
        actions.push('Extract to function');
      }

      // Extract variable
      if (Node.isExpression(node)) {
        actions.push('Extract to variable');
      }

      // Add missing import
      if (Node.isIdentifier(node)) {
        const symbol = node.getSymbol();
        if (!symbol) {
          actions.push('Add missing import');
        }
      }

      // Convert to arrow function
      if (Node.isFunctionDeclaration(node) || Node.isFunctionExpression(node)) {
        actions.push('Convert to arrow function');
      }
    }

    // Add quick fixes for diagnostics
    for (const d of diagnostics) {
      actions.push(`Fix: ${String(d.getMessageText()).substring(0, 50)}`);
    }

    if (actions.length === 0) {
      return { content: [{ type: 'text', text: 'No code actions available at this position' }] };
    }

    return {
      content: [{
        type: 'text',
        text: `**Available Code Actions:**\n${actions.map(a => `- ${a}`).join('\n')}\n\n💡 Use your editor to apply these actions.`
      }]
    };
  } catch (error) {
    return { content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }] };
  }
}
