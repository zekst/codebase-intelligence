import type { Graph, GraphNode, GraphEdge, ImpactResult } from '../types/index.js';

/**
 * ImpactAnalyzer — traverses the dependency graph to determine
 * the "blast radius" of changes to any given node.
 *
 * Two traversals:
 *  1. Reverse (impact): who depends on me? → BFS over reverse adjacency
 *  2. Forward (deps):   what do I depend on? → BFS over forward adjacency
 */
export class ImpactAnalyzer {
  /** Adjacency list: nodeId → [nodes it imports] */
  private forward = new Map<string, Set<string>>();
  /** Reverse adjacency: nodeId → [nodes that import it] */
  private reverse = new Map<string, Set<string>>();
  /** Quick lookup */
  private nodeMap = new Map<string, GraphNode>();

  constructor(private graph: Graph) {
    this.buildAdjacency();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  analyze(nodeId: string): ImpactResult {
    const node = this.nodeMap.get(nodeId);
    if (!node) {
      return { nodeId, impactedNodes: [], dependencyNodes: [], maxImpactDepth: 0 };
    }

    // If it's a function/class node, analyze the parent file instead
    const fileNodeId = nodeId.includes('#') ? nodeId.split('#')[0] : nodeId;

    const { visited: impactedSet, maxDepth } = this.bfs(fileNodeId, this.reverse);
    const { visited: depSet } = this.bfs(fileNodeId, this.forward);

    // Remove the source node itself from both sets
    impactedSet.delete(fileNodeId);
    depSet.delete(fileNodeId);

    const impactedNodes = this.resolveNodes(impactedSet);
    const dependencyNodes = this.resolveNodes(depSet);

    return {
      nodeId,
      impactedNodes,
      dependencyNodes,
      maxImpactDepth: maxDepth,
    };
  }

  /** Get direct dependents (1 level) */
  getDirectDependents(nodeId: string): GraphNode[] {
    const fileId = nodeId.includes('#') ? nodeId.split('#')[0] : nodeId;
    const deps = this.reverse.get(fileId);
    if (!deps) return [];
    return this.resolveNodes(deps);
  }

  /** Get direct dependencies (1 level) */
  getDirectDependencies(nodeId: string): GraphNode[] {
    const fileId = nodeId.includes('#') ? nodeId.split('#')[0] : nodeId;
    const deps = this.forward.get(fileId);
    if (!deps) return [];
    return this.resolveNodes(deps);
  }

  /** Get most critical nodes (nodes with highest reverse-dependency count) */
  getCriticalNodes(limit = 10): Array<{ node: GraphNode; dependentCount: number }> {
    const scores: Array<{ node: GraphNode; dependentCount: number }> = [];

    for (const [nodeId] of this.reverse) {
      const node = this.nodeMap.get(nodeId);
      if (!node || node.type !== 'file') continue;

      const { visited } = this.bfs(nodeId, this.reverse);
      visited.delete(nodeId);
      scores.push({ node, dependentCount: visited.size });
    }

    return scores.sort((a, b) => b.dependentCount - a.dependentCount).slice(0, limit);
  }

  // ── Graph traversal ───────────────────────────────────────────────────────

  private bfs(startId: string, adjacency: Map<string, Set<string>>): { visited: Set<string>; maxDepth: number } {
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];
    let maxDepth = 0;

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      maxDepth = Math.max(maxDepth, depth);

      const neighbors = adjacency.get(id);
      if (!neighbors) continue;

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push({ id: neighbor, depth: depth + 1 });
        }
      }
    }

    return { visited, maxDepth };
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private buildAdjacency(): void {
    for (const node of this.graph.nodes) {
      this.nodeMap.set(node.id, node);
      if (!this.forward.has(node.id)) this.forward.set(node.id, new Set());
      if (!this.reverse.has(node.id)) this.reverse.set(node.id, new Set());
    }

    for (const edge of this.graph.edges) {
      // edge.from imports edge.to → forward[from] includes to
      this.getOrCreate(this.forward, edge.from).add(edge.to);
      this.getOrCreate(this.reverse, edge.to).add(edge.from);
    }
  }

  private getOrCreate(map: Map<string, Set<string>>, key: string): Set<string> {
    let set = map.get(key);
    if (!set) { set = new Set(); map.set(key, set); }
    return set;
  }

  private resolveNodes(ids: Set<string> | Iterable<string>): GraphNode[] {
    const result: GraphNode[] = [];
    for (const id of ids) {
      const node = this.nodeMap.get(id);
      if (node) result.push(node);
    }
    return result;
  }
}
