import path from 'path';
import type { ParserPlugin } from '../PluginInterface.js';
import type { ParseContext, ParseResult } from '../../types/index.js';

interface PythonAST {
  imports: PythonImport[];
  definitions: PythonDefinition[];
  exports: string[];
}

interface PythonImport {
  module: string;
  names: string[];
  isFrom: boolean;
  isRelative: boolean;
  relativeLevel: number;
}

interface PythonDefinition {
  name: string;
  type: 'function' | 'class';
  line: number;
}

/**
 * Python parser plugin using regex-based static analysis.
 * Handles: import X, from X import Y, from . import Y (relative), def, class.
 */
export class PythonPlugin implements ParserPlugin {
  readonly language = 'python' as const;
  readonly fileExtensions = ['py'];

  canHandle(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === '.py';
  }

  parse(content: string, _context: ParseContext): PythonAST {
    return {
      imports: this.parseImports(content),
      definitions: this.parseDefinitions(content),
      exports: this.parseExports(content),
    };
  }

  extractNodes(ast: unknown, _context: ParseContext): ParseResult['nodes'] {
    const pythonAst = ast as PythonAST;
    return pythonAst.definitions.map(d => ({
      name: d.name,
      type: d.type,
      line: d.line,
    }));
  }

  extractImports(ast: unknown, _context: ParseContext): string[] {
    const pythonAst = ast as PythonAST;
    return pythonAst.imports.map(imp => {
      if (imp.isRelative) {
        // Convert relative import to a path-like string for resolution
        const dots = '.'.repeat(imp.relativeLevel);
        return imp.module ? `${dots}${imp.module}` : dots;
      }
      return imp.module;
    });
  }

  extractExports(ast: unknown, _context: ParseContext): string[] {
    const pythonAst = ast as PythonAST;
    return pythonAst.exports;
  }

  // ── Private parsing methods ───────────────────────────────────────────────

  private parseImports(content: string): PythonImport[] {
    const imports: PythonImport[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // from .module import X  /  from ..module import X  /  from module import X
      const fromMatch = line.match(/^from\s+(\.{0,})(\S*)\s+import\s+(.+)$/);
      if (fromMatch) {
        const [, dots, module, names] = fromMatch;
        const relativeLevel = dots.length;
        const nameList = names.split(',').map(n => n.trim().split(' as ')[0].trim()).filter(Boolean);
        imports.push({
          module: module || '',
          names: nameList,
          isFrom: true,
          isRelative: relativeLevel > 0,
          relativeLevel,
        });
        continue;
      }

      // import X, Y, Z  /  import X as Y
      const importMatch = line.match(/^import\s+(.+)$/);
      if (importMatch) {
        const parts = importMatch[1].split(',').map(p => p.trim().split(' as ')[0].trim());
        for (const part of parts) {
          imports.push({
            module: part,
            names: [],
            isFrom: false,
            isRelative: false,
            relativeLevel: 0,
          });
        }
      }
    }

    return imports;
  }

  private parseDefinitions(content: string): PythonDefinition[] {
    const defs: PythonDefinition[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const fnMatch = line.match(/^(?:    )*def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
      if (fnMatch && !fnMatch[1].startsWith('_')) {
        defs.push({ name: fnMatch[1], type: 'function', line: i + 1 });
        continue;
      }
      const classMatch = line.match(/^class\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*[:(]/);
      if (classMatch) {
        defs.push({ name: classMatch[1], type: 'class', line: i + 1 });
      }
    }

    return defs;
  }

  private parseExports(content: string): string[] {
    // Check for __all__ = [...]
    const allMatch = content.match(/__all__\s*=\s*\[([^\]]+)\]/s);
    if (allMatch) {
      return allMatch[1]
        .split(',')
        .map(s => s.trim().replace(/['"]/g, ''))
        .filter(Boolean);
    }
    return [];
  }
}
