// ─── Mirrors backend types ──────────────────────────────────────────────────

export type NodeType = 'file' | 'function' | 'class';
export type EdgeType = 'import' | 'call' | 're-export';
export type Confidence = 'high' | 'medium' | 'low';
export type Language = 'typescript' | 'javascript' | 'python' | 'java' | 'go' | 'unknown';

export interface GraphNode {
  id: string;
  name: string;
  type: NodeType;
  language: Language;
  filePath: string;
  line?: number;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
  confidence: Confidence;
}

export interface GraphMetadata {
  repoPath: string;
  analyzedAt: string;
  totalFiles: number;
  totalNodes: number;
  totalEdges: number;
  languages: Record<Language, number>;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: GraphMetadata;
}

export interface ImpactResult {
  nodeId: string;
  impactedNodes: GraphNode[];
  dependencyNodes: GraphNode[];
  maxImpactDepth: number;
}

// ─── UI State Types ─────────────────────────────────────────────────────────

export type NodeVisualState = 'default' | 'selected' | 'impacted' | 'dependency' | 'dimmed';

export type AnalysisStatus = 'idle' | 'analyzing' | 'complete' | 'error';

// ─── Language Metadata ──────────────────────────────────────────────────────

export const LANGUAGE_CONFIG: Record<Language, { color: string; label: string; icon: string }> = {
  typescript: { color: '#3178c6', label: 'TypeScript', icon: 'TS' },
  javascript: { color: '#f7df1e', label: 'JavaScript', icon: 'JS' },
  python:     { color: '#3572A5', label: 'Python',     icon: 'PY' },
  java:       { color: '#f89820', label: 'Java',       icon: 'JA' },
  go:         { color: '#00ADD8', label: 'Go',         icon: 'GO' },
  unknown:    { color: '#6b7280', label: 'Unknown',    icon: '??' },
};

// ─── Chat Types ──────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatContext {
  graphSummary: {
    repoPath: string;
    totalFiles: number;
    totalNodes: number;
    totalEdges: number;
    languages: Record<string, number>;
  };
  selectedNode?: {
    id: string;
    name: string;
    type: NodeType;
    language: Language;
    filePath: string;
  };
  directDependencies?: Array<{ id: string; name: string; language: Language }>;
  directDependents?: Array<{ id: string; name: string; language: Language }>;
  impactStats?: {
    totalImpacted: number;
    totalDependencies: number;
    maxImpactDepth: number;
  };
  criticalNodes?: Array<{ name: string; dependentCount: number }>;
}
