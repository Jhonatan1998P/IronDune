import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { formatDuration } from '../utils';
import { useLanguage } from '../context/LanguageContext';
import { TacticalInterceptModal } from './modals/TacticalInterceptModal';
import { Icons } from './UIComponents';
import { ActiveMission, UnitType } from '../types';
import { UNIT_DEFS } from '../data/units';

interface TooltipModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

const TooltipModal: React.FC<TooltipModalProps> = ({ isOpen, onClose, children }) => {
    if (!isOpen) return null;
    
    return (
        <div 
            className="fixed inset-0 z-[130] flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="relative bg-slate-900 border border-white/20 rounded-xl shadow-2xl max-w-md w-full max-h-[80dvh] overflow-y-auto p-4 animate-[fadeIn_0.2s_ease-out]">
                {children}
            </div>
        </div>
    );
};

interface MissionTooltipContentProps {
    mission: ActiveMission;
    t: any;
    onClose: () => void;
}

const MissionTooltipContent: React.FC<MissionTooltipContentProps> = ({ mission, t, onClose }) => {
    const totalUnits = Object.values(mission.units).reduce((a: number, b: number | undefined) => a + (b || 0), 0);
    
    const getMissionIcon = () => {
        if (mission.type === 'PVP_ATTACK') return <Icons.Army className="w-5 h-5 text-yellow-400" />;
        if (mission.type === 'CAMPAIGN_ATTACK') return <Icons.Radar className="w-5 h-5 text-blue-400" />;
        return <Icons.Radar className="w-5 h-5 text-green-400" />;
    };
    
    const getMissionLabel = () => {
        if (mission.type === 'PVP_ATTACK') return t.common.ui.attack_outbound;
        if (mission.type === 'CAMPAIGN_ATTACK') return t.common.ui.mission_campaign;
        return t.common.ui.mission_patrol;
    };
    
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-3">
                    {getMissionIcon()}
                    <div>
                        <div className="text-xs text-slate-400 uppercase tracking-widest">
                            {getMissionLabel()}
                        </div>
                        {mission.type === 'PVP_ATTACK' && mission.targetName && (
                            <div className="text-white font-bold">{mission.targetName}</div>
                        )}
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-xs text-slate-500">{t.common.ui.total}</div>
                    <div className="text-xl font-bold text-white">{totalUnits}</div>
                </div>
            </div>
            
            <div className="space-y-2">
                <div className="text-xs text-slate-400 uppercase tracking-widest">{t.common.ui.troops}</div>
                <div className="grid grid-cols-2 gap-2">
                    {Object.entries(mission.units).map(([uType, count]) => {
                        const def = UNIT_DEFS[uType as UnitType];
                        const name = t.units[def.translationKey]?.name || uType;
                        return (
                            <div key={uType} className="bg-white/5 p-2 rounded flex justify-between items-center">
                                <span className="text-xs text-slate-300 truncate">{name}</span>
                                <span className="font-mono text-white text-xs">{count}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
            
            <div className="flex justify-end">
                <button 
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-bold uppercase tracking-widest bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                >
                    {t.common.actions.close}
                </button>
            </div>
        </div>
    );
};

export const ActiveAttacksIndicator: React.FC = () => {
    const { gameState, spyOnAttacker } = useGame();
    const { t } = useLanguage();
    const incomingAttacks = gameState.incomingAttacks || [];
    const activeMissions = gameState.activeMissions || [];
    
    const outboundAttacks = activeMissions.filter(m => m.type === 'PVP_ATTACK');
    const campaignMissions = activeMissions.filter(m => m.type === 'CAMPAIGN_ATTACK');
    const patrolMissions = activeMissions.filter(m => m.type === 'PATROL');
    
    const [selectedAttackId, setSelectedAttackId] = useState<string | null>(null);
    const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);

    const hasIncoming = incomingAttacks.length > 0;
    const hasOutbound = outboundAttacks.length > 0;
    const hasCampaign = campaignMissions.length > 0;
    const hasPatrol = patrolMissions.length > 0;

    const imminentAttack = hasIncoming 
        ? incomingAttacks.sort((a, b) => a.endTime - b.endTime)[0] 
        : null;

    const earliestOutbound = hasOutbound
        ? outboundAttacks.sort((a, b) => a.endTime - b.endTime)[0]
        : null;

    const earliestCampaign = hasCampaign
        ? campaignMissions.sort((a, b) => a.endTime - b.endTime)[0]
        : null;

    const earliestPatrol = hasPatrol
        ? patrolMissions.sort((a, b) => a.endTime - b.endTime)[0]
        : null;

    if (!hasIncoming && !hasOutbound && !hasCampaign && !hasPatrol) return null;

    const handleMissionClick = (missionId: string) => {
        setSelectedMissionId(missionId);
    };

    const selectedMission = selectedMissionId 
        ? activeMissions.find(m => m.id === selectedMissionId) 
        : null;

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

            <TooltipModal 
                isOpen={!!selectedMission} 
                onClose={() => setSelectedMissionId(null)}
            >
                {selectedMission && (
                    <MissionTooltipContent 
                        mission={selectedMission} 
                        t={t}
                        onClose={() => setSelectedMissionId(null)}
                    />
                )}
            </TooltipModal>

            <div className="xl:hidden fixed top-20 left-0 right-0 z-40 flex flex-col items-center gap-2 px-4 pointer-events-none">
                
                {hasIncoming && (
                    <button 
                        onClick={() => setSelectedAttackId(imminentAttack?.id || null)}
                        className="pointer-events-auto w-full max-w-md bg-red-950/90 backdrop-blur-md border border-red-500 shadow-[0_0_20px_rgba(220,38,38,0.6)] rounded-lg overflow-hidden relative group animate-in slide-in-from-top duration-500"
                    >
                        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,0,0,0.1)_25%,rgba(255,0,0,0.1)_50%,transparent_50%,transparent_75%,rgba(255,0,0,0.1)_75%,rgba(255,0,0,0.1)_100%)] bg-[length:20px_20px] animate-[drift_2s_linear_infinite]"></div>
                        
                        <div className="flex items-center justify-between p-3 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className={`flex items-center justify-center ${incomingAttacks.length > 1 ? 'bg-red-600 text-black font-bold text-xs px-2 py-1 rounded' : 'bg-red-600 text-black font-bold text-[10px] px-2 py-1 rounded animate-pulse'}`}>
                                    {incomingAttacks.length > 1 ? `${incomingAttacks.length}x` : t.common.ui.warning}
                                </div>
                                <div className="flex flex-col items-start">
                                    <span className="text-[10px] text-red-300 uppercase tracking-widest font-bold">
                                        {incomingAttacks.length > 1 ? t.common.ui.hostile_signals : t.common.ui.hostile_signal}
                                    </span>
                                    <span className="text-xs text-white font-tech truncate max-w-[150px]">
                                        {incomingAttacks.length === 1 ? imminentAttack?.attackerName : `${t.common.ui.incoming_attacks}: ${incomingAttacks.length}`}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="text-right">
                                <span className="block text-[10px] text-red-400 uppercase tracking-wider">{t.common.ui.impact}</span>
                                <span className="font-mono text-lg font-bold text-white leading-none">
                                    {formatDuration(Math.max(0, (imminentAttack?.endTime || 0) - Date.now()))}
                                </span>
                            </div>
                        </div>
                        
                        <div className="h-1 bg-black w-full">
                            <div className="h-full bg-red-500 animate-pulse w-full"></div>
                        </div>
                    </button>
                )}

                {hasOutbound && (
                    <button 
                        onClick={() => handleMissionClick(earliestOutbound?.id || '')}
                        className="pointer-events-auto w-full max-w-md bg-yellow-950/90 backdrop-blur-md border border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.4)] rounded-lg overflow-hidden relative"
                    >
                        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(234,179,8,0.1)_25%,rgba(234,179,8,0.1)_50%,transparent_50%,transparent_75%,rgba(234,179,8,0.1)_75%,rgba(234,179,8,0.1)_100%)] bg-[length:20px_20px] animate-[drift_2s_linear_infinite]"></div>
                        
                        <div className="flex items-center justify-between p-3 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="bg-yellow-600 text-black font-bold text-[10px] px-2 py-1 rounded">
                                    {outboundAttacks.length > 1 ? `${outboundAttacks.length}x` : t.common.ui.attack}
                                </div>
                                <div className="flex flex-col items-start">
                                    <span className="text-[10px] text-yellow-300 uppercase tracking-widest font-bold">
                                        {outboundAttacks.length > 1 ? t.common.ui.attacks_outbound : t.common.ui.attack_outbound}
                                    </span>
                                    <span className="text-xs text-white font-tech truncate max-w-[150px]">
                                        {earliestOutbound?.targetName}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="text-right">
                                <span className="block text-[10px] text-yellow-400 uppercase tracking-wider">{t.common.ui.eta}</span>
                                <span className="font-mono text-lg font-bold text-white leading-none">
                                    {formatDuration(Math.max(0, (earliestOutbound?.endTime || 0) - Date.now()))}
                                </span>
                            </div>
                        </div>
                        
                        <div className="h-1 bg-black w-full">
                            <div className="h-full bg-yellow-500 w-full"></div>
                        </div>
                    </button>
                )}

                {hasCampaign && (
                    <button 
                        onClick={() => handleMissionClick(earliestCampaign?.id || '')}
                        className="pointer-events-auto w-full max-w-md bg-blue-950/90 backdrop-blur-md border border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.4)] rounded-lg overflow-hidden relative"
                    >
                        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(59,130,246,0.1)_25%,rgba(59,130,246,0.1)_50%,transparent_50%,transparent_75%,rgba(59,130,246,0.1)_75%,rgba(59,130,246,0.1)_100%)] bg-[length:20px_20px] animate-[drift_2s_linear_infinite]"></div>
                        
                        <div className="flex items-center justify-between p-3 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="bg-blue-600 text-white font-bold text-[10px] px-2 py-1 rounded">
                                    {campaignMissions.length > 1 ? `${campaignMissions.length}x` : t.common.ui.mission}
                                </div>
                                <div className="flex flex-col items-start">
                                    <span className="text-[10px] text-blue-300 uppercase tracking-widest font-bold">
                                        {campaignMissions.length > 1 ? t.common.ui.campaigns_active : t.common.ui.mission_campaign}
                                    </span>
                                    <span className="text-xs text-white font-tech truncate max-w-[150px]">
                                        {t.common.ui.mission_campaign}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="text-right">
                                <span className="block text-[10px] text-blue-400 uppercase tracking-wider">{t.common.ui.eta}</span>
                                <span className="font-mono text-lg font-bold text-white leading-none">
                                    {formatDuration(Math.max(0, (earliestCampaign?.endTime || 0) - Date.now()))}
                                </span>
                            </div>
                        </div>
                        
                        <div className="h-1 bg-black w-full">
                            <div className="h-full bg-blue-500 w-full"></div>
                        </div>
                    </button>
                )}

                {hasPatrol && (
                    <button 
                        onClick={() => handleMissionClick(earliestPatrol?.id || '')}
                        className="pointer-events-auto w-full max-w-md bg-green-950/90 backdrop-blur-md border border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)] rounded-lg overflow-hidden relative"
                    >
                        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(34,197,94,0.1)_25%,rgba(34,197,94,0.1)_50%,transparent_50%,transparent_75%,rgba(34,197,94,0.1)_75%,rgba(34,197,94,0.1)_100%)] bg-[length:20px_20px] animate-[drift_2s_linear_infinite]"></div>
                        
                        <div className="flex items-center justify-between p-3 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="bg-green-600 text-black font-bold text-[10px] px-2 py-1 rounded">
                                    {patrolMissions.length > 1 ? `${patrolMissions.length}x` : t.common.ui.mission}
                                </div>
                                <div className="flex flex-col items-start">
                                    <span className="text-[10px] text-green-300 uppercase tracking-widest font-bold">
                                        {patrolMissions.length > 1 ? t.common.ui.patrols_active : t.common.ui.mission_patrol}
                                    </span>
                                    <span className="text-xs text-white font-tech truncate max-w-[150px]">
                                        {t.common.ui.mission_patrol}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="text-right">
                                <span className="block text-[10px] text-green-400 uppercase tracking-wider">{t.common.ui.eta}</span>
                                <span className="font-mono text-lg font-bold text-white leading-none">
                                    {formatDuration(Math.max(0, (earliestPatrol?.endTime || 0) - Date.now()))}
                                </span>
                            </div>
                        </div>
                        
                        <div className="h-1 bg-black w-full">
                            <div className="h-full bg-green-500 w-full"></div>
                        </div>
                    </button>
                )}
            </div>
        </>
    );
};
