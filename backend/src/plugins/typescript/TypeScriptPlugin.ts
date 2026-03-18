import path from 'path';
import { parse, TSESTree } from '@typescript-eslint/typescript-estree';
import type { ParserPlugin } from '../PluginInterface.js';
import type { ParseContext, ParseResult } from '../../types/index.js';

type AST = TSESTree.Program;

/**
 * TypeScript / JavaScript parser plugin.
 * Uses @typescript-eslint/typescript-estree for accurate AST analysis.
 * Handles: ES Modules, CommonJS require(), dynamic import(), re-exports.
 */
export class TypeScriptPlugin implements ParserPlugin {
  readonly language = 'typescript' as const;
  readonly fileExtensions = ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'];

  canHandle(filePath: string): boolean {
    const ext = path.extname(filePath).slice(1).toLowerCase();
    return this.fileExtensions.includes(ext);
  }

  parse(content: string, context: ParseContext): AST {
    const isJSX = /\.(tsx|jsx)$/.test(context.filePath);
    return parse(content, {
      jsx: isJSX,
      loc: true,
      range: false,
      tokens: false,
      comment: false,
      // Tolerant mode: parse even if there are syntax errors
      errorOnUnknownASTType: false,
    });
  }

  extractNodes(ast: AST, _context: ParseContext): ParseResult['nodes'] {
    const nodes: ParseResult['nodes'] = [];

    this.walkAST(ast, {
      FunctionDeclaration: (node: TSESTree.FunctionDeclaration) => {
        if (node.id?.name) {
          nodes.push({ name: node.id.name, type: 'function', line: node.loc?.start.line });
        }
      },
      ClassDeclaration: (node: TSESTree.ClassDeclaration) => {
        if (node.id?.name) {
          nodes.push({ name: node.id.name, type: 'class', line: node.loc?.start.line });
        }
      },
      VariableDeclarator: (node: TSESTree.VariableDeclarator) => {
        if (
          node.id.type === 'Identifier' &&
          node.init &&
          (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression')
        ) {
          nodes.push({ name: node.id.name, type: 'function', line: node.loc?.start.line });
        }
      },
    });

    return nodes;
  }

  extractImports(ast: AST, _context: ParseContext): string[] {
    const imports: string[] = [];

    this.walkAST(ast, {
      ImportDeclaration: (node: TSESTree.ImportDeclaration) => {
        imports.push(node.source.value as string);
      },
      // export { X } from 'y' — re-exports also create dependency
      ExportNamedDeclaration: (node: TSESTree.ExportNamedDeclaration) => {
        if (node.source) imports.push(node.source.value as string);
      },
      ExportAllDeclaration: (node: TSESTree.ExportAllDeclaration) => {
        imports.push(node.source.value as string);
      },
      // require('x')
      CallExpression: (node: TSESTree.CallExpression) => {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'require' &&
          node.arguments.length > 0 &&
          node.arguments[0].type === 'Literal' &&
          typeof node.arguments[0].value === 'string'
        ) {
          imports.push(node.arguments[0].value);
        }
        // import('x') — dynamic imports
        if (
          node.callee.type === 'Import' &&
          node.arguments.length > 0 &&
          node.arguments[0].type === 'Literal' &&
          typeof node.arguments[0].value === 'string'
        ) {
          imports.push(node.arguments[0].value);
        }
      },
    });

    return [...new Set(imports)];
  }

  extractExports(ast: AST, _context: ParseContext): string[] {
    const exports: string[] = [];

    this.walkAST(ast, {
      ExportNamedDeclaration: (node: TSESTree.ExportNamedDeclaration) => {
        if (node.declaration) {
          if (
            node.declaration.type === 'FunctionDeclaration' &&
            node.declaration.id
          ) {
            exports.push(node.declaration.id.name);
          }
          if (
            node.declaration.type === 'ClassDeclaration' &&
            node.declaration.id
          ) {
            exports.push(node.declaration.id.name);
          }
          if (node.declaration.type === 'VariableDeclaration') {
            node.declaration.declarations.forEach(d => {
              if (d.id.type === 'Identifier') exports.push(d.id.name);
            });
          }
        }
        node.specifiers.forEach(s => {
          if (s.exported.type === 'Identifier') exports.push(s.exported.name);
        });
      },
      ExportDefaultDeclaration: (_node: TSESTree.ExportDefaultDeclaration) => {
        exports.push('default');
      },
    });

    return exports;
  }

  // ── AST traversal ──────────────────────────────────────────────────────────

  private walkAST(node: unknown, visitors: Record<string, (n: never) => void>): void {
    if (!node || typeof node !== 'object') return;
    const n = node as { type?: string; [key: string]: unknown };

    if (n.type && visitors[n.type]) {
      try { visitors[n.type](n as never); } catch { /* swallow visitor errors */ }
    }

    for (const key of Object.keys(n)) {
      if (key === 'parent') continue; // avoid circular refs
      const child = n[key];
      if (Array.isArray(child)) {
        child.forEach(item => this.walkAST(item, visitors));
      } else if (child && typeof child === 'object' && (child as { type?: string }).type) {
        this.walkAST(child, visitors);
      }
    }
  }
}
