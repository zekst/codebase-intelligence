import React, { useRef, useEffect, useState } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useGraphStore } from '../../store/graphStore';
import {
  MessageCircle,
  Send,
  Loader2,
  Trash2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

const SUGGESTIONS = [
  'What are the most critical files?',
  'What depends on the selected file?',
  'Summarize this codebase structure',
];

const ChatPanel: React.FC = () => {
  const messages = useChatStore(s => s.messages);
  const isLoading = useChatStore(s => s.isLoading);
  const error = useChatStore(s => s.error);
  const sendMessage = useChatStore(s => s.sendMessage);
  const clearMessages = useChatStore(s => s.clearMessages);
  const selectedNodeId = useGraphStore(s => s.selectedNodeId);

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 96) + 'px';
    }
  }, [input]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    sendMessage(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800/40 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <Sparkles size={15} className="text-indigo-400" />
          Codebase Assistant
        </h2>
        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="p-1.5 rounded hover:bg-slate-800/60 text-slate-500 hover:text-slate-300 transition-colors"
            title="Clear chat"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Context indicator */}
      {selectedNodeId && (
        <div className="px-5 py-2 border-b border-slate-800/30 bg-indigo-500/5">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            <span className="text-[10px] text-indigo-400/80">
              Context:{' '}
              <span className="font-mono text-indigo-300">
                {selectedNodeId.split('/').pop()}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 space-y-4">
        {/* Empty state */}
        {messages.length === 0 && !isLoading && (
          <div className="text-center py-8">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-3">
              <MessageCircle size={18} className="text-indigo-400/60" />
            </div>
            <p className="text-xs text-slate-500 mb-1">Ask about your codebase</p>
            <p className="text-[10px] text-slate-600 mb-5">
              Dependencies, impact analysis, and structure
            </p>

            {/* Suggestion chips */}
            <div className="space-y-2">
              {SUGGESTIONS.map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => sendMessage(suggestion)}
                  className="block w-full text-left px-3 py-2.5 rounded-lg bg-[#0a1025] border border-slate-800/40 text-xs text-slate-400 hover:text-slate-200 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all"
                >
                  <span className="text-indigo-400/60 mr-1.5">→</span>
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[90%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-500/15 border border-indigo-500/20 text-slate-200'
                  : 'bg-[#0a1025] border border-slate-800/40 text-slate-300'
              }`}
            >
              <div className="whitespace-pre-wrap break-words">{msg.content}</div>
              <div
                className={`text-[9px] mt-1.5 ${
                  msg.role === 'user' ? 'text-indigo-400/40' : 'text-slate-600'
                }`}
              >
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[#0a1025] border border-slate-800/40 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
              <Loader2 size={12} className="animate-spin text-indigo-400" />
              <span className="text-xs text-slate-500">Thinking...</span>
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/8 border border-red-500/15">
            <AlertCircle size={12} className="text-red-400 shrink-0 mt-0.5" />
            <span className="text-xs text-red-400/80">{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-slate-800/40">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the codebase..."
            rows={1}
            className="flex-1 bg-[#0a1025] border border-slate-800/40 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-colors"
            style={{ maxHeight: '96px' }}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
          >
            <Send size={13} />
          </button>
        </div>
        <div className="text-[9px] text-slate-700 mt-1.5 px-1">
          Enter to send · Shift+Enter for newline
        </div>
      </form>
    </div>
  );
};

export default ChatPanel;
