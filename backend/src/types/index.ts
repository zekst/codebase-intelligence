// ─── Core Graph Model ───────────────────────────────────────────────────────

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
  /** Line number in file (for function/class nodes) */
  line?: number;
  /** Extra metadata */
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
  confidence: Confidence;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: GraphMetadata;
}

export interface GraphMetadata {
  repoPath: string;
  analyzedAt: string;
  totalFiles: number;
  totalNodes: number;
  totalEdges: number;
  languages: Record<Language, number>;
}

// ─── Parser Plugin Types ──────────────────────────────────────────────────────

export interface RawNode {
  name: string;
  type: 'function' | 'class';
  line?: number;
}

export interface ParseResult {
  filePath: string;
  language: Language;
  nodes: RawNode[];
  /** Raw import strings exactly as they appear in source */
  imports: string[];
  /** Exported symbol names */
  exports: string[];
  /** Parse errors encountered */
  errors: string[];
}

export interface ParseContext {
  filePath: string;
  rootDir: string;
  allFiles: Set<string>;
}

// ─── Analysis Results ─────────────────────────────────────────────────────────

export interface ImpactResult {
  nodeId: string;
  /** Nodes that will be affected if this node changes */
  impactedNodes: GraphNode[];
  /** Nodes this node depends on */
  dependencyNodes: GraphNode[];
  /** Depth of impact */
  maxImpactDepth: number;
}

// ─── API Types ────────────────────────────────────────────────────────────────

export interface AnalyzeRequest {
  /** Local filesystem path */
  repoPath?: string;
  /** Git URL to clone and analyze */
  gitUrl?: string;
  /** Optional: only analyze specific languages */
  languages?: Language[];
  /** Max file size in bytes (default 500KB) */
  maxFileSize?: number;
}

export interface AnalyzeResponse {
  success: boolean;
  graph?: Graph;
  error?: string;
  duration?: number;
}

// ─── Chat Types ──────────────────────────────────────────────────────────────

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

export interface ChatRequest {
  message: string;
  context: ChatContext;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface ChatResponse {
  success: boolean;
  reply?: string;
  error?: string;
}
