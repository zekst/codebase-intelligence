import type { Language, ParseResult, ParseContext } from '../types/index.js';

/**
 * ParserPlugin — contract every language plugin must implement.
 *
 * Lifecycle:
 *   1. The pipeline calls `canHandle(filePath)` to find the right plugin.
 *   2. `parse(content, context)` returns a language-specific AST.
 *   3. `extractNodes` + `extractImports` + `extractExports` mine the AST.
 *   4. Results are merged into a `ParseResult` by the pipeline.
 */
export interface ParserPlugin {
  /** Human-readable language identifier */
  readonly language: Language;
  /** File extensions this plugin handles (without dot, e.g. ["ts", "tsx"]) */
  readonly fileExtensions: string[];

  /** Returns true if this plugin should handle the given file */
  canHandle(filePath: string): boolean;

  /**
   * Parse raw file content into an intermediate AST/structure.
   * Implementations MUST be tolerant — partial parses are acceptable.
   */
  parse(content: string, context: ParseContext): unknown;

  /**
   * Extract function and class nodes from the parsed AST.
   * File-level node is created by the pipeline automatically.
   */
  extractNodes(ast: unknown, context: ParseContext): ParseResult['nodes'];

  /**
   * Extract raw import/dependency strings.
   * Return exactly what appears in source — resolution happens in GraphBuilder.
   */
  extractImports(ast: unknown, context: ParseContext): string[];

  /**
   * Extract exported symbol names.
   */
  extractExports(ast: unknown, context: ParseContext): string[];
}

/** Convenience helper — builds a full ParseResult from plugin outputs */
export function buildParseResult(
  plugin: ParserPlugin,
  content: string,
  context: ParseContext,
): ParseResult {
  const errors: string[] = [];
  let ast: unknown = null;

  try {
    ast = plugin.parse(content, context);
  } catch (err) {
    errors.push(`Parse error: ${(err as Error).message}`);
  }

  let nodes: ParseResult['nodes'] = [];
  let imports: string[] = [];
  let exports: string[] = [];

  if (ast !== null) {
    try { nodes = plugin.extractNodes(ast, context); } catch (e) { errors.push(`Node extraction: ${(e as Error).message}`); }
    try { imports = plugin.extractImports(ast, context); } catch (e) { errors.push(`Import extraction: ${(e as Error).message}`); }
    try { exports = plugin.extractExports(ast, context); } catch (e) { errors.push(`Export extraction: ${(e as Error).message}`); }
  }

  return {
    filePath: context.filePath,
    language: plugin.language,
    nodes,
    imports,
    exports,
    errors,
  };
}
