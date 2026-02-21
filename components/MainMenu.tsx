
import React, { useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useGame } from '../context/GameContext';
import { GlassButton, Icons } from './UIComponents';

export const MainMenu: React.FC = () => {
    const { t, language, setLanguage } = useLanguage();
    const { hasSave, startNewGame, loadGame, importSave, exportSave } = useGame();
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);

    const [isTransitioning, setIsTransitioning] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(0);

    const simulateLoading = (callback: () => void) => {
        setIsTransitioning(true);
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 30;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                setTimeout(callback, 200);
            }
            setLoadingProgress(progress);
        }, 100);
    };

    const handleNewGameClick = () => {
        if (hasSave) {
            if (window.confirm(t.common.menu.confirm_new)) {
                simulateLoading(() => startNewGame());
            }
        } else {
            simulateLoading(() => startNewGame());
        }
    };

    const handleContinueClick = () => {
        simulateLoading(() => loadGame());
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
            {/* Ambient Background Effects */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] animate-pulse"></div>
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/5 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-600/5 rounded-full blur-[100px]"></div>
            </div>

            <div className="glass-panel w-full max-w-md p-8 md:p-10 rounded-2xl border border-white/10 shadow-[0_0_60px_rgba(6,182,212,0.15)] relative z-10 flex flex-col items-center gap-8 backdrop-blur-xl">
                
                <div className="text-center space-y-4">
                    <div className="relative w-20 h-20 mx-auto mb-6 group">
                        <div className="absolute inset-0 bg-cyan-500 blur-xl opacity-40 group-hover:opacity-60 transition-opacity duration-500"></div>
                        <div className="relative w-full h-full bg-gradient-to-br from-cyan-400 to-blue-700 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)] border border-white/20">
                            <span className="font-tech text-3xl font-bold text-white drop-shadow-md">ID</span>
                        </div>
                    </div>
                    
                    <div>
                        <h1 className="font-tech text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-200 via-white to-cyan-200 tracking-wider uppercase drop-shadow-sm">
                            Iron Dune
                        </h1>
                        <p className="font-mono text-xs text-cyan-400/80 tracking-[0.4em] uppercase mt-2">Operations Command</p>
                    </div>
                </div>

                <div className="w-full space-y-4">
                    <button
                        onClick={handleNewGameClick}
                        disabled={isTransitioning}
                        className={`w-full group relative overflow-hidden p-4 rounded-lg border border-cyan-500/30 bg-cyan-950/40 hover:bg-cyan-900/50 transition-all duration-300 shadow-[0_0_15px_rgba(6,182,212,0.1)\] hover:shadow-[0_0_25px_rgba(6,182,212,0.25)\] ${isTransitioning ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity transform -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] duration-1000"></div>
                        <span className="relative z-10 font-tech text-lg uppercase tracking-[0.2em] text-cyan-100 group-hover:text-white transition-colors flex items-center justify-center gap-3">
                            <Icons.Radar className="w-5 h-5" />
                            {t.common.menu.new_game}
                        </span>
                    </button>

                    <button
                        onClick={handleContinueClick}
                        disabled={!hasSave || isTransitioning}
                        className={`w-full group relative overflow-hidden p-4 rounded-lg border transition-all duration-300 ${
                            hasSave 
                            ? 'border-emerald-500/20 bg-emerald-950/20 hover:bg-emerald-900/30 hover:border-emerald-500/40 cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.05)]' 
                            : 'border-white/5 bg-white/5 opacity-50 cursor-not-allowed'
                        } ${isTransitioning ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                        <span className={`relative z-10 font-tech text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-2 ${hasSave ? 'text-emerald-300 group-hover:text-emerald-100' : 'text-slate-500'}`}>
                            {hasSave && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>}
                            {t.common.menu.continue_game}
                        </span>
                    </button>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                        <GlassButton onClick={handleImportClick} className="text-xs py-3 bg-slate-800/50 hover:bg-slate-700/50 border-slate-600/30">
                            {t.common.menu.import_save}
                        </GlassButton>
                        <GlassButton onClick={exportSave} disabled={!hasSave} className="text-xs py-3 bg-slate-800/50 hover:bg-slate-700/50 border-slate-600/30 disabled:opacity-30">
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
                    <div className={`absolute bottom-20 left-0 right-0 mx-auto w-max px-6 py-2 rounded-full text-xs font-bold shadow-xl animate-[fadeIn_0.3s_ease-out] backdrop-blur-md ${message.type === 'error' ? 'bg-red-500/20 text-red-300 border border-red-500/50' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'}`}>
                        {message.text}
                    </div>
                )}

                <div className="flex flex-col items-center gap-2 pt-2">
                    <div className="flex gap-4 text-xs font-mono text-slate-500">
                        <button onClick={() => setLanguage('en')} className={`transition-colors ${language === 'en' ? 'text-cyan-400 font-bold glow' : 'hover:text-slate-300'}`}>ENG</button>
                        <span className="opacity-30">|</span>
                        <button onClick={() => setLanguage('es')} className={`transition-colors ${language === 'es' ? 'text-cyan-400 font-bold glow' : 'hover:text-slate-300'}`}>ESP</button>
                    </div>
                    <div className="text-[9px] text-slate-700 font-mono">SYS.VER.1.2.2 // SECURE CONNECTION</div>
                </div>
            </div>

            {/* Transition Overlay */}
            {isTransitioning && (
                <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center animate-in fade-in duration-300">
                    <div className="relative w-48 h-48 mb-8">
                        <div className="absolute inset-0 border-2 border-cyan-500/20 rounded-full"></div>
                        <div className="absolute inset-0 border-t-2 border-cyan-400 rounded-full animate-spin"></div>
                        <div className="absolute inset-4 border border-cyan-500/10 rounded-full animate-pulse"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Icons.Radar className="w-12 h-12 text-cyan-400 animate-pulse" />
                        </div>
                    </div>
                    <div className="w-64 h-1 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                        <div 
                            className="h-full bg-gradient-to-r from-cyan-600 to-blue-400 transition-all duration-300 ease-out"
                            style={{ width: `${loadingProgress}%` }}
                        ></div>
                    </div>
                    <p className="mt-4 font-tech text-xs text-cyan-400 tracking-[0.3em] uppercase animate-pulse">
                        {loadingProgress < 100 ? 'Initializing Systems...' : 'Access Granted'}
                    </p>
                </div>
            )}
        </div>
    );
};
