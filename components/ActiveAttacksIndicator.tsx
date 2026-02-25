import React, { useState, useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { formatDuration } from '../utils';
import { useLanguage } from '../context/LanguageContext';
import { TacticalInterceptModal } from './modals/TacticalInterceptModal';
import { Icons } from './UIComponents';
import { ActiveMission, IncomingAttack, UnitType } from '../types';
import { UNIT_DEFS } from '../data/units';

interface AlertConfig {
    id: string;
    type: 'attack' | 'outbound' | 'campaign' | 'patrol';
    label: string;
    labelPlural: string;
    color: {
        bg: string;
        border: string;
        shadow: string;
        badge: string;
        text: string;
    };
    icon: string;
}

const ALERT_CONFIGS: Record<string, AlertConfig> = {
    attack: {
        id: 'attack',
        type: 'attack',
        label: 'hostile_signal',
        labelPlural: 'hostile_signals',
        color: {
            bg: 'bg-red-950/95',
            border: 'border-red-500/60',
            shadow: 'shadow-[0_0_15px_rgba(220,38,38,0.5)]',
            badge: 'bg-red-600 text-black',
            text: 'text-red-300'
        },
        icon: '!'
    },
    outbound: {
        id: 'outbound',
        type: 'outbound',
        label: 'attack_outbound',
        labelPlural: 'attacks_outbound',
        color: {
            bg: 'bg-yellow-950/95',
            border: 'border-yellow-500/60',
            shadow: 'shadow-[0_0_15px_rgba(234,179,8,0.4)]',
            badge: 'bg-yellow-600 text-black',
            text: 'text-yellow-300'
        },
        icon: '>'
    },
    campaign: {
        id: 'campaign',
        type: 'campaign',
        label: 'mission_campaign',
        labelPlural: 'campaigns_active',
        color: {
            bg: 'bg-blue-950/95',
            border: 'border-blue-500/60',
            shadow: 'shadow-[0_0_15px_rgba(59,130,246,0.4)]',
            badge: 'bg-blue-600 text-white',
            text: 'text-blue-300'
        },
        icon: 'M'
    },
    patrol: {
        id: 'patrol',
        type: 'patrol',
        label: 'mission_patrol',
        labelPlural: 'patrols_active',
        color: {
            bg: 'bg-green-950/95',
            border: 'border-green-500/60',
            shadow: 'shadow-[0_0_15px_rgba(34,197,94,0.4)]',
            badge: 'bg-green-600 text-black',
            text: 'text-green-300'
        },
        icon: 'P'
    }
};

interface AlertBadgeProps {
    config: AlertConfig;
    count: number;
    timeRemaining: number;
    onClick: () => void;
}

const AlertBadge: React.FC<AlertBadgeProps> = ({ config, count, timeRemaining, onClick }) => {
    const { t } = useLanguage();
    const isPulsing = config.id === 'attack' && count === 1;
    const label = count > 1 
        ? `${count} ${t.common.ui[config.labelPlural as keyof typeof t.common.ui] || config.labelPlural}`
        : t.common.ui[config.label as keyof typeof t.common.ui] || config.label;

    return (
        <button 
            onClick={onClick}
            className={`${config.color.bg} backdrop-blur-md border ${config.color.border} ${config.color.shadow} rounded-md overflow-hidden transition-transform hover:scale-105 active:scale-95`}
        >
            <div className="flex items-center gap-2 px-2 py-1.5">
                <div className={`flex items-center justify-center min-w-[18px] h-[18px] ${config.color.badge} font-bold text-[8px] px-1 rounded ${isPulsing ? 'animate-pulse' : ''}`}>
                    {count > 1 ? count : config.icon}
                </div>
                <div className="flex flex-col items-start min-w-0 flex-1">
                    <span className={`text-[8px] ${config.color.text} uppercase tracking-wider font-bold leading-tight truncate w-full`}>
                        {label}
                    </span>
                </div>
                <div className="text-right shrink-0">
                    <span className="font-mono text-xs font-bold text-white leading-none">
                        {formatDuration(Math.max(0, timeRemaining))}
                    </span>
                </div>
            </div>
        </button>
    );
};

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
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-slate-900 border border-white/20 rounded-xl shadow-2xl max-w-md w-full max-h-[80dvh] overflow-y-auto p-4 animate-[fadeIn_0.2s_ease-out]">
                {children}
            </div>
        </div>
    );
};

interface MissionDetailsProps {
    mission: ActiveMission;
    onClose: () => void;
}

const MissionDetails: React.FC<MissionDetailsProps> = ({ mission, onClose }) => {
    const { t } = useLanguage();
    const totalUnits = Object.values(mission.units).reduce((a: number, b: number | undefined) => a + (b || 0), 0);

    const getMissionInfo = () => {
        switch (mission.type) {
            case 'PVP_ATTACK':
                return { icon: Icons.Army, iconColor: 'text-yellow-400', label: t.common.ui.attack_outbound };
            case 'CAMPAIGN_ATTACK':
                return { icon: Icons.Radar, iconColor: 'text-blue-400', label: t.common.ui.mission_campaign };
            default:
                return { icon: Icons.Radar, iconColor: 'text-green-400', label: t.common.ui.mission_patrol };
        }
    };

    const { icon: MissionIcon, iconColor, label } = getMissionInfo();

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-3">
                    <MissionIcon className={`w-5 h-5 ${iconColor}`} />
                    <div>
                        <div className="text-xs text-slate-400 uppercase tracking-widest">{label}</div>
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

const getEarliestItem = <T extends { endTime: number }>(items: T[]): T | null => {
    if (items.length === 0) return null;
    return items.sort((a, b) => a.endTime - b.endTime)[0];
};

const filterMissions = (missions: ActiveMission[], type: ActiveMission['type']) => 
    missions.filter(m => m.type === type);

export const ActiveAttacksIndicator: React.FC = () => {
    const { gameState, spyOnAttacker } = useGame();
    
    const [selectedAttackId, setSelectedAttackId] = useState<string | null>(null);
    const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);

    const { incomingAttacks, activeMissions, alertData } = useMemo(() => {
        const incoming = gameState.incomingAttacks || [];
        const missions = gameState.activeMissions || [];
        
        const outbound = filterMissions(missions, 'PVP_ATTACK');
        const campaign = filterMissions(missions, 'CAMPAIGN_ATTACK');
        const patrol = filterMissions(missions, 'PATROL');

        return {
            incomingAttacks: incoming,
            activeMissions: missions,
            alertData: {
                incoming: { 
                    items: incoming, 
                    earliest: getEarliestItem(incoming),
                    config: ALERT_CONFIGS.attack 
                },
                outbound: { 
                    items: outbound, 
                    earliest: getEarliestItem(outbound),
                    config: ALERT_CONFIGS.outbound 
                },
                campaign: { 
                    items: campaign, 
                    earliest: getEarliestItem(campaign),
                    config: ALERT_CONFIGS.campaign 
                },
                patrol: { 
                    items: patrol, 
                    earliest: getEarliestItem(patrol),
                    config: ALERT_CONFIGS.patrol 
                }
            }
        };
    }, [gameState.incomingAttacks, gameState.activeMissions]);

    const hasAnyAlert = Object.values(alertData).some(data => data.items.length > 0);
    const selectedMission = selectedMissionId 
        ? activeMissions.find(m => m.id === selectedMissionId) 
        : null;

    if (!hasAnyAlert) return null;

    const handleAttackClick = (attack: IncomingAttack | null) => {
        if (attack) setSelectedAttackId(attack.id);
    };

    const handleMissionClick = (missionId: string) => {
        setSelectedMissionId(missionId);
    };

    return (
        <>
            {selectedAttackId && alertData.incoming.earliest && (
                <TacticalInterceptModal 
                    attack={incomingAttacks.find(a => a.id === selectedAttackId) || alertData.incoming.earliest}
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
                    <MissionDetails 
                        mission={selectedMission} 
                        onClose={() => setSelectedMissionId(null)}
                    />
                )}
            </TooltipModal>

            <div className="flex flex-col gap-1.5 max-w-[180px]">
                {alertData.incoming.items.length > 0 && (
                    <AlertBadge 
                        config={alertData.incoming.config}
                        count={alertData.incoming.items.length}
                        timeRemaining={alertData.incoming.earliest!.endTime - Date.now()}
                        onClick={() => handleAttackClick(alertData.incoming.earliest)}
                    />
                )}

                {alertData.outbound.items.length > 0 && (
                    <AlertBadge 
                        config={alertData.outbound.config}
                        count={alertData.outbound.items.length}
                        timeRemaining={alertData.outbound.earliest!.endTime - Date.now()}
                        onClick={() => handleMissionClick(alertData.outbound.earliest!.id)}
                    />
                )}

                {alertData.campaign.items.length > 0 && (
                    <AlertBadge 
                        config={alertData.campaign.config}
                        count={alertData.campaign.items.length}
                        timeRemaining={alertData.campaign.earliest!.endTime - Date.now()}
                        onClick={() => handleMissionClick(alertData.campaign.earliest!.id)}
                    />
                )}

                {alertData.patrol.items.length > 0 && (
                    <AlertBadge 
                        config={alertData.patrol.config}
                        count={alertData.patrol.items.length}
                        timeRemaining={alertData.patrol.earliest!.endTime - Date.now()}
                        onClick={() => handleMissionClick(alertData.patrol.earliest!.id)}
                    />
                )}
            </div>
        </>
    );
};
