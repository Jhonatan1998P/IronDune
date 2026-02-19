
import React from 'react';
import { SmartTooltip } from './SmartTooltip';
import { Icons } from '../Icons';

interface CardProps { 
    children: React.ReactNode; 
    className?: string; 
    title?: React.ReactNode; 
    tooltip?: React.ReactNode;
    onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', title, tooltip, onClick }) => (
  <div 
    onClick={onClick}
    className={`
        glass-panel p-4 rounded-xl flex flex-col gap-3 relative overflow-hidden group border border-white/5 shadow-lg transition-all duration-300
        ${onClick ? 'cursor-pointer active:scale-[0.98] hover:border-white/20 hover:bg-white/5' : ''}
        md:hover:shadow-[0_8px_30px_rgba(6,182,212,0.15)] md:hover:-translate-y-0.5 md:hover:border-white/10
        ${className}
    `}
  >
    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
    {title && (
      <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-1 gap-2 shrink-0">
        <div className="font-tech text-metal-300 text-xs md:text-sm uppercase tracking-[0.2em] flex-1 truncate leading-tight">{title}</div>
        {tooltip && (
           <SmartTooltip content={tooltip} placement="top" triggerMode="hover">
              <div className="text-slate-600 hover:text-cyan-400 p-2 -m-2 transition-colors relative">
                  <Icons.Info />
              </div>
           </SmartTooltip>
        )}
      </div>
    )}
    <div className="flex-1 flex flex-col min-h-0 text-sm">
        {children}
    </div>
  </div>
);
