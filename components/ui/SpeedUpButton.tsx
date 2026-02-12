
import React from 'react';

export const SpeedUpButton: React.FC<{ onClick: () => void; disabled?: boolean; cost?: number }> = ({ onClick, disabled, cost = 1 }) => (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} disabled={disabled} className="group flex items-center gap-1.5 px-2 py-1 bg-cyan-900/40 hover:bg-cyan-500/20 border border-cyan-500/30 rounded text-[9px] font-bold text-cyan-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md active:scale-95">
        <span className="text-cyan-100">💎 {cost}</span>
        <svg className="w-2.5 h-2.5 group-hover:animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
    </button>
);
