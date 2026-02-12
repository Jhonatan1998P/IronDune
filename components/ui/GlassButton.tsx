
import React from 'react';

export const GlassButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'danger' | 'neutral' }> = ({ 
  children, className = '', variant = 'neutral', ...props 
}) => {
  let colors = 'text-metal-200 hover:text-white border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10';
  
  if (variant === 'primary') {
      colors = 'text-cyan-400 hover:text-cyan-100 border-cyan-500/30 hover:border-cyan-400/60 bg-cyan-500/10 hover:bg-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.1)] hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]';
  }
  if (variant === 'danger') {
      colors = 'text-red-400 hover:text-red-100 border-red-500/30 hover:border-red-400/60 bg-red-500/10 hover:bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]';
  }
  
  // Added min-h-[44px] and flex utils for touch targets
  return (
    <button className={`glass-button min-h-[44px] px-4 py-2 rounded-lg transition-all duration-300 font-tech tracking-wider uppercase text-xs active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2 ${colors} ${className}`} {...props}>
      {children}
    </button>
  );
};
