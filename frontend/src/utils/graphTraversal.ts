import type { GraphNode, GraphEdge } from '../types';

/**
 * Client-side graph traversal for instant impact feedback.
 * Mirrors the backend ImpactAnalyzer but runs in the browser.
 */

interface AdjacencyMap {
  /** forward[A] = set of nodes A imports */
  forward: Map<string, Set<string>>;
  /** reverse[A] = set of nodes that import A */
  reverse: Map<string, Set<string>>;
}

export function buildAdjacency(edges: GraphEdge[]): AdjacencyMap {
  const forward = new Map<string, Set<string>>();
  const reverse = new Map<string, Set<string>>();

  for (const edge of edges) {
    if (!forward.has(edge.from)) forward.set(edge.from, new Set());
    if (!reverse.has(edge.to)) reverse.set(edge.to, new Set());
    forward.get(edge.from)!.add(edge.to);
    reverse.get(edge.to)!.add(edge.from);
  }

  return { forward, reverse };
}

/** BFS from startId using the given adjacency direction */
export function bfsTraverse(
  startId: string,
  adjacency: Map<string, Set<string>>,
): Set<string> {
  const visited = new Set<string>();
  const queue = [startId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const neighbors = adjacency.get(current);
    if (neighbors) {
      for (const n of neighbors) {
        if (!visited.has(n)) queue.push(n);
      }
    }
  }

  visited.delete(startId);
  return visited;
}

/** Compute impact + dependencies for a node using client-side BFS */
export function computeImpact(
  nodeId: string,
  edges: GraphEdge[],
): { impactedIds: Set<string>; dependencyIds: Set<string> } {
  // For function/class nodes, analyze the parent file
  const fileId = nodeId.includes('#') ? nodeId.split('#')[0] : nodeId;

  const { forward, reverse } = buildAdjacency(edges);
  const impactedIds = bfsTraverse(fileId, reverse);
  const dependencyIds = bfsTraverse(fileId, forward);

  return { impactedIds, dependencyIds };
}

/** Find shortest path between two nodes using BFS */
export function findPath(
  fromId: string,
  toId: string,
  edges: GraphEdge[],
): string[] | null {
  const { forward } = buildAdjacency(edges);
  const visited = new Set<string>();
  const queue: Array<{ id: string; path: string[] }> = [{ id: fromId, path: [fromId] }];

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    if (id === toId) return path;
    if (visited.has(id)) continue;
    visited.add(id);

    const neighbors = forward.get(id);
    if (neighbors) {
      for (const n of neighbors) {
        if (!visited.has(n)) {
          queue.push({ id: n, path: [...path, n] });
        }
      }
    }
  }

  return null;
}
