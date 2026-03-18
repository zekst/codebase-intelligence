import React, { useState } from 'react';
import GraphCanvas from './components/Graph/GraphCanvas';
import AnalyzePanel from './components/Controls/AnalyzePanel';
import InsightsPanel from './components/Sidebar/InsightsPanel';
import ChatPanel from './components/Sidebar/ChatPanel';
import { useGraphStore } from './store/graphStore';
import { BarChart3, MessageCircle } from 'lucide-react';

type RightTab = 'insights' | 'chat';

const App: React.FC = () => {
  const graph = useGraphStore(s => s.graph);
  const [rightTab, setRightTab] = useState<RightTab>('insights');

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#060b18]">
      {/* Left panel — Analyze controls */}
      <AnalyzePanel />

      {/* Center — Graph canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-11 border-b border-slate-800/40 bg-[#080d1c]/60 backdrop-blur-sm flex items-center px-5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.5)]" />
            <span className="text-xs font-medium text-slate-400">
              {graph
                ? `${graph.metadata.totalNodes} nodes · ${graph.metadata.totalEdges} edges`
                : 'No repository loaded'}
            </span>
          </div>
          {graph && (
            <div className="ml-auto flex items-center gap-2 text-[10px] text-slate-600">
              <span>Analyzed: {new Date(graph.metadata.analyzedAt).toLocaleTimeString()}</span>
              <span className="w-px h-3 bg-slate-800" />
              <span className="font-mono truncate max-w-[300px]">{graph.metadata.repoPath}</span>
            </div>
          )}
        </div>

        {/* Graph */}
        <GraphCanvas />
      </div>

      {/* Right panel — Insights / Chat tabs */}
      {graph && (
        <div className="w-80 border-l border-slate-800/60 bg-[#080d1c]/80 backdrop-blur-sm flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex shrink-0 border-b border-slate-800/40">
            <TabButton
              active={rightTab === 'insights'}
              onClick={() => setRightTab('insights')}
              icon={<BarChart3 size={12} />}
              label="Insights"
            />
            <TabButton
              active={rightTab === 'chat'}
              onClick={() => setRightTab('chat')}
              icon={<MessageCircle size={12} />}
              label="Chat"
            />
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            {rightTab === 'insights' ? <InsightsPanel /> : <ChatPanel />}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Tab Button ────────────────────────────────────────────────────────────

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-all relative ${
      active
        ? 'text-indigo-400'
        : 'text-slate-500 hover:text-slate-300'
    }`}
  >
    {icon}
    {label}
    {active && (
      <div className="absolute bottom-0 left-3 right-3 h-[2px] bg-indigo-400 rounded-full" />
    )}
  </button>
);

export default App;
