
import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { WAR_DURATION_MS, WAR_PLAYER_ATTACKS } from '../constants';
import { formatDuration, formatNumber } from '../utils';
import { useLanguage } from '../context/LanguageContext';
import { PvpAttackModal } from './PvpAttackModal';

export const WarHUD: React.FC = () => {
    const { gameState } = useGame();
    const { t } = useLanguage();
    const war = gameState.activeWar;
    const [isExpanded, setIsExpanded] = useState(false);
    const [showAttackModal, setShowAttackModal] = useState(false);

    if (!war) return null;

    const totalLootValue = (Object.values(war.lootPool) as number[]).reduce((a, b) => a + b, 0);
    const timeLeft = Math.max(0, (war.startTime + WAR_DURATION_MS) - Date.now());
    const waveTimeLeft = Math.max(0, war.nextWaveTime - Date.now());

    const displayWave = Math.min(war.currentWave, war.totalWaves);

    const handleAttackSent = (newState: any) => {
        if ((window as any)._updateGameState) {
            (window as any)._updateGameState(newState);
        }
    };

    return (
        <>
            <div className="fixed top-24 left-4 z-40 animate-[fadeIn_0.5s_ease-out]">
                <div className={`
                    glass-panel border-l-4 border-l-red-600 bg-red-950/90 backdrop-blur-xl shadow-[0_0_30px_rgba(220,38,38,0.3)]
                    transition-all duration-300 overflow-hidden rounded-r-xl
                    ${isExpanded ? 'w-64' : 'w-14 cursor-pointer hover:w-16'}
                `}>
                    <div 
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-3 flex items-center gap-3 relative z-10"
                    >
                        <div className="shrink-0 w-8 h-8 flex items-center justify-center bg-red-600 rounded-full animate-pulse shadow-[0_0_10px_#dc2626]">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        
                        <div className={`flex-1 min-w-0 transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
                            <div className="text-[10px] text-red-300 uppercase tracking-widest font-bold">{t.common.war.title}</div>
                            <div className="text-white font-mono font-bold text-xs truncate">{t.common.war.vs} {war.enemyName}</div>
                        </div>
                    </div>

                    {isExpanded && (
                        <div className="px-4 pb-4 space-y-3">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-400">{t.common.war.time_left}:</span>
                                <span className="font-mono text-red-200">{formatDuration(timeLeft)}</span>
                            </div>

                            <div>
                                <div className="flex justify-between items-center text-xs mb-1">
                                    <span className="text-slate-400">{t.common.war.wave}:</span>
                                    <span className="text-white font-bold">{displayWave} / {war.totalWaves}</span>
                                </div>
                                <div className="w-full h-1 bg-black rounded-full overflow-hidden">
                                    <div className="h-full bg-red-500" style={{ width: `${(displayWave / war.totalWaves) * 100}%` }}></div>
                                </div>
                                <div className="text-[9px] text-slate-500 mt-1 text-right">
                                    {t.common.war.next_wave}: {formatDuration(waveTimeLeft)}
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center text-xs mb-1">
                                    <span className="text-slate-400">{t.common.war.attacks_left}:</span>
                                    <span className="text-cyan-300 font-bold">{war.playerAttacksLeft} / {WAR_PLAYER_ATTACKS}</span>
                                </div>
                                <button 
                                    onClick={() => setShowAttackModal(true)}
                                    disabled={war.playerAttacksLeft <= 0}
                                    className="w-full py-1 text-xs font-bold bg-red-600/20 hover:bg-red-600/40 text-red-300 border border-red-600/50 rounded uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {t.common.war.launch_counter}
                                </button>
                            </div>

                            <div className="bg-black/30 p-2 rounded border border-white/5">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[9px] text-slate-400 uppercase tracking-wide">{t.common.war.loot_pool}</span>
                                    <span className="text-emerald-400 font-mono text-xs font-bold">${formatNumber(totalLootValue)}</span>
                                </div>
                                <div className="text-[9px] text-slate-500 leading-tight">
                                    {t.common.war.loot_pool_desc}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-center text-xs border-t border-white/10 pt-2">
                                <div>
                                    <div className="text-cyan-400 font-bold">{war.playerVictories}</div>
                                    <div className="text-[9px] text-slate-500">YOU</div>
                                </div>
                                <div>
                                    <div className="text-red-400 font-bold">{war.enemyVictories}</div>
                                    <div className="text-[9px] text-slate-500">ENEMY</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {showAttackModal && (
                <PvpAttackModal 
                    target={{ id: war.enemyId, name: war.enemyName, score: war.enemyScore }}
                    gameState={gameState}
                    onClose={() => setShowAttackModal(false)}
                    onAttackSent={handleAttackSent}
                />
            )}
        </>
    );
};
