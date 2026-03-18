import React from 'react';
import { useGraphStore } from '../../store/graphStore';
import { LANGUAGE_CONFIG } from '../../types';
import type { Language } from '../../types';
import {
  FileCode,
  GitBranch,
  AlertTriangle,
  ArrowRight,
  Layers,
  BarChart3,
  X,
} from 'lucide-react';

const InsightsPanel: React.FC = () => {
  const graph = useGraphStore(s => s.graph);
  const selectedNodeId = useGraphStore(s => s.selectedNodeId);
  const impactedNodeIds = useGraphStore(s => s.impactedNodeIds);
  const dependencyNodeIds = useGraphStore(s => s.dependencyNodeIds);
  const selectNode = useGraphStore(s => s.selectNode);
  const flowNodes = useGraphStore(s => s.flowNodes);

  if (!graph) return null;

  const selectedNode = selectedNodeId
    ? graph.nodes.find(n => n.id === selectedNodeId)
    : null;

  const impactedNodes = graph.nodes.filter(n => impactedNodeIds.has(n.id));
  const depNodes = graph.nodes.filter(n => dependencyNodeIds.has(n.id));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800/40">
        <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <BarChart3 size={15} className="text-indigo-400" />
          Insights
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Overview stats (always visible) */}
        <div className="px-5 py-4 border-b border-slate-800/30">
          <div className="text-[10px] uppercase tracking-widest text-slate-600 mb-3 font-medium">
            Repository Overview
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              icon={<FileCode size={13} />}
              label="Files"
              value={graph.metadata.totalFiles}
              color="indigo"
            />
            <StatCard
              icon={<Layers size={13} />}
              label="Nodes"
              value={graph.metadata.totalNodes}
              color="purple"
            />
            <StatCard
              icon={<GitBranch size={13} />}
              label="Edges"
              value={graph.metadata.totalEdges}
              color="sky"
            />
            <StatCard
              icon={<BarChart3 size={13} />}
              label="Visible"
              value={flowNodes.length}
              color="emerald"
            />
          </div>
        </div>

        {/* Language breakdown */}
        <div className="px-5 py-4 border-b border-slate-800/30">
          <div className="text-[10px] uppercase tracking-widest text-slate-600 mb-3 font-medium">
            Languages
          </div>
          <div className="space-y-2">
            {Object.entries(graph.metadata.languages)
              .filter(([, count]) => count > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([lang, count]) => {
                const config = LANGUAGE_CONFIG[lang as Language] ?? LANGUAGE_CONFIG.unknown;
                const pct = Math.round((count / graph.metadata.totalFiles) * 100);
                return (
                  <div key={lang} className="flex items-center gap-2">
                    <div
                      className="w-5 h-4 rounded text-[8px] font-bold flex items-center justify-center"
                      style={{ backgroundColor: `${config.color}22`, color: config.color }}
                    >
                      {config.icon}
                    </div>
                    <span className="text-xs text-slate-400 flex-1">{config.label}</span>
                    <span className="text-xs text-slate-500 font-mono">{count}</span>
                    <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: config.color }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Selected node details */}
        {selectedNode && (
          <div className="animate-fade-in">
            <div className="px-5 py-4 border-b border-slate-800/30">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] uppercase tracking-widest text-slate-600 font-medium">
                  Selected Node
                </div>
                <button
                  onClick={() => selectNode(null)}
                  className="p-1 rounded hover:bg-slate-800/60 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
              <div className="bg-[#0a1025] rounded-lg border border-slate-800/40 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-6 h-5 rounded text-[9px] font-bold flex items-center justify-center"
                    style={{
                      backgroundColor: `${LANGUAGE_CONFIG[selectedNode.language]?.color}22`,
                      color: LANGUAGE_CONFIG[selectedNode.language]?.color,
                    }}
                  >
                    {LANGUAGE_CONFIG[selectedNode.language]?.icon}
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">
                    {selectedNode.type}
                  </span>
                </div>
                <div className="text-sm font-semibold text-slate-200 font-mono truncate">
                  {selectedNode.name}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 truncate font-mono">
                  {selectedNode.id}
                </div>
              </div>
            </div>

            {/* Impact summary */}
            <div className="px-5 py-4 border-b border-slate-800/30">
              <div className="text-[10px] uppercase tracking-widest text-slate-600 mb-3 font-medium flex items-center gap-1.5">
                <AlertTriangle size={11} className="text-amber-400" />
                Impact Analysis
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-bold text-amber-400">{impactedNodes.length}</div>
                  <div className="text-[10px] text-amber-400/60 mt-0.5">Impacted</div>
                </div>
                <div className="bg-sky-500/5 border border-sky-500/10 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-bold text-sky-400">{depNodes.length}</div>
                  <div className="text-[10px] text-sky-400/60 mt-0.5">Dependencies</div>
                </div>
              </div>
            </div>

            {/* Impacted files list */}
            {impactedNodes.length > 0 && (
              <div className="px-5 py-4 border-b border-slate-800/30">
                <div className="text-[10px] uppercase tracking-widest text-slate-600 mb-2 font-medium">
                  Affected Files ({impactedNodes.length})
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                  {impactedNodes.slice(0, 20).map(n => (
                    <button
                      key={n.id}
                      onClick={() => selectNode(n.id)}
                      className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md hover:bg-slate-800/40 transition-colors group"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60 shrink-0" />
                      <span className="text-xs text-slate-400 truncate group-hover:text-slate-200 font-mono">
                        {n.name}
                      </span>
                      <ArrowRight size={10} className="ml-auto text-slate-600 group-hover:text-slate-400 shrink-0" />
                    </button>
                  ))}
                  {impactedNodes.length > 20 && (
                    <div className="text-[10px] text-slate-600 px-2 py-1">
                      +{impactedNodes.length - 20} more…
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Dependencies list */}
            {depNodes.length > 0 && (
              <div className="px-5 py-4">
                <div className="text-[10px] uppercase tracking-widest text-slate-600 mb-2 font-medium">
                  Dependencies ({depNodes.length})
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                  {depNodes.slice(0, 20).map(n => (
                    <button
                      key={n.id}
                      onClick={() => selectNode(n.id)}
                      className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md hover:bg-slate-800/40 transition-colors group"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400/60 shrink-0" />
                      <span className="text-xs text-slate-400 truncate group-hover:text-slate-200 font-mono">
                        {n.name}
                      </span>
                      <ArrowRight size={10} className="ml-auto text-slate-600 group-hover:text-slate-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Stat Card ──────────────────────────────────────────────────────────────

const colorMap: Record<string, string> = {
  indigo:  'text-indigo-400 bg-indigo-500/8 border-indigo-500/15',
  purple:  'text-purple-400 bg-purple-500/8 border-purple-500/15',
  sky:     'text-sky-400 bg-sky-500/8 border-sky-500/15',
  emerald: 'text-emerald-400 bg-emerald-500/8 border-emerald-500/15',
  amber:   'text-amber-400 bg-amber-500/8 border-amber-500/15',
};

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}> = ({ icon, label, value, color }) => (
  <div className={`rounded-lg border p-2.5 ${colorMap[color] ?? colorMap.indigo}`}>
    <div className="flex items-center gap-1.5 mb-1 opacity-70">
      {icon}
      <span className="text-[10px] uppercase tracking-wider">{label}</span>
    </div>
    <div className="text-lg font-bold font-mono">{value.toLocaleString()}</div>
  </div>
);

export default InsightsPanel;
