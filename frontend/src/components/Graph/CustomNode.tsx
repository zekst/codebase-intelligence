import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { FileCode, Box, Braces } from 'lucide-react';
import type { NodeVisualState, NodeType } from '../../types';

interface CustomNodeData {
  label: string;
  name: string;
  nodeType: NodeType;
  language: string;
  languageColor: string;
  languageIcon: string;
  filePath: string;
  line?: number;
  state: NodeVisualState;
  depCount: number;
  impactCount: number;
}

const nodeTypeIcon: Record<NodeType, React.ReactNode> = {
  file:     <FileCode size={12} />,
  function: <Braces size={12} />,
  class:    <Box size={12} />,
};

const stateClasses: Record<NodeVisualState, string> = {
  default:    'border-slate-700/60 bg-[#0d1424]/90',
  selected:   'border-indigo-400 bg-[#0d1424] shadow-[0_0_24px_rgba(129,140,248,0.35)] scale-[1.03]',
  impacted:   'border-amber-400/80 bg-[#0d1424] shadow-[0_0_18px_rgba(245,158,11,0.25)]',
  dependency: 'border-sky-400/70 bg-[#0d1424] shadow-[0_0_18px_rgba(96,165,250,0.2)]',
  dimmed:     'border-slate-800/40 bg-[#0a0e1a]/60 opacity-30',
};

const CustomNode: React.FC<NodeProps<CustomNodeData>> = ({ data }) => {
  const { name, nodeType, languageColor, languageIcon, state, depCount, impactCount } = data;

  return (
    <div
      className={`
        group relative rounded-xl border-2 px-4 py-3 min-w-[200px] max-w-[260px]
        backdrop-blur-sm transition-all duration-300 ease-out cursor-pointer
        hover:border-indigo-400/50 hover:shadow-[0_0_12px_rgba(129,140,248,0.15)]
        ${stateClasses[state]}
      `}
    >
      {/* Language badge */}
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="flex items-center justify-center w-6 h-5 rounded text-[9px] font-bold tracking-wider"
          style={{ backgroundColor: `${languageColor}22`, color: languageColor }}
        >
          {languageIcon}
        </div>
        <span className="text-[10px] uppercase tracking-widest text-slate-500 font-medium">
          {nodeType}
        </span>
        <span className="ml-auto flex items-center gap-0.5 text-slate-600">
          {nodeTypeIcon[nodeType]}
        </span>
      </div>

      {/* Node name */}
      <div className="text-sm font-semibold text-slate-200 truncate leading-snug font-mono">
        {name}
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 mt-2 text-[10px] font-medium">
        <span className="flex items-center gap-1 text-sky-400/70">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400/60" />
          {depCount} deps
        </span>
        <span className="flex items-center gap-1 text-amber-400/70">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
          {impactCount} dependents
        </span>
      </div>

      {/* Glow ring for selected state */}
      {state === 'selected' && (
        <div className="absolute -inset-[2px] rounded-xl border border-indigo-400/20 animate-pulse-glow pointer-events-none" />
      )}

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-slate-600 !border-slate-500 !-left-[5px]"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-slate-600 !border-slate-500 !-right-[5px]"
      />
    </div>
  );
};

export default memo(CustomNode);
