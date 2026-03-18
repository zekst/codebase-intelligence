import React, { useState, useRef, useCallback } from 'react';
import { useGraphStore } from '../../store/graphStore';
import { LANGUAGE_CONFIG } from '../../types';
import type { Language } from '../../types';
import {
  FolderSearch,
  Play,
  Search,
  Filter,
  FileCode,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FolderOpen,
  GitBranch,
  Upload,
  Terminal,
} from 'lucide-react';

const ALL_LANGUAGES: Language[] = ['typescript', 'javascript', 'python', 'java', 'go'];

type InputTab = 'path' | 'upload' | 'git';

const AnalyzePanel: React.FC = () => {
  const repoPath = useGraphStore(s => s.repoPath);
  const setRepoPath = useGraphStore(s => s.setRepoPath);
  const gitUrl = useGraphStore(s => s.gitUrl);
  const setGitUrl = useGraphStore(s => s.setGitUrl);
  const analyzeRepo = useGraphStore(s => s.analyzeRepo);
  const analyzeGitRepo = useGraphStore(s => s.analyzeGitRepo);
  const analyzeUpload = useGraphStore(s => s.analyzeUpload);
  const status = useGraphStore(s => s.status);
  const error = useGraphStore(s => s.error);
  const searchQuery = useGraphStore(s => s.searchQuery);
  const setSearchQuery = useGraphStore(s => s.setSearchQuery);
  const languageFilter = useGraphStore(s => s.languageFilter);
  const toggleLanguageFilter = useGraphStore(s => s.toggleLanguageFilter);
  const showFileNodesOnly = useGraphStore(s => s.showFileNodesOnly);
  const setShowFileNodesOnly = useGraphStore(s => s.setShowFileNodesOnly);
  const graph = useGraphStore(s => s.graph);

  const [activeTab, setActiveTab] = useState<InputTab>('path');
  const [uploadedCount, setUploadedCount] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFilesRef = useRef<FileList | null>(null);

  const isAnalyzing = status === 'analyzing';

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleAnalyzePath = () => {
    if (repoPath.trim()) analyzeRepo(repoPath.trim());
  };

  const handleAnalyzeGit = () => {
    if (gitUrl.trim()) analyzeGitRepo(gitUrl.trim());
  };

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const supported = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'java', 'go']);
    let count = 0;
    for (let i = 0; i < files.length; i++) {
      const ext = files[i].name.split('.').pop()?.toLowerCase() ?? '';
      if (supported.has(ext)) count++;
    }
    setUploadedCount(count);
    pendingFilesRef.current = files;
  }, []);

  const handleUploadAnalyze = () => {
    if (pendingFilesRef.current) {
      analyzeUpload(pendingFilesRef.current);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  }, [handleFileSelect]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (activeTab === 'path') handleAnalyzePath();
      else if (activeTab === 'git') handleAnalyzeGit();
    }
  };

  // ── Tab config ──────────────────────────────────────────────────────────

  const tabs: { id: InputTab; label: string; icon: React.ReactNode }[] = [
    { id: 'path', label: 'Local Path', icon: <Terminal size={12} /> },
    { id: 'upload', label: 'Upload', icon: <Upload size={12} /> },
    { id: 'git', label: 'Git URL', icon: <GitBranch size={12} /> },
  ];

  return (
    <div className="w-72 border-r border-slate-800/60 bg-[#080d1c]/80 backdrop-blur-sm flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center">
            <FolderSearch size={16} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-200 leading-none">Codebase Intel</h1>
            <p className="text-[10px] text-slate-500 mt-0.5">Dependency Analyzer</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* ─── Tab Bar ─────────────────────────────────────────────────── */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex bg-[#0a1025] rounded-lg p-0.5 border border-slate-800/40">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-[11px] font-medium transition-all duration-200
                  ${activeTab === tab.id
                    ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 shadow-sm'
                    : 'text-slate-500 hover:text-slate-400 border border-transparent'
                  }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ─── Tab Content ─────────────────────────────────────────────── */}
        <div className="px-5 py-3 border-b border-slate-800/30">

          {/* Local Path Tab */}
          {activeTab === 'path' && (
            <div className="animate-fade-in">
              <label className="text-[10px] uppercase tracking-widest text-slate-600 font-medium mb-2 block">
                Repository Path
              </label>
              <input
                type="text"
                value={repoPath}
                onChange={e => setRepoPath(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="/path/to/repository"
                className="w-full bg-[#0a1025] border border-slate-800/60 rounded-lg px-3 py-2.5 text-sm text-slate-300 placeholder:text-slate-600
                           font-mono focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-all"
              />
              <button
                onClick={handleAnalyzePath}
                disabled={!repoPath.trim() || isAnalyzing}
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                           bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-sm font-medium
                           hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed
                           transition-all duration-200 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30"
              >
                {isAnalyzing ? (
                  <><Loader2 size={14} className="animate-spin" /> Analyzing…</>
                ) : (
                  <><Play size={14} /> Analyze</>
                )}
              </button>
            </div>
          )}

          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <div className="animate-fade-in">
              <label className="text-[10px] uppercase tracking-widest text-slate-600 font-medium mb-2 block">
                Upload Folder
              </label>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                /* @ts-expect-error webkitdirectory is not typed */
                webkitdirectory="true"
                directory="true"
                multiple
                className="hidden"
                onChange={e => handleFileSelect(e.target.files)}
              />

              {/* Drop zone / picker */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed
                  cursor-pointer transition-all duration-200
                  ${isDragOver
                    ? 'border-indigo-400 bg-indigo-500/10 shadow-[0_0_20px_rgba(129,140,248,0.15)]'
                    : uploadedCount > 0
                      ? 'border-emerald-500/40 bg-emerald-500/5'
                      : 'border-slate-700/50 bg-[#0a1025] hover:border-slate-600/60 hover:bg-[#0b1128]'
                  }
                `}
              >
                {uploadedCount > 0 ? (
                  <>
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <FolderOpen size={20} className="text-emerald-400" />
                    </div>
                    <span className="text-xs text-emerald-400 font-medium">{uploadedCount} source files selected</span>
                    <span className="text-[10px] text-slate-500">Click to change folder</span>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-lg bg-slate-800/60 border border-slate-700/40 flex items-center justify-center">
                      <Upload size={20} className={isDragOver ? 'text-indigo-400' : 'text-slate-500'} />
                    </div>
                    <span className="text-xs text-slate-400">Click to pick a folder</span>
                    <span className="text-[10px] text-slate-600">or drag & drop files here</span>
                  </>
                )}
              </div>

              <button
                onClick={handleUploadAnalyze}
                disabled={uploadedCount === 0 || isAnalyzing}
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                           bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-sm font-medium
                           hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed
                           transition-all duration-200 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30"
              >
                {isAnalyzing ? (
                  <><Loader2 size={14} className="animate-spin" /> Uploading & Analyzing…</>
                ) : (
                  <><Play size={14} /> Analyze Upload</>
                )}
              </button>
            </div>
          )}

          {/* Git URL Tab */}
          {activeTab === 'git' && (
            <div className="animate-fade-in">
              <label className="text-[10px] uppercase tracking-widest text-slate-600 font-medium mb-2 block">
                Git Repository URL
              </label>
              <input
                type="text"
                value={gitUrl}
                onChange={e => setGitUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="https://github.com/user/repo"
                className="w-full bg-[#0a1025] border border-slate-800/60 rounded-lg px-3 py-2.5 text-sm text-slate-300 placeholder:text-slate-600
                           font-mono focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-all"
              />
              <p className="mt-1.5 text-[10px] text-slate-600 leading-relaxed">
                Clones repo (shallow, depth=1) to a temp directory for analysis. Supports public repos via HTTPS.
              </p>
              <button
                onClick={handleAnalyzeGit}
                disabled={!gitUrl.trim() || isAnalyzing}
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                           bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-sm font-medium
                           hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed
                           transition-all duration-200 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30"
              >
                {isAnalyzing ? (
                  <><Loader2 size={14} className="animate-spin" /> Cloning & Analyzing…</>
                ) : (
                  <><GitBranch size={14} /> Clone & Analyze</>
                )}
              </button>
            </div>
          )}

          {/* Status indicator */}
          {status === 'complete' && (
            <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400/80 animate-fade-in">
              <CheckCircle2 size={12} />
              Analysis complete
            </div>
          )}
          {status === 'error' && error && (
            <div className="mt-3 flex items-start gap-2 text-xs text-red-400/80 animate-fade-in">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              <span className="break-all">{error}</span>
            </div>
          )}
        </div>

        {/* Search (only when graph exists) */}
        {graph && (
          <>
            <div className="px-5 py-4 border-b border-slate-800/30 animate-fade-in">
              <label className="text-[10px] uppercase tracking-widest text-slate-600 font-medium mb-2 block">
                <Search size={10} className="inline mr-1" />
                Search Nodes
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filter by name…"
                className="w-full bg-[#0a1025] border border-slate-800/60 rounded-lg px-3 py-2 text-sm text-slate-300 placeholder:text-slate-600
                           font-mono focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-all"
              />
            </div>

            {/* View options */}
            <div className="px-5 py-4 border-b border-slate-800/30 animate-fade-in">
              <div className="text-[10px] uppercase tracking-widest text-slate-600 font-medium mb-3 flex items-center gap-1">
                <Layers size={10} />
                View Options
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div
                  className={`w-8 h-[18px] rounded-full transition-all duration-200 relative
                    ${showFileNodesOnly ? 'bg-indigo-500/30' : 'bg-slate-700/40'}`}
                  onClick={() => setShowFileNodesOnly(!showFileNodesOnly)}
                >
                  <div
                    className={`absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all duration-200
                      ${showFileNodesOnly ? 'left-[17px] bg-indigo-400' : 'left-[2px] bg-slate-500'}`}
                  />
                </div>
                <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors flex items-center gap-1.5">
                  <FileCode size={12} />
                  Files only
                </span>
              </label>
            </div>

            {/* Language filter */}
            <div className="px-5 py-4 animate-fade-in">
              <div className="text-[10px] uppercase tracking-widest text-slate-600 font-medium mb-3 flex items-center gap-1">
                <Filter size={10} />
                Language Filter
              </div>
              <div className="space-y-1.5">
                {ALL_LANGUAGES.map(lang => {
                  const config = LANGUAGE_CONFIG[lang];
                  const count = graph.metadata.languages[lang] ?? 0;
                  if (count === 0) return null;
                  const isActive = languageFilter.size === 0 || languageFilter.has(lang);
                  return (
                    <button
                      key={lang}
                      onClick={() => toggleLanguageFilter(lang)}
                      className={`flex items-center gap-2 w-full px-2.5 py-2 rounded-lg transition-all duration-200
                        ${isActive
                          ? 'bg-slate-800/40 text-slate-300'
                          : 'bg-transparent text-slate-600 opacity-50'
                        } hover:bg-slate-800/60`}
                    >
                      <div
                        className="w-5 h-4 rounded text-[8px] font-bold flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${config.color}22`, color: config.color }}
                      >
                        {config.icon}
                      </div>
                      <span className="text-xs flex-1 text-left">{config.label}</span>
                      <span className="text-[10px] font-mono text-slate-500">{count}</span>
                    </button>
                  );
                })}
              </div>
              {languageFilter.size > 0 && (
                <button
                  onClick={() => {
                    for (const l of languageFilter) toggleLanguageFilter(l);
                  }}
                  className="mt-2 text-[10px] text-indigo-400/70 hover:text-indigo-400 transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AnalyzePanel;
