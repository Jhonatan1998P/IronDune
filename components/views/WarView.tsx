
import React from 'react';
import { GameState, ResourceType, UnitType } from '../../types';
import { UNIT_DEFS } from '../../data/units';
import { useLanguage } from '../../context/LanguageContext';
import { GlassButton, Icons, SpeedUpButton } from '../UIComponents';
import { formatDuration, formatNumber } from '../../utils';
import { WAR_DURATION_MS, WAR_PLAYER_ATTACKS, WAR_TOTAL_WAVES } from '../../constants';
import { PvpAttackModal } from '../PvpAttackModal';

interface WarViewProps {
    gameState: GameState;
    onSpy: (attackId: string) => void;
    onSimulate?: (enemyUnits: Partial<Record<UnitType, number>>) => void;
}

const StatBar: React.FC<{ label: string; playerVal: number; enemyVal: number; format?: boolean; color: string }> = ({ label, playerVal, enemyVal, format = true, color }) => {
    const total = playerVal + enemyVal;
    const playerPercent = total === 0 ? 50 : (playerVal / total) * 100;
    
    return (
        <div className="mb-3">
            <div className="flex justify-between text-xs mb-1 font-mono">
                <span className="text-slate-400">{label}</span>
            </div>
            <div className="flex justify-between items-end mb-1">
                <span className={`${color} font-bold`}>{format ? formatNumber(playerVal) : playerVal}</span>
                <span className="text-red-400 font-bold">{format ? formatNumber(enemyVal) : enemyVal}</span>
            </div>
            <div className="h-2 bg-slate-900 rounded-full overflow-hidden flex w-full">
                <div className={`h-full ${color.replace('text-', 'bg-')}`} style={{ width: `${playerPercent}%` }}></div>
                <div className="h-full bg-red-600" style={{ width: `${100 - playerPercent}%` }}></div>
            </div>
        </div>
    );
};

export const WarView: React.FC<WarViewProps> = ({ gameState, onSpy, onSimulate }) => {
    const { t } = useLanguage();
    const war = gameState.activeWar;
    const [showAttackModal, setShowAttackModal] = React.useState(false);

    // If no war, show placeholder (shouldn't happen if navigation logic is correct, but safety first)
    if (!war) {
        return (
            <div className="h-full flex items-center justify-center animate-[fadeIn_0.3s_ease-out]">
                <div className="text-center text-slate-500">
                    <Icons.Shield />
                    <p className="mt-2 text-sm uppercase tracking-widest">{t.common.ui.peace_time}</p>
                </div>
            </div>
        );
    }

    const timeLeft = Math.max(0, (war.startTime + WAR_DURATION_MS) - Date.now());
    const totalBattles = war.playerVictories + war.enemyVictories;
    const winRate = totalBattles === 0 ? 0 : (war.playerVictories / totalBattles) * 100;

    // Find the next incoming wave for intelligence
    const nextWave = gameState.incomingAttacks.find(a => a.isWarWave && a.endTime > Date.now());
    const waveTimeLeft = nextWave ? Math.max(0, nextWave.endTime - Date.now()) : 0;
    const espionageCost = war.enemyScore * 64;
    const canAffordEspionage = gameState.resources[ResourceType.GOLD] >= espionageCost;

    const handleAttackSent = (newState: GameState) => {
        if ((window as any)._updateGameState) {
            (window as any)._updateGameState(newState);
        }
    };

    // Calculate payout (50% of the pool)
    const payout = {
        [ResourceType.MONEY]: Math.floor(war.lootPool[ResourceType.MONEY] * 0.5),
        [ResourceType.OIL]: Math.floor(war.lootPool[ResourceType.OIL] * 0.5),
        [ResourceType.AMMO]: Math.floor(war.lootPool[ResourceType.AMMO] * 0.5),
        [ResourceType.GOLD]: Math.floor(war.lootPool[ResourceType.GOLD] * 0.5),
        [ResourceType.DIAMOND]: Math.floor(war.lootPool[ResourceType.DIAMOND] * 0.5)
    };

    const hasLoot = Object.values(payout).some(v => v > 0);

    return (
        <div className="flex flex-col h-full animate-[fadeIn_0.3s_ease-out] gap-4 pb-20 relative">
            
            {showAttackModal && (
                <PvpAttackModal 
                    target={{ id: war.enemyId, name: war.enemyName, score: war.enemyScore }}
                    gameState={gameState}
                    onClose={() => setShowAttackModal(false)}
                    onAttackSent={handleAttackSent}
                />
            )}

            {/* Header / Timer */}
            <div className="glass-panel p-6 rounded-xl border-red-500/30 bg-red-950/20 text-center relative overflow-hidden shrink-0">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                <div className="relative z-10">
                    <h1 className="font-tech text-3xl text-red-500 uppercase tracking-widest mb-1 drop-shadow-lg glow">{t.common.war.title}</h1>
                    <p className="text-white font-bold text-lg mb-4">{t.common.war.vs} {war.enemyName}</p>
                    
                    <div className="inline-block bg-black/40 px-4 py-2 rounded border border-red-500/30">
                        <div className="text-[10px] text-red-300 uppercase tracking-widest mb-1">{t.common.war.time_left}</div>
                        <div className="font-mono text-2xl text-white font-bold tracking-widest">
                            {formatDuration(timeLeft)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Scoreboard */}
            <div className="grid grid-cols-3 gap-2 shrink-0">
                <div className="glass-panel p-4 rounded-lg border-cyan-500/20 text-center flex flex-col justify-center">
                    <span className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold">{t.features.war.you}</span>
                    <span className="text-3xl font-mono text-white font-bold">{war.playerVictories}</span>
                    <span className="text-[9px] text-slate-500 uppercase">{t.features.war.wins}</span>
                </div>
                <div className="glass-panel p-4 rounded-lg border-white/10 text-center flex flex-col justify-center">
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{t.features.war.rate}</span>
                    <span className="text-2xl font-mono text-yellow-400 font-bold">{Math.round(winRate)}%</span>
                    <span className="text-[9px] text-slate-500 uppercase">{t.features.war.success}</span>
                </div>
                <div className="glass-panel p-4 rounded-lg border-red-500/20 text-center flex flex-col justify-center">
                    <span className="text-[10px] text-red-400 uppercase tracking-widest font-bold">{t.features.war.enemy}</span>
                    <span className="text-3xl font-mono text-white font-bold">{war.enemyVictories}</span>
                    <span className="text-[9px] text-slate-500 uppercase">{t.features.war.wins}</span>
                </div>
            </div>

            {/* --- INTELLIGENCE SECTION (New) --- */}
            {nextWave && (
                <div className="glass-panel p-4 rounded-xl border border-red-500/30 shrink-0">
                    <h3 className="font-tech text-sm text-red-400 uppercase tracking-widest border-b border-red-500/20 pb-2 mb-3 flex justify-between items-center">
                        <span>{t.features.war.next_threat} (Wave {war.currentWave})</span>
                        <span className="font-mono text-white bg-red-900/40 px-2 py-1 rounded text-xs">{formatDuration(waveTimeLeft)}</span>
                    </h3>

                    {nextWave.isScouted ? (
                        <>
                            <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar bg-black/20 p-2 rounded mb-2">
                                {Object.entries(nextWave.units).map(([uType, count]) => {
                                    const def = UNIT_DEFS[uType as UnitType];
                                    return (
                                        <div key={uType} className="flex justify-between text-xs text-slate-300">
                                            <span>{t.units[def.translationKey]?.name || uType}</span>
                                            <span className="font-mono font-bold text-red-400">{count}</span>
                                        </div>
                                    )
                                })}
                            </div>
                            {onSimulate && (
                                <button
                                    onClick={() => onSimulate(nextWave.units)}
                                    className="w-full py-1.5 rounded border border-cyan-500/30 bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition-colors text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2"
                                >
                                    <Icons.Simulate />
                                    {t.common.actions.simulate}
                                </button>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col gap-2">
                            <div className="bg-black/30 p-3 rounded flex items-center justify-center gap-2 text-slate-500 text-xs italic border border-white/5">
                                <span className="text-red-500 font-bold text-xl">???</span>
                                <span>{t.common.ui.intel_unknown}</span>
                            </div>
                            <button
                                onClick={() => onSpy(nextWave.id)}
                                disabled={!canAffordEspionage}
                                className="w-full py-2 bg-yellow-900/20 hover:bg-yellow-900/40 border border-yellow-500/30 text-yellow-300 text-xs font-bold uppercase tracking-wider rounded disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {t.common.actions.spy} ({formatNumber(espionageCost)} Gold)
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Tactical Status */}
            <div className="glass-panel p-4 rounded-xl border border-white/10 flex flex-col gap-4">
                <h3 className="font-tech text-sm text-slate-300 uppercase tracking-widest border-b border-white/10 pb-2">
                    {t.features.war.tactical_status}
                </h3>
                
                <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="bg-black/20 p-3 rounded border border-white/5">
                        <span className="block text-slate-500 mb-1">{t.common.war.wave}</span>
                        <span className="text-lg text-white font-bold">{war.currentWave} / {WAR_TOTAL_WAVES}</span>
                        <div className="w-full h-1 bg-slate-800 rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-red-500" style={{ width: `${(war.currentWave / WAR_TOTAL_WAVES) * 100}%` }}></div>
                        </div>
                    </div>
                    <div className="bg-black/20 p-3 rounded border border-white/5">
                        <span className="block text-slate-500 mb-1">{t.common.war.attacks_left}</span>
                        <span className="text-lg text-cyan-400 font-bold">{war.playerAttacksLeft} / {WAR_PLAYER_ATTACKS}</span>
                        <div className="w-full h-1 bg-slate-800 rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-cyan-500" style={{ width: `${(war.playerAttacksLeft / WAR_PLAYER_ATTACKS) * 100}%` }}></div>
                        </div>
                    </div>
                </div>

                <GlassButton 
                    onClick={() => setShowAttackModal(true)}
                    disabled={war.playerAttacksLeft <= 0}
                    variant="primary"
                    className="w-full py-3 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                >
                    {t.common.war.launch_counter}
                </GlassButton>
            </div>

            {/* Casualties & Cost Report */}
            <div className="flex-1 glass-panel p-4 rounded-xl border border-white/10 overflow-y-auto custom-scrollbar">
                <h3 className="font-tech text-sm text-slate-300 uppercase tracking-widest border-b border-white/10 pb-2 mb-4 flex justify-between">
                    <span>{t.features.war.losses_report}</span>
                    <span className="text-[10px] text-slate-500">{t.features.war.you} vs {t.features.war.enemy}</span>
                </h3>

                <StatBar 
                    label={t.features.war.troop_casualties}
                    playerVal={war.playerUnitLosses} 
                    enemyVal={war.enemyUnitLosses} 
                    color="text-cyan-400" 
                />

                <div className="h-px bg-white/5 my-4"></div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-3 font-bold">{t.features.war.investment_lost}</div>

                <StatBar 
                    label={t.common.resources.MONEY}
                    playerVal={war.playerResourceLosses[ResourceType.MONEY]} 
                    enemyVal={war.enemyResourceLosses[ResourceType.MONEY]} 
                    color="text-green-400" 
                />
                
                <StatBar 
                    label={t.common.resources.OIL}
                    playerVal={war.playerResourceLosses[ResourceType.OIL]} 
                    enemyVal={war.enemyResourceLosses[ResourceType.OIL]} 
                    color="text-purple-400" 
                />

                <StatBar 
                    label={t.common.resources.AMMO}
                    playerVal={war.playerResourceLosses[ResourceType.AMMO]} 
                    enemyVal={war.enemyResourceLosses[ResourceType.AMMO]} 
                    color="text-orange-400" 
                />

                <StatBar 
                    label={t.common.resources.GOLD}
                    playerVal={war.playerResourceLosses[ResourceType.GOLD]} 
                    enemyVal={war.enemyResourceLosses[ResourceType.GOLD]} 
                    color="text-yellow-400" 
                />
            </div>
        </div>
    );
};
