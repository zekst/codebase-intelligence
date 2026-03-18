import { create } from 'zustand';
import axios from 'axios';
import type { ChatMessage, ChatContext } from '../types';
import { useGraphStore } from './graphStore';
import { computeImpact } from '../utils/graphTraversal';

interface ChatStore {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;

  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
}

/**
 * Build chat context from current graph state.
 * Uses useGraphStore.getState() for non-reactive access.
 * Reuses computeImpact() from graphTraversal.ts for impact data.
 */
function buildContext(): ChatContext {
  const { graph, selectedNodeId } = useGraphStore.getState();

  if (!graph) throw new Error('No graph loaded');

  const context: ChatContext = {
    graphSummary: {
      repoPath: graph.metadata.repoPath,
      totalFiles: graph.metadata.totalFiles,
      totalNodes: graph.metadata.totalNodes,
      totalEdges: graph.metadata.totalEdges,
      languages: graph.metadata.languages,
    },
  };

  if (selectedNodeId) {
    const node = graph.nodes.find(n => n.id === selectedNodeId);
    if (node) {
      context.selectedNode = {
        id: node.id,
        name: node.name,
        type: node.type,
        language: node.language,
        filePath: node.filePath,
      };

      // Compute impact using the existing client-side BFS utility
      const { impactedIds, dependencyIds } = computeImpact(selectedNodeId, graph.edges);

      // Get direct dependencies and dependents (1-hop only from edges)
      const fileId = selectedNodeId.includes('#')
        ? selectedNodeId.split('#')[0]
        : selectedNodeId;

      const directDeps = graph.edges
        .filter(e => e.from === fileId)
        .map(e => graph.nodes.find(n => n.id === e.to))
        .filter((n): n is NonNullable<typeof n> => n != null)
        .slice(0, 20)
        .map(n => ({ id: n.id, name: n.name, language: n.language }));

      const directDependents = graph.edges
        .filter(e => e.to === fileId)
        .map(e => graph.nodes.find(n => n.id === e.from))
        .filter((n): n is NonNullable<typeof n> => n != null)
        .slice(0, 20)
        .map(n => ({ id: n.id, name: n.name, language: n.language }));

      context.directDependencies = directDeps;
      context.directDependents = directDependents;
      context.impactStats = {
        totalImpacted: impactedIds.size,
        totalDependencies: dependencyIds.size,
        maxImpactDepth: 0, // client-side BFS doesn't track depth; backend enriches
      };
    }
  }

  return context;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  isLoading: false,
  error: null,

  sendMessage: async (content: string) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    set(state => ({
      messages: [...state.messages, userMsg],
      isLoading: true,
      error: null,
    }));

    try {
      const context = buildContext();

      // Build history from previous messages (max 10)
      const history = get()
        .messages.filter(m => m.id !== userMsg.id)
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));

      const resp = await axios.post<{ success: boolean; reply?: string; error?: string }>(
        '/api/chat',
        { message: content, context, history },
      );

      if (!resp.data.success) {
        throw new Error(resp.data.error || 'Chat request failed');
      }

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: resp.data.reply!,
        timestamp: Date.now(),
      };

      set(state => ({
        messages: [...state.messages, assistantMsg],
        isLoading: false,
      }));
    } catch (err) {
      set({
        isLoading: false,
        error: (err as Error).message,
      });
    }
  },

  clearMessages: () => set({ messages: [], error: null }),
}));
