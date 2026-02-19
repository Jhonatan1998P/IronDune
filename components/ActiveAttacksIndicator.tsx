
import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { formatDuration } from '../utils';
import { useLanguage } from '../context/LanguageContext';
import { TacticalInterceptModal } from './modals/TacticalInterceptModal';
import { Icons } from './UIComponents';

export const ActiveAttacksIndicator: React.FC = () => {
    const { gameState, spyOnAttacker } = useGame();
    const { t } = useLanguage();
    const incomingAttacks = gameState.incomingAttacks || [];
    const outboundAttacks = gameState.activeMissions.filter(m => m.type === 'PVP_ATTACK');
    
    // Manage Modal State
    const [selectedAttackId, setSelectedAttackId] = useState<string | null>(null);

    const hasIncoming = incomingAttacks.length > 0;
    const hasOutbound = outboundAttacks.length > 0;

    // Find the most imminent attack to display on the bar
    const imminentAttack = hasIncoming 
        ? incomingAttacks.sort((a, b) => a.endTime - b.endTime)[0] 
        : null;

    if (!hasIncoming && !hasOutbound) return null;

    return (
        <>
            {selectedAttackId && imminentAttack && (
                <TacticalInterceptModal 
                    attack={incomingAttacks.find(a => a.id === selectedAttackId) || imminentAttack}
                    gameState={gameState}
                    onClose={() => setSelectedAttackId(null)}
                    onDecrypt={spyOnAttacker}
                />
            )}

            {/* Container for floating bars - Centered Top on Mobile/Desktop or just standard flow */}
            <div className="xl:hidden fixed top-20 left-0 right-0 z-40 flex flex-col items-center gap-2 px-4 pointer-events-none">
                
                {/* 1. INCOMING THREAT BAR (High Priority) */}
                {imminentAttack && (
                    <button 
                        onClick={() => setSelectedAttackId(imminentAttack.id)}
                        className="pointer-events-auto w-full max-w-md bg-red-950/90 backdrop-blur-md border border-red-500 shadow-[0_0_20px_rgba(220,38,38,0.6)] rounded-lg overflow-hidden relative group animate-in slide-in-from-top duration-500"
                    >
                        {/* Striped Background Animation */}
                        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,0,0,0.1)_25%,rgba(255,0,0,0.1)_50%,transparent_50%,transparent_75%,rgba(255,0,0,0.1)_75%,rgba(255,0,0,0.1)_100%)] bg-[length:20px_20px] animate-[drift_2s_linear_infinite]"></div>
                        
                        <div className="flex items-center justify-between p-3 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="bg-red-600 text-black font-bold text-[10px] px-2 py-1 rounded animate-pulse">
                                    {t.common.ui.warning}
                                </div>
                                <div className="flex flex-col items-start">
                                    <span className="text-[10px] text-red-300 uppercase tracking-widest font-bold">{t.common.ui.hostile_signal}</span>
                                    <span className="text-xs text-white font-tech truncate max-w-[150px]">{imminentAttack.attackerName}</span>
                                </div>
                            </div>
                            
                            <div className="text-right">
                                <span className="block text-[10px] text-red-400 uppercase tracking-wider">{t.common.ui.impact}</span>
                                <span className="font-mono text-lg font-bold text-white leading-none">
                                    {formatDuration(Math.max(0, imminentAttack.endTime - Date.now()))}
                                </span>
                            </div>
                        </div>
                        
                        {/* Bottom Progress Bar */}
                        <div className="h-1 bg-black w-full">
                            <div className="h-full bg-red-500 animate-pulse w-full"></div>
                        </div>
                    </button>
                )}

                {/* 2. OUTBOUND MISSION PILL (Lower Priority) */}
                {hasOutbound && (
                    <div className="pointer-events-auto bg-yellow-950/90 backdrop-blur-md border border-yellow-500/50 rounded-full px-4 py-2 shadow-lg flex items-center gap-3 animate-in slide-in-from-top duration-700 delay-100">
                        <Icons.Army className="w-4 h-4 text-yellow-400" />
                        <span className="text-[10px] font-bold text-yellow-100 uppercase tracking-wider">
                            {outboundAttacks.length} {t.common.ui.attack_outbound}
                        </span>
                        <span className="font-mono text-xs text-white font-bold border-l border-yellow-500/30 pl-3">
                            {formatDuration(Math.max(0, outboundAttacks[0].endTime - Date.now()))}
                        </span>
                    </div>
                )}
            </div>
        </>
    );
};
