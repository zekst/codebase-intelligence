import path from 'path';
import type { ParserPlugin } from '../PluginInterface.js';
import type { ParseContext, ParseResult } from '../../types/index.js';

interface GoAST {
  packageName: string;
  imports: string[];
  definitions: { name: string; type: 'function' | 'class'; line: number }[];
}

// Go standard library top-level packages (used to skip stdlib imports)
const GO_STDLIB = new Set([
  'archive', 'bufio', 'builtin', 'bytes', 'cmp', 'compress', 'container',
  'context', 'crypto', 'database', 'debug', 'embed', 'encoding', 'errors',
  'expvar', 'flag', 'fmt', 'go', 'hash', 'html', 'image', 'index', 'io',
  'iter', 'log', 'maps', 'math', 'mime', 'net', 'os', 'path', 'plugin',
  'reflect', 'regexp', 'runtime', 'slices', 'sort', 'strconv', 'strings',
  'structs', 'sync', 'syscall', 'testing', 'text', 'time', 'unicode', 'unsafe',
]);

/**
 * Go parser plugin using regex-based static analysis.
 * Handles: import "pkg", import ( "pkg1"\n "pkg2" ), func, type struct.
 */
export class GoPlugin implements ParserPlugin {
  readonly language = 'go' as const;
  readonly fileExtensions = ['go'];

  canHandle(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === '.go';
  }

  parse(content: string, _context: ParseContext): GoAST {
    return {
      packageName: this.parsePackage(content),
      imports: this.parseImports(content),
      definitions: this.parseDefinitions(content),
    };
  }

  extractNodes(ast: unknown, _context: ParseContext): ParseResult['nodes'] {
    return (ast as GoAST).definitions.map(d => ({
      name: d.name,
      type: d.type,
      line: d.line,
    }));
  }

  extractImports(ast: unknown, _context: ParseContext): string[] {
    return (ast as GoAST).imports;
  }

  extractExports(ast: unknown, _context: ParseContext): string[] {
    // Go exports identifiers starting with uppercase
    return (ast as GoAST).definitions
      .filter(d => /^[A-Z]/.test(d.name))
      .map(d => d.name);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private parsePackage(content: string): string {
    const m = content.match(/^\s*package\s+(\w+)/m);
    return m ? m[1] : '';
  }

  private parseImports(content: string): string[] {
    const imports: string[] = [];

    // Single import: import "pkg"  or  import alias "pkg"
    const singleRe = /^\s*import\s+(?:\w+\s+)?"([^"]+)"/gm;
    let m: RegExpExecArray | null;
    while ((m = singleRe.exec(content)) !== null) {
      imports.push(m[1]);
    }

    // Import blocks: import ( ... ) — match ALL blocks, not just the first
    const blockRe = /import\s*\(([\s\S]*?)\)/g;
    while ((m = blockRe.exec(content)) !== null) {
      const block = m[1];
      const lineRe = /(?:\w+\s+)?"([^"]+)"/g;
      let lm: RegExpExecArray | null;
      while ((lm = lineRe.exec(block)) !== null) {
        imports.push(lm[1]);
      }
    }

    // Filter out Go stdlib imports — only keep third-party/local module imports
    const filtered = imports.filter(imp => {
      const topPkg = imp.split('/')[0];
      // Stdlib packages have no dots in the first segment
      // Third-party/module imports always have a domain like github.com, golang.org, etc.
      return topPkg.includes('.') || !GO_STDLIB.has(topPkg);
    });

    return [...new Set(filtered)];
  }

  private parseDefinitions(content: string): GoAST['definitions'] {
    const defs: GoAST['definitions'] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // func FuncName(  /  func (recv) FuncName(
      const funcMatch = line.match(/^func\s+(?:\([^)]+\)\s+)?([A-Za-z_][a-zA-Z0-9_]*)\s*\(/);
      if (funcMatch) {
        defs.push({ name: funcMatch[1], type: 'function', line: i + 1 });
        continue;
      }

      // type StructName struct {  /  type InterfaceName interface {
      const typeMatch = line.match(/^type\s+([A-Za-z_][a-zA-Z0-9_]*)\s+(?:struct|interface)/);
      if (typeMatch) {
        defs.push({ name: typeMatch[1], type: 'class', line: i + 1 });
      }
    }

    return defs;
  }
}
