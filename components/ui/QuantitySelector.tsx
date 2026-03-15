
import React from 'react';
import { TranslationDictionary } from '../../types';

export const QuantitySelector: React.FC<{ value: number, onChange: (val: number) => void, maxAffordable: number, t: TranslationDictionary, presets?: number[] }> = ({ value, onChange, maxAffordable, t, presets = [1, 5] }) => (
    <div className="space-y-2">
        <div className="flex items-center gap-2 bg-black/40 p-1 rounded border border-white/5">
            <button onClick={() => onChange(Math.max(1, value - 1))} className="w-8 h-8 hover:bg-white/5 rounded text-slate-500 transition-colors">-</button>
            <input 
                type="number" 
                value={value === 0 ? '' : value} 
                onChange={(e) => {
                    const val = parseInt(e.target.value);
                    onChange(isNaN(val) ? 0 : val);
                }}
                className="w-full bg-transparent text-center font-mono text-xs font-bold text-white outline-none" 
            />
            <button onClick={() => onChange(value + 1)} className="w-8 h-8 hover:bg-white/5 rounded text-slate-500 transition-colors">+</button>
        </div>
        <div className="flex gap-1.5">
            {presets.map(n => (
                <button key={n} onClick={() => onChange(n)} className={`flex-1 py-1 text-[9px] rounded border transition-all uppercase font-bold tracking-widest ${value === n ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300' : 'bg-white/5 border-white/5 text-slate-500 hover:text-slate-300'}`}>+{n}</button>
            ))}
            <button onClick={() => onChange(maxAffordable)} className="flex-1 py-1 text-[9px] rounded border bg-white/5 border-white/5 text-slate-500 hover:text-white uppercase font-bold tracking-widest">{t.common.actions.max}</button>
        </div>
    </div>
);
