import dagre from 'dagre';
import type { Node as FlowNode, Edge as FlowEdge } from 'reactflow';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;

export type LayoutDirection = 'LR' | 'TB' | 'RL' | 'BT';

export interface LayoutOptions {
  direction?: LayoutDirection;
  nodeSep?: number;
  rankSep?: number;
  edgeSep?: number;
}

/**
 * Compute automatic graph layout using dagre.
 * Returns new node array with updated positions.
 */
export function layoutGraph(
  nodes: FlowNode[],
  edges: FlowEdge[],
  options: LayoutOptions = {},
): FlowNode[] {
  const {
    direction = 'LR',
    nodeSep = 50,
    rankSep = 120,
    edgeSep = 20,
  } = options;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: nodeSep, ranksep: rankSep, edgesep: edgeSep });

  nodes.forEach(node => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach(edge => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map(node => {
    const nodeWithPosition = g.node(node.id);
    if (!nodeWithPosition) return node;
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });
}
