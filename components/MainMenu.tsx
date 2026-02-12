
import React, { useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useGame } from '../context/GameContext';
import { GlassButton } from './UIComponents';

export const MainMenu: React.FC = () => {
    const { t, language, setLanguage } = useLanguage();
    const { hasSave, startNewGame, loadGame, importSave, exportSave } = useGame();
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);

    const handleNewGameClick = () => {
        if (hasSave) {
            if (window.confirm(t.common.menu.confirm_new)) {
                startNewGame();
            }
        } else {
            startNewGame();
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const content = evt.target?.result as string;
            if (content) {
                const success = importSave(content);
                if (!success) {
                    setMessage({ text: t.common.menu.import_error, type: 'error' });
                    setTimeout(() => setMessage(null), 3000);
                } else {
                    setMessage({ text: t.common.menu.save_success, type: 'success' });
                    setTimeout(() => setMessage(null), 3000);
                }
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    return (
        <div className="relative w-full h-full flex items-center justify-center p-4 overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>

            <div className="glass-panel w-full max-w-md p-8 rounded-2xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative z-10 flex flex-col items-center gap-8">
                
                <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl mx-auto shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center mb-4">
                        <span className="font-tech text-3xl font-bold text-black">ID</span>
                    </div>
                    <h1 className="font-tech text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 via-white to-cyan-300 tracking-wider uppercase">
                        Iron Dune
                    </h1>
                    <div className="h-px w-24 mx-auto bg-gradient-to-r from-transparent via-cyan-500 to-transparent"></div>
                    <p className="font-mono text-xs text-cyan-400 tracking-[0.3em] uppercase opacity-80">Operations Command</p>
                </div>

                <div className="w-full space-y-3">
                    <button
                        onClick={handleNewGameClick}
                        className="w-full group relative overflow-hidden p-4 rounded-lg border border-cyan-500/30 bg-cyan-900/20 hover:bg-cyan-500/20 transition-all duration-300"
                    >
                        <div className="absolute inset-0 bg-cyan-400/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <span className="relative z-10 font-tech text-lg uppercase tracking-widest text-cyan-100 group-hover:text-white group-hover:shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-all">
                            {t.common.menu.new_game}
                        </span>
                    </button>

                    <button
                        onClick={loadGame}
                        disabled={!hasSave}
                        className={`w-full group relative overflow-hidden p-4 rounded-lg border transition-all duration-300 ${
                            hasSave 
                            ? 'border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer' 
                            : 'border-transparent bg-black/20 opacity-50 cursor-not-allowed'
                        }`}
                    >
                        <span className={`relative z-10 font-tech text-sm uppercase tracking-widest ${hasSave ? 'text-emerald-300 group-hover:text-emerald-100' : 'text-slate-600'}`}>
                            {t.common.menu.continue_game}
                        </span>
                    </button>

                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
                        <GlassButton onClick={handleImportClick} className="text-xs py-3">
                            {t.common.menu.import_save}
                        </GlassButton>
                        <GlassButton onClick={exportSave} disabled={!hasSave} className="text-xs py-3 disabled:opacity-30">
                            {t.common.menu.export_save}
                        </GlassButton>
                    </div>

                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        className="hidden" 
                        accept=".ids,.json"
                    />
                </div>

                {message && (
                    <div className={`absolute bottom-4 left-0 right-0 mx-auto w-max px-4 py-2 rounded-full text-xs font-bold shadow-lg animate-[fadeIn_0.2s_ease-out] ${message.type === 'error' ? 'bg-red-500/20 text-red-300 border border-red-500/50' : 'bg-green-500/20 text-green-300 border border-green-500/50'}`}>
                        {message.text}
                    </div>
                )}

                <div className="flex gap-4 text-xs font-mono text-slate-500 pt-4">
                    <button onClick={() => setLanguage('en')} className={`${language === 'en' ? 'text-cyan-400' : 'hover:text-slate-300'}`}>ENG</button>
                    <span>|</span>
                    <button onClick={() => setLanguage('es')} className={`${language === 'es' ? 'text-cyan-400' : 'hover:text-slate-300'}`}>ESP</button>
                </div>
                <div className="text-[10px] text-slate-600">v1.2.0 - System Online</div>
            </div>
        </div>
    );
};
