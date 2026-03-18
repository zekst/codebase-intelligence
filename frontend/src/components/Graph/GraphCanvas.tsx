import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type NodeTypes,
  type EdgeTypes,
  type OnNodesChange,
  type OnEdgesChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useGraphStore } from '../../store/graphStore';
import CustomNode from './CustomNode';
import CustomEdge from './CustomEdge';
import { Network, Sparkles } from 'lucide-react';

const nodeTypes: NodeTypes = { custom: CustomNode };
const edgeTypes: EdgeTypes = { custom: CustomEdge };

const GraphCanvas: React.FC = () => {
  const flowNodes = useGraphStore(s => s.flowNodes);
  const flowEdges = useGraphStore(s => s.flowEdges);
  const status = useGraphStore(s => s.status);
  const selectNode = useGraphStore(s => s.selectNode);
  const selectedNodeId = useGraphStore(s => s.selectedNodeId);
  const updateFlowNodes = useGraphStore(s => s.updateFlowNodes);

  const [nodes, , onNodesChange] = useNodesState(flowNodes);
  const [edges, , onEdgesChange] = useEdgesState(flowEdges);

  // Sync external changes → local state
  React.useEffect(() => {
    onNodesChange(flowNodes.map(n => ({ type: 'reset', item: n })) as never);
  }, [flowNodes]);

  React.useEffect(() => {
    onEdgesChange(flowEdges.map(e => ({ type: 'reset', item: e })) as never);
  }, [flowEdges]);

  const handleNodesChange: OnNodesChange = useCallback((changes) => {
    onNodesChange(changes);
    // Persist position changes to store
    const posChanges = changes.filter(c => c.type === 'position' && (c as any).position);
    if (posChanges.length > 0) {
      requestAnimationFrame(() => {
        // Handled internally by ReactFlow
      });
    }
  }, [onNodesChange]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: { id: string }) => {
    if (node.id === selectedNodeId) {
      selectNode(null);
    } else {
      selectNode(node.id);
    }
  }, [selectNode, selectedNodeId]);

  const handlePaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  const miniMapNodeColor = useCallback((node: any) => {
    const state = node.data?.state;
    if (state === 'selected') return '#818cf8';
    if (state === 'impacted') return '#f59e0b';
    if (state === 'dependency') return '#60a5fa';
    if (state === 'dimmed') return '#1e293b';
    return '#334155';
  }, []);

  // Empty state
  if (status === 'idle') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
        <div className="relative">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center">
            <Network size={40} className="text-indigo-400" />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/20 flex items-center justify-center">
            <Sparkles size={16} className="text-amber-400" />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-200 mb-2">
            Codebase Intelligence Platform
          </h2>
          <p className="text-sm text-slate-500 max-w-md leading-relaxed">
            Enter a repository path in the left panel and click <span className="text-indigo-400 font-medium">Analyze</span> to
            visualize your codebase dependency graph. Click any node to see its impact analysis.
          </p>
        </div>
        <div className="flex items-center gap-6 text-xs text-slate-600">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#3178c6]" /> TypeScript</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#3572A5]" /> Python</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#f89820]" /> Java</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#00ADD8]" /> Go</span>
        </div>
      </div>
    );
  }

  // Loading
  if (status === 'analyzing') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center animate-pulse">
          <Network size={28} className="text-indigo-400 animate-spin" style={{ animationDuration: '3s' }} />
        </div>
        <div className="text-sm text-slate-400">Analyzing repository…</div>
        <div className="w-48 h-1 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full animate-[pulse_1.5s_ease-in-out_infinite] w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1.2 }}
        minZoom={0.1}
        maxZoom={2.5}
        defaultEdgeOptions={{
          type: 'custom',
          style: { stroke: '#334155', strokeWidth: 1 },
        }}
        proOptions={{ hideAttribution: true }}
        className="bg-transparent"
      >
        <Background color="#1e293b" gap={24} size={1} />
        <Controls
          className="!bg-[#111827] !border-slate-700/60 !rounded-xl !shadow-xl [&>button]:!bg-[#111827] [&>button]:!border-slate-700/40 [&>button]:!text-slate-400 [&>button:hover]:!bg-slate-800 [&>button]:!rounded-lg"
          showInteractive={false}
        />
        <MiniMap
          nodeColor={miniMapNodeColor}
          maskColor="rgba(6, 11, 24, 0.85)"
          className="!bg-[#0d1424] !border-slate-700/40 !rounded-xl"
          pannable
          zoomable
        />
      </ReactFlow>

      {/* Legend overlay */}
      {selectedNodeId && (
        <div className="absolute bottom-4 left-4 flex items-center gap-4 bg-[#0d1424]/90 backdrop-blur-sm border border-slate-700/40 rounded-lg px-4 py-2 text-[11px] animate-fade-in">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.5)]" />
            Selected
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.4)]" />
            Impacted
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-400 shadow-[0_0_6px_rgba(96,165,250,0.4)]" />
            Dependency
          </span>
        </div>
      )}
    </div>
  );
};

export default GraphCanvas;
