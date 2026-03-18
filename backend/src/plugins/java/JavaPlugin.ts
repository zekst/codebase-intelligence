import path from 'path';
import type { ParserPlugin } from '../PluginInterface.js';
import type { ParseContext, ParseResult } from '../../types/index.js';

interface JavaAST {
  packageName: string;
  imports: string[];
  definitions: { name: string; type: 'function' | 'class'; line: number }[];
}

/**
 * Java parser plugin using regex-based static analysis.
 * Handles: import statements, class and method declarations.
 */
export class JavaPlugin implements ParserPlugin {
  readonly language = 'java' as const;
  readonly fileExtensions = ['java'];

  canHandle(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === '.java';
  }

  parse(content: string, _context: ParseContext): JavaAST {
    return {
      packageName: this.parsePackage(content),
      imports: this.parseImports(content),
      definitions: this.parseDefinitions(content),
    };
  }

  extractNodes(ast: unknown, _context: ParseContext): ParseResult['nodes'] {
    return (ast as JavaAST).definitions.map(d => ({
      name: d.name,
      type: d.type,
      line: d.line,
    }));
  }

  extractImports(ast: unknown, _context: ParseContext): string[] {
    return (ast as JavaAST).imports;
  }

  extractExports(ast: unknown, _context: ParseContext): string[] {
    // Java exports everything public — return class names
    return (ast as JavaAST).definitions
      .filter(d => d.type === 'class')
      .map(d => d.name);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private parsePackage(content: string): string {
    const m = content.match(/^\s*package\s+([\w.]+)\s*;/m);
    return m ? m[1] : '';
  }

  private parseImports(content: string): string[] {
    const imports: string[] = [];
    const regex = /^\s*import\s+(?:static\s+)?([\w.]+(?:\.\*)?)\s*;/gm;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(content)) !== null) {
      imports.push(m[1]);
    }
    return imports;
  }

  private parseDefinitions(content: string): JavaAST['definitions'] {
    const defs: JavaAST['definitions'] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Class / Interface / Enum / Record declarations
      const classMatch = line.match(
        /(?:public|protected|private)?\s*(?:abstract|final|sealed)?\s*(?:class|interface|enum|record)\s+([A-Z][a-zA-Z0-9_]*)/,
      );
      if (classMatch) {
        defs.push({ name: classMatch[1], type: 'class', line: i + 1 });
        continue;
      }

      // Method declarations (must have return type + name + paren)
      const methodMatch = line.match(
        /(?:public|protected|private)\s+(?:static\s+)?(?:final\s+)?(?:[\w<>\[\],\s]+)\s+([a-z][a-zA-Z0-9_]*)\s*\(/,
      );
      if (methodMatch && !line.includes('=') && !line.includes('new ')) {
        defs.push({ name: methodMatch[1], type: 'function', line: i + 1 });
      }
    }

    return defs;
  }
}
