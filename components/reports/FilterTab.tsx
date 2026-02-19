
import React from 'react';

export type FilterType = 'all' | 'combat' | 'economy' | 'research' | 'archived';

interface FilterTabProps {
    id: FilterType;
    label: string;
    current: FilterType;
    onClick: (id: FilterType) => void;
    icon?: React.ReactNode;
}

export const FilterTab: React.FC<FilterTabProps> = ({ id, label, current, onClick, icon }) => (
    <button 
        onClick={() => onClick(id)}
        className={`px-3 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all border-b-2 ${
            current === id 
            ? 'border-cyan-500 text-cyan-400 bg-white/5' 
            : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'
        }`}
    >
        {icon}
        {label}
    </button>
);
