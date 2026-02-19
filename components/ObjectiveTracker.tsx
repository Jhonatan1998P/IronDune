
import React, { useEffect, useState, useRef } from 'react';
import { TUTORIAL_STEPS } from '../data/tutorial';
import { useLanguage } from '../context/LanguageContext';
import { useGame } from '../context/GameContext';
import { GlassButton, Icons } from './UIComponents';
import { formatNumber } from '../utils';
import { BUILDING_DEFS } from '../data/buildings';
import { UNIT_DEFS } from '../data/units';
import { BuildingType, UnitType } from '../types';

export const ObjectiveTracker: React.FC = () => {
    const { t } = useLanguage();
    const { gameState, claimTutorialReward, toggleTutorialMinimize, acceptTutorialStep } = useGame();
    
    // Dragging State
    const [dragPosition, setDragPosition] = useState<{x: number, y: number} | null>(null);
    const dragOffset = useRef<{x: number, y: number}>({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const startPos = useRef<{x: number, y: number}>({ x: 0, y: 0 });

    const currentStep = gameState.currentTutorialId ? TUTORIAL_STEPS.find(s => s.id === gameState.currentTutorialId) : null;
    
    const title = currentStep ? (t.tutorial[currentStep.titleKey] || currentStep.titleKey) : '';
    const desc = currentStep ? (t.tutorial[currentStep.descKey] || currentStep.descKey) : '';
    const isComplete = gameState.tutorialClaimable;
    const isMinimized = gameState.isTutorialMinimized;
    const isAccepted = gameState.tutorialAccepted;

    const progressResult = currentStep?.progressCondition ? currentStep.progressCondition(gameState) : false;
    const isInProgress = typeof progressResult === 'number' || (progressResult === true);
    const progressPercent = typeof progressResult === 'number' ? progressResult : 0;

    // --- DRAG HANDLERS ---
    const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const rect = e.currentTarget.getBoundingClientRect();

        isDragging.current = false;
        startPos.current = { x: clientX, y: clientY };
        
        dragOffset.current = {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
        if ('buttons' in e && e.buttons === 0) return;

        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        const dist = Math.sqrt(
            Math.pow(clientX - startPos.current.x, 2) + 
            Math.pow(clientY - startPos.current.y, 2)
        );

        if (dist > 5) {
            isDragging.current = true;
            let newX = clientX - dragOffset.current.x;
            let newY = clientY - dragOffset.current.y;

            const maxX = window.innerWidth - 60;
            const maxY = window.innerHeight - 60;
            
            newX = Math.max(10, Math.min(maxX, newX));
            newY = Math.max(10, Math.min(maxY, newY));

            setDragPosition({ x: newX, y: newY });
        }
    };

    const handleInteractionEnd = () => {
        if (!isDragging.current && !isInProgress) {
            toggleTutorialMinimize();
        }
        isDragging.current = false;
    };

    if (!currentStep) return null;

    // 1. BRIEFING MODAL (Not accepted yet)
    if (!isAccepted) {
        return (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-md animate-[fadeIn_0.3s_ease-out]">
                 <div className="glass-panel max-w-md w-full p-6 m-4 rounded-xl border border-cyan-500/50 shadow-[0_0_50px_rgba(6,182,212,0.3)] relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                         <Icons.Radar />
                     </div>
                     
                     <div className="relative z-10 text-center">
                         <div className="w-16 h-16 mx-auto bg-cyan-900/30 rounded-full flex items-center justify-center border border-cyan-500/50 mb-4 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                             <Icons.Mail />
                         </div>
                         
                         <h2 className="font-tech text-xl text-cyan-300 uppercase tracking-widest mb-2">{title}</h2>
                         <div className="h-px w-24 bg-gradient-to-r from-transparent via-cyan-500 to-transparent mx-auto mb-4"></div>
                         
                         <p className="text-sm text-slate-300 mb-6 leading-relaxed whitespace-pre-line">
                             {desc}
                         </p>

                         <div className="bg-black/30 rounded p-3 mb-6 border border-white/5">
                             <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-2">{t.common.ui.completion_rewards}</span>
                             <div className="flex justify-center gap-3 flex-wrap">
                                 {Object.entries(currentStep.reward).map(([res, amt]) => (
                                     <span key={res} className="text-xs font-mono font-bold text-emerald-400 border border-emerald-500/20 bg-emerald-900/20 px-2 py-1 rounded">
                                         +{formatNumber(amt as number)} {t.common.resources[res]}
                                     </span>
                                 ))}
                                 
                                 {currentStep.buildingReward && Object.entries(currentStep.buildingReward).map(([bId, amt]) => {
                                     const def = BUILDING_DEFS[bId as BuildingType];
                                     const name = t.buildings[def.translationKey]?.name || bId;
                                     return (
                                         <span key={bId} className="text-xs font-mono font-bold text-cyan-400 border border-cyan-500/20 bg-cyan-900/20 px-2 py-1 rounded flex items-center gap-1">
                                             <Icons.Base className="w-3 h-3" /> +{amt} {name}
                                         </span>
                                     );
                                 })}

                                 {currentStep.unitReward && Object.entries(currentStep.unitReward).map(([uId, amt]) => {
                                     const def = UNIT_DEFS[uId as UnitType];
                                     const name = t.units[def.translationKey]?.name || uId;
                                     return (
                                         <span key={uId} className="text-xs font-mono font-bold text-red-400 border border-red-500/20 bg-red-900/20 px-2 py-1 rounded flex items-center gap-1">
                                             <Icons.Army className="w-3 h-3" /> +{amt} {name}
                                         </span>
                                     );
                                 })}
                             </div>
                         </div>

                         <GlassButton 
                            onClick={acceptTutorialStep}
                            variant="primary"
                            className="w-full py-3 shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                         >
                            {t.common.actions.accept_mission}
                         </GlassButton>
                     </div>
                 </div>
            </div>
        );
    }

    // 2. MINIMIZED / PROGRESS VIEW
    if (isMinimized || isInProgress) {
        const radius = 20;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

        const containerStyle = dragPosition 
            ? { left: dragPosition.x, top: dragPosition.y, bottom: 'auto', right: 'auto' } 
            : {}; 

        const containerClass = dragPosition 
            ? "fixed z-[10000] flex flex-row-reverse items-center gap-2 touch-none"
            : "fixed bottom-24 right-6 md:bottom-6 md:right-6 z-[10000] flex flex-row-reverse items-center gap-2 animate-[fadeIn_0.3s_ease-out] touch-none";

        return (
            <div 
                className={containerClass}
                style={containerStyle}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleInteractionEnd}
                onMouseDown={handleTouchStart}
                onMouseMove={handleTouchMove}
                onMouseUp={handleInteractionEnd}
                onMouseLeave={() => { isDragging.current = false; }}
            >
                <button 
                    disabled={isInProgress}
                    className={`
                        p-3 glass-panel rounded-full border shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-colors group relative flex items-center justify-center w-14 h-14 select-none
                        ${isInProgress ? 'border-cyan-500/30 bg-slate-900/80 text-cyan-400' : 'border-cyan-500/30 bg-cyan-950/40 text-cyan-400 hover:scale-105 cursor-move'}
                    `}
                    title={t.common.ui.open_orders}
                >
                    {isInProgress && (
                        <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none overflow-visible">
                            <circle
                                cx="50%"
                                cy="50%"
                                r={radius}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeOpacity="0.2"
                            />
                            <circle
                                cx="50%"
                                cy="50%"
                                r={radius}
                                fill="none"
                                stroke={progressPercent >= 100 ? '#10b981' : 'currentColor'}
                                strokeWidth="3"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                                className="transition-all duration-500 linear"
                            />
                        </svg>
                    )}

                    <div className="relative z-10 flex items-center justify-center pointer-events-none">
                        {isInProgress ? (
                            progressPercent >= 100 ? <div className="text-emerald-400 animate-bounce"><Icons.Crown /></div> : 
                            <span className="text-[10px] font-mono font-bold">{Math.floor(progressPercent)}%</span>
                        ) : (
                            <Icons.Mail />
                        )}
                        {isComplete && !isInProgress && (
                            <div className="absolute -top-2 -right-2 w-3 h-3 bg-emerald-500 rounded-full animate-pulse border border-black"></div>
                        )}
                    </div>
                </button>
            </div>
        );
    }

    // 3. FULL ACTIVE CARD (Bottom Left Fixed)
    return (
        <div className={`fixed bottom-4 left-4 z-[10000] w-72 glass-panel rounded-lg overflow-hidden border transition-all duration-500 ${isComplete ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'border-cyan-500/30 shadow-lg'} animate-[fadeIn_0.3s_ease-out]`}>
            <div className={`px-4 py-2 flex justify-between items-center ${isComplete ? 'bg-emerald-900/40' : 'bg-cyan-950/40'}`}>
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isComplete ? 'bg-emerald-400 animate-none' : 'bg-cyan-400 animate-pulse'}`}></div>
                    <span className={`text-xs font-bold uppercase tracking-widest ${isComplete ? 'text-emerald-300' : 'text-cyan-300'}`}>
                        {isComplete ? t.common.ui.completed : t.common.ui.objective}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={toggleTutorialMinimize}
                        className="text-slate-400 hover:text-white transition-colors p-1"
                        title="Minimize"
                    >
                        <Icons.Minimize />
                    </button>
                </div>
            </div>

            <div className="p-4 bg-black/90 backdrop-blur-md">
                <h3 className="font-tech text-white text-sm font-bold mb-1">{title}</h3>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed whitespace-pre-line">{desc}</p>

                {isComplete && (
                    <GlassButton 
                        onClick={claimTutorialReward} 
                        variant="primary" 
                        className="w-full text-xs animate-pulse shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                    >
                        {t.common.actions.claim_reward}
                    </GlassButton>
                )}
            </div>
        </div>
    );
};
