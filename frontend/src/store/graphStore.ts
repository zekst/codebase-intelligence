import { create } from 'zustand';
import axios from 'axios';
import type { Node as FlowNode, Edge as FlowEdge } from 'reactflow';
import type {
  Graph,
  GraphNode,
  GraphEdge,
  AnalysisStatus,
  NodeVisualState,
  Language,
} from '../types';
import { LANGUAGE_CONFIG } from '../types';
import { computeImpact } from '../utils/graphTraversal';
import { layoutGraph } from '../utils/layoutEngine';

// ─── Store shape ────────────────────────────────────────────────────────────

interface GraphStore {
  // Data
  graph: Graph | null;
  flowNodes: FlowNode[];
  flowEdges: FlowEdge[];

  // Selection state
  selectedNodeId: string | null;
  impactedNodeIds: Set<string>;
  dependencyNodeIds: Set<string>;

  // UI state
  status: AnalysisStatus;
  error: string | null;
  repoPath: string;
  gitUrl: string;
  searchQuery: string;
  languageFilter: Set<Language>;
  showFileNodesOnly: boolean;

  // Actions
  analyzeRepo: (repoPath: string) => Promise<void>;
  analyzeGitRepo: (gitUrl: string) => Promise<void>;
  analyzeUpload: (files: FileList) => Promise<void>;
  selectNode: (nodeId: string | null) => void;
  setRepoPath: (path: string) => void;
  setGitUrl: (url: string) => void;
  setSearchQuery: (query: string) => void;
  toggleLanguageFilter: (lang: Language) => void;
  setShowFileNodesOnly: (show: boolean) => void;
  updateFlowNodes: (nodes: FlowNode[]) => void;
  updateFlowEdges: (edges: FlowEdge[]) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getNodeState(
  nodeId: string,
  selectedId: string | null,
  impacted: Set<string>,
  deps: Set<string>,
): NodeVisualState {
  if (!selectedId) return 'default';
  if (nodeId === selectedId) return 'selected';
  const fileId = nodeId.includes('#') ? nodeId.split('#')[0] : nodeId;
  if (impacted.has(fileId)) return 'impacted';
  if (deps.has(fileId)) return 'dependency';
  return 'dimmed';
}

function toFlowNodes(
  nodes: GraphNode[],
  selectedId: string | null,
  impacted: Set<string>,
  deps: Set<string>,
  filter: Set<Language>,
  searchQuery: string,
  fileOnly: boolean,
): FlowNode[] {
  return nodes
    .filter(n => {
      if (fileOnly && n.type !== 'file') return false;
      if (filter.size > 0 && !filter.has(n.language)) return false;
      if (searchQuery && !n.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !n.id.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .map(n => {
      const state = getNodeState(n.id, selectedId, impacted, deps);
      const langConf = LANGUAGE_CONFIG[n.language] ?? LANGUAGE_CONFIG.unknown;
      return {
        id: n.id,
        type: 'custom',
        position: { x: 0, y: 0 },
        data: {
          label: n.name,
          name: n.name,
          nodeType: n.type,
          language: n.language,
          languageColor: langConf.color,
          languageIcon: langConf.icon,
          filePath: n.filePath,
          line: n.line,
          state,
          depCount: 0,
          impactCount: 0,
        },
      };
    });
}

function toFlowEdges(
  edges: GraphEdge[],
  visibleNodes: Set<string>,
  selectedId: string | null,
  impacted: Set<string>,
  deps: Set<string>,
): FlowEdge[] {
  return edges
    .filter(e => visibleNodes.has(e.from) && visibleNodes.has(e.to))
    .map(e => {
      let strokeColor = '#334155';
      let animated = false;

      if (selectedId) {
        const fromState = getNodeState(e.from, selectedId, impacted, deps);
        const toState = getNodeState(e.to, selectedId, impacted, deps);

        if (fromState === 'dimmed' && toState === 'dimmed') {
          strokeColor = '#1e293b20';
        } else if (fromState === 'selected' || toState === 'selected') {
          strokeColor = '#818cf8';
          animated = true;
        } else if (fromState === 'impacted' || toState === 'impacted') {
          strokeColor = '#f59e0b';
          animated = true;
        } else if (fromState === 'dependency' || toState === 'dependency') {
          strokeColor = '#60a5fa';
          animated = true;
        }
      }

      return {
        id: e.id,
        source: e.from,
        target: e.to,
        type: 'custom',
        animated,
        data: { edgeType: e.type, confidence: e.confidence },
        style: { stroke: strokeColor, strokeWidth: animated ? 2 : 1 },
      };
    });
}

function addCounts(
  flowNodes: FlowNode[],
  edges: GraphEdge[],
): FlowNode[] {
  const depCounts = new Map<string, number>();
  const impCounts = new Map<string, number>();

  for (const e of edges) {
    depCounts.set(e.from, (depCounts.get(e.from) ?? 0) + 1);
    impCounts.set(e.to, (impCounts.get(e.to) ?? 0) + 1);
  }

  return flowNodes.map(n => ({
    ...n,
    data: {
      ...n.data,
      depCount: depCounts.get(n.id) ?? 0,
      impactCount: impCounts.get(n.id) ?? 0,
    },
  }));
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useGraphStore = create<GraphStore>((set, get) => ({
  graph: null,
  flowNodes: [],
  flowEdges: [],
  selectedNodeId: null,
  impactedNodeIds: new Set(),
  dependencyNodeIds: new Set(),
  status: 'idle',
  error: null,
  repoPath: '',
  gitUrl: '',
  searchQuery: '',
  languageFilter: new Set(),
  showFileNodesOnly: true,

  analyzeRepo: async (repoPath: string) => {
    set({ status: 'analyzing', error: null });
    try {
      const resp = await axios.post<{ success: boolean; graph: Graph; error?: string }>('/api/analyze', { repoPath });
      if (!resp.data.success) throw new Error(resp.data.error || 'Analysis failed');

      const graph = resp.data.graph;

      const rawFlowNodes = toFlowNodes(
        graph.nodes, null, new Set(), new Set(),
        get().languageFilter, get().searchQuery, get().showFileNodesOnly,
      );
      const visibleIds = new Set(rawFlowNodes.map(n => n.id));
      const rawFlowEdges = toFlowEdges(graph.edges, visibleIds, null, new Set(), new Set());
      const layoutedNodes = layoutGraph(rawFlowNodes, rawFlowEdges);
      const flowNodes = addCounts(layoutedNodes, graph.edges);

      set({
        graph,
        flowNodes,
        flowEdges: rawFlowEdges,
        selectedNodeId: null,
        impactedNodeIds: new Set(),
        dependencyNodeIds: new Set(),
        status: 'complete',
      });
    } catch (err) {
      set({ status: 'error', error: (err as Error).message });
    }
  },

  analyzeGitRepo: async (gitUrl: string) => {
    set({ status: 'analyzing', error: null });
    try {
      const resp = await axios.post<{ success: boolean; graph: Graph; error?: string }>('/api/analyze', { gitUrl });
      if (!resp.data.success) throw new Error(resp.data.error || 'Analysis failed');

      const graph = resp.data.graph;
      const rawFlowNodes = toFlowNodes(
        graph.nodes, null, new Set(), new Set(),
        get().languageFilter, get().searchQuery, get().showFileNodesOnly,
      );
      const visibleIds = new Set(rawFlowNodes.map(n => n.id));
      const rawFlowEdges = toFlowEdges(graph.edges, visibleIds, null, new Set(), new Set());
      const layoutedNodes = layoutGraph(rawFlowNodes, rawFlowEdges);
      const flowNodes = addCounts(layoutedNodes, graph.edges);

      set({
        graph, flowNodes, flowEdges: rawFlowEdges,
        selectedNodeId: null, impactedNodeIds: new Set(), dependencyNodeIds: new Set(),
        status: 'complete',
      });
    } catch (err) {
      set({ status: 'error', error: (err as Error).message });
    }
  },

  analyzeUpload: async (files: FileList) => {
    set({ status: 'analyzing', error: null });
    try {
      const supported = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'java', 'go']);
      const skipDirs = ['node_modules', '.git', 'dist', 'build', '__pycache__', 'vendor', '.next', 'coverage'];

      const formData = new FormData();
      let count = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const relativePath = (file as any).webkitRelativePath || file.name;

        // Skip files in ignored directories
        if (skipDirs.some(d => relativePath.includes(`/${d}/`) || relativePath.includes(`\\${d}\\`))) continue;

        // Only include supported source files
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
        if (!supported.has(ext)) continue;

        // Skip large files (> 1MB)
        if (file.size > 1024 * 1024) continue;

        formData.append('files', file, relativePath);
        count++;
      }

      if (count === 0) {
        set({ status: 'error', error: 'No supported source files found in the selected folder.' });
        return;
      }

      const resp = await axios.post<{ success: boolean; graph: Graph; error?: string }>(
        '/api/upload-analyze', formData,
        { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 },
      );
      if (!resp.data.success) throw new Error(resp.data.error || 'Analysis failed');

      const graph = resp.data.graph;
      const rawFlowNodes = toFlowNodes(
        graph.nodes, null, new Set(), new Set(),
        get().languageFilter, get().searchQuery, get().showFileNodesOnly,
      );
      const visibleIds = new Set(rawFlowNodes.map(n => n.id));
      const rawFlowEdges = toFlowEdges(graph.edges, visibleIds, null, new Set(), new Set());
      const layoutedNodes = layoutGraph(rawFlowNodes, rawFlowEdges);
      const flowNodes = addCounts(layoutedNodes, graph.edges);

      set({
        graph, flowNodes, flowEdges: rawFlowEdges,
        selectedNodeId: null, impactedNodeIds: new Set(), dependencyNodeIds: new Set(),
        status: 'complete',
      });
    } catch (err) {
      set({ status: 'error', error: (err as Error).message });
    }
  },

  selectNode: (nodeId: string | null) => {
    const { graph, languageFilter, searchQuery, showFileNodesOnly } = get();
    if (!graph) return;

    let impacted = new Set<string>();
    let deps = new Set<string>();

    if (nodeId) {
      const result = computeImpact(nodeId, graph.edges);
      impacted = result.impactedIds;
      deps = result.dependencyIds;
    }

    const rawFlowNodes = toFlowNodes(
      graph.nodes, nodeId, impacted, deps,
      languageFilter, searchQuery, showFileNodesOnly,
    );
    const visibleIds = new Set(rawFlowNodes.map(n => n.id));
    const flowEdges = toFlowEdges(graph.edges, visibleIds, nodeId, impacted, deps);
    const flowNodes = addCounts(rawFlowNodes, graph.edges);

    // Keep existing positions
    const posMap = new Map(get().flowNodes.map(n => [n.id, n.position]));
    const updatedNodes = flowNodes.map(n => ({
      ...n,
      position: posMap.get(n.id) ?? n.position,
    }));

    set({
      selectedNodeId: nodeId,
      impactedNodeIds: impacted,
      dependencyNodeIds: deps,
      flowNodes: updatedNodes,
      flowEdges: flowEdges,
    });
  },

  setRepoPath: (path: string) => set({ repoPath: path }),
  setGitUrl: (url: string) => set({ gitUrl: url }),
  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
    // Rebuild view
    const { graph, selectedNodeId, impactedNodeIds, dependencyNodeIds, languageFilter, showFileNodesOnly } = get();
    if (!graph) return;
    const rawFlowNodes = toFlowNodes(
      graph.nodes, selectedNodeId, impactedNodeIds, dependencyNodeIds,
      languageFilter, query, showFileNodesOnly,
    );
    const visibleIds = new Set(rawFlowNodes.map(n => n.id));
    const flowEdges = toFlowEdges(graph.edges, visibleIds, selectedNodeId, impactedNodeIds, dependencyNodeIds);
    const layoutedNodes = layoutGraph(rawFlowNodes, flowEdges);
    const flowNodes = addCounts(layoutedNodes, graph.edges);
    set({ flowNodes, flowEdges });
  },

  toggleLanguageFilter: (lang: Language) => {
    const { languageFilter } = get();
    const next = new Set(languageFilter);
    if (next.has(lang)) next.delete(lang); else next.add(lang);
    set({ languageFilter: next });
    // Rebuild
    const { graph, selectedNodeId, impactedNodeIds, dependencyNodeIds, searchQuery, showFileNodesOnly } = get();
    if (!graph) return;
    const rawFlowNodes = toFlowNodes(
      graph.nodes, selectedNodeId, impactedNodeIds, dependencyNodeIds,
      next, searchQuery, showFileNodesOnly,
    );
    const visibleIds = new Set(rawFlowNodes.map(n => n.id));
    const flowEdges = toFlowEdges(graph.edges, visibleIds, selectedNodeId, impactedNodeIds, dependencyNodeIds);
    const layoutedNodes = layoutGraph(rawFlowNodes, flowEdges);
    const flowNodes = addCounts(layoutedNodes, graph.edges);
    set({ flowNodes, flowEdges });
  },

  setShowFileNodesOnly: (show: boolean) => {
    set({ showFileNodesOnly: show });
    const { graph, selectedNodeId, impactedNodeIds, dependencyNodeIds, languageFilter, searchQuery } = get();
    if (!graph) return;
    const rawFlowNodes = toFlowNodes(
      graph.nodes, selectedNodeId, impactedNodeIds, dependencyNodeIds,
      languageFilter, searchQuery, show,
    );
    const visibleIds = new Set(rawFlowNodes.map(n => n.id));
    const flowEdges = toFlowEdges(graph.edges, visibleIds, selectedNodeId, impactedNodeIds, dependencyNodeIds);
    const layoutedNodes = layoutGraph(rawFlowNodes, flowEdges);
    const flowNodes = addCounts(layoutedNodes, graph.edges);
    set({ flowNodes, flowEdges });
  },

  updateFlowNodes: (nodes) => set({ flowNodes: nodes }),
  updateFlowEdges: (edges) => set({ flowEdges: edges }),
}));
