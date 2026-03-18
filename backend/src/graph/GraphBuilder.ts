import fs from 'fs';
import path from 'path';
import type { ParseResult, Graph, GraphNode, GraphEdge, Language, GraphMetadata } from '../types/index.js';

const TS_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
const PY_EXTENSIONS = ['.py', '/__init__.py'];
const JAVA_EXTENSIONS = ['.java'];
const GO_EXTENSIONS = ['.go'];

/**
 * GraphBuilder — converts ParseResults into a unified, normalized Graph.
 *
 * Responsibilities:
 *  - Create file-level nodes for each parsed file
 *  - Create function/class nodes as children
 *  - Resolve raw import strings → absolute file paths → node IDs
 *  - Create edges with appropriate confidence levels
 */
export class GraphBuilder {
  private nodes = new Map<string, GraphNode>();
  private edges = new Map<string, GraphEdge>();
  private goModulePathCache = new Map<string, string | null>();

  build(parseResults: ParseResult[], rootDir: string, allFiles: Set<string>): Graph {
    this.nodes.clear();
    this.edges.clear();
    this.goModulePathCache.clear();

    // Pass 1: Create all file nodes (needed for import resolution)
    for (const result of parseResults) {
      this.createFileNode(result, rootDir);
    }

    // Pass 2: Create function/class nodes + edges
    for (const result of parseResults) {
      this.createChildNodes(result, rootDir);
      this.createImportEdges(result, rootDir, allFiles);
    }

    const nodes = [...this.nodes.values()];
    const edges = [...this.edges.values()];

    const langCounts: Record<string, number> = {};
    for (const n of nodes.filter(n => n.type === 'file')) {
      langCounts[n.language] = (langCounts[n.language] ?? 0) + 1;
    }

    const metadata: GraphMetadata = {
      repoPath: rootDir,
      analyzedAt: new Date().toISOString(),
      totalFiles: parseResults.length,
      totalNodes: nodes.length,
      totalEdges: edges.length,
      languages: langCounts as GraphMetadata['languages'],
    };

    return { nodes, edges, metadata };
  }

  // ── Node creation ─────────────────────────────────────────────────────────

  private createFileNode(result: ParseResult, rootDir: string): void {
    const id = this.filePathToId(result.filePath, rootDir);
    const name = path.basename(result.filePath);

    const node: GraphNode = {
      id,
      name,
      type: 'file',
      language: result.language,
      filePath: result.filePath,
    };
    this.nodes.set(id, node);
  }

  private createChildNodes(result: ParseResult, rootDir: string): void {
    const fileId = this.filePathToId(result.filePath, rootDir);

    for (const rawNode of result.nodes) {
      const childId = `${fileId}#${rawNode.name}`;
      const node: GraphNode = {
        id: childId,
        name: rawNode.name,
        type: rawNode.type,
        language: result.language,
        filePath: result.filePath,
        line: rawNode.line,
      };
      this.nodes.set(childId, node);
    }
  }

  // ── Edge creation ─────────────────────────────────────────────────────────

  private createImportEdges(result: ParseResult, rootDir: string, allFiles: Set<string>): void {
    const fromId = this.filePathToId(result.filePath, rootDir);

    for (const importPath of result.imports) {
      const resolved = this.resolveImport(result.filePath, importPath, result.language, allFiles, rootDir);
      if (!resolved) continue;

      const toId = this.filePathToId(resolved, rootDir);
      if (!this.nodes.has(toId)) continue; // target not in analyzed set

      const edgeId = `${fromId}→${toId}`;
      if (this.edges.has(edgeId)) continue;

      const edge: GraphEdge = {
        id: edgeId,
        from: fromId,
        to: toId,
        type: 'import',
        confidence: importPath.startsWith('.') ? 'high'
          : (result.language === 'go' ? 'high' : 'medium'),
      };
      this.edges.set(edgeId, edge);
    }
  }

  // ── Import resolution ─────────────────────────────────────────────────────

  private resolveImport(
    fromFile: string,
    importPath: string,
    language: Language,
    allFiles: Set<string>,
    rootDir: string,
  ): string | null {
    // Ignore bare specifiers that are clearly npm packages
    if (!importPath.startsWith('.') && !importPath.startsWith('/') && language === 'typescript') {
      // Could be a path alias (tsconfig paths) — skip for now
      return null;
    }

    switch (language) {
      case 'typescript':
      case 'javascript':
        return this.resolveTS(fromFile, importPath, allFiles);
      case 'python':
        return this.resolvePython(fromFile, importPath, allFiles, rootDir);
      case 'java':
        return this.resolveJava(importPath, allFiles, rootDir);
      case 'go':
        return this.resolveGo(importPath, allFiles, rootDir);
      default:
        return null;
    }
  }

  private resolveTS(fromFile: string, importPath: string, allFiles: Set<string>): string | null {
    if (!importPath.startsWith('.')) return null;

    const dir = path.dirname(fromFile);
    const base = path.resolve(dir, importPath);

    // Try exact path first (already has extension)
    if (allFiles.has(base)) return base;

    for (const ext of TS_EXTENSIONS) {
      const candidate = ext.startsWith('/') ? base + ext : base + ext;
      if (allFiles.has(candidate)) return candidate;
    }

    return null;
  }

  private resolvePython(fromFile: string, importPath: string, allFiles: Set<string>, rootDir: string): string | null {
    let base: string;

    if (importPath.startsWith('.')) {
      // Relative import: count leading dots
      let dots = 0;
      while (importPath[dots] === '.') dots++;
      const modulePart = importPath.slice(dots).replace(/\./g, '/');

      let dir = path.dirname(fromFile);
      for (let i = 1; i < dots; i++) dir = path.dirname(dir);
      base = modulePart ? path.join(dir, modulePart) : dir;
    } else {
      // Absolute import relative to root
      base = path.join(rootDir, importPath.replace(/\./g, '/'));
    }

    for (const ext of PY_EXTENSIONS) {
      const candidate = ext.startsWith('/') ? base + ext : base + ext;
      if (allFiles.has(candidate)) return candidate;
    }

    return null;
  }

  private resolveJava(importPath: string, allFiles: Set<string>, rootDir: string): string | null {
    if (importPath.endsWith('.*')) return null; // wildcard import

    const filePath = importPath.replace(/\./g, '/');
    for (const ext of JAVA_EXTENSIONS) {
      // Try from src/main/java and src roots
      for (const srcRoot of ['', 'src/main/java/', 'src/', 'app/']) {
        const candidate = path.join(rootDir, srcRoot, filePath + ext);
        if (allFiles.has(candidate)) return candidate;
      }
    }
    return null;
  }

  /**
   * Read go.mod from the project root to get the module path.
   * Caches the result per rootDir.
   */
  private getGoModulePath(rootDir: string): string | null {
    if (this.goModulePathCache.has(rootDir)) {
      return this.goModulePathCache.get(rootDir)!;
    }

    const goModPath = path.join(rootDir, 'go.mod');
    let modulePath: string | null = null;

    try {
      const content = fs.readFileSync(goModPath, 'utf-8');
      const m = content.match(/^module\s+(\S+)/m);
      if (m) modulePath = m[1];
    } catch {
      // No go.mod found
    }

    this.goModulePathCache.set(rootDir, modulePath);
    return modulePath;
  }

  private resolveGo(importPath: string, allFiles: Set<string>, rootDir: string): string | null {
    const modulePath = this.getGoModulePath(rootDir);

    // Strategy 1: If we have go.mod and the import starts with the module path,
    // strip the module prefix and map to a local directory
    if (modulePath && importPath.startsWith(modulePath)) {
      const localPkg = importPath.slice(modulePath.length); // e.g. "/storeHouse" or "/workers"
      const pkgDir = localPkg.startsWith('/') ? localPkg.slice(1) : localPkg;

      // Find the first .go file in that package directory (Go imports point to packages/dirs, not files)
      // We create an edge to every .go file in that package
      let firstMatch: string | null = null;
      for (const file of allFiles) {
        if (!file.endsWith('.go')) continue;
        const rel = path.relative(rootDir, file).replace(/\\/g, '/');
        const fileDir = path.dirname(rel);

        if (fileDir === pkgDir || fileDir === `./${pkgDir}`) {
          // Return the first non-test file, or any file
          if (!file.endsWith('_test.go')) {
            return file;
          }
          if (!firstMatch) firstMatch = file;
        }
      }
      if (firstMatch) return firstMatch;
    }

    // Strategy 2: Fallback — match last path segments to directory names
    const parts = importPath.split('/');
    const lastPart = parts[parts.length - 1];

    for (const file of allFiles) {
      if (!file.endsWith('.go') || file.endsWith('_test.go')) continue;
      const rel = path.relative(rootDir, file).replace(/\\/g, '/');
      const fileDir = path.dirname(rel);

      // Match if the directory name equals the last segment of the import
      if (fileDir === lastPart) {
        return file;
      }
    }

    return null;
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  filePathToId(filePath: string, rootDir: string): string {
    return path.relative(rootDir, filePath).replace(/\\/g, '/');
  }
}
