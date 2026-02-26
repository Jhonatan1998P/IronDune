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
        glow: string;
        badge: string;
        icon: string;
        text: string;
    };
    icon: React.FC<{ className?: string }>;
    actionLabel: string;
}

const ALERT_CONFIGS: Record<string, AlertConfig> = {
    attack: {
        id: 'attack',
        type: 'attack',
        label: 'hostile_signal',
        labelPlural: 'hostile_signals',
        color: {
            bg: 'bg-red-950/90',
            border: 'border-red-500/50',
            glow: 'shadow-[0_0_20px_rgba(239,68,68,0.4)]',
            badge: 'bg-red-500 text-white',
            icon: 'text-red-400',
            text: 'text-red-300'
        },
        icon: Icons.Shield,
        actionLabel: 'intercept'
    },
    outbound: {
        id: 'outbound',
        type: 'outbound',
        label: 'attack_outbound',
        labelPlural: 'attacks_outbound',
        color: {
            bg: 'bg-amber-950/90',
            border: 'border-amber-500/50',
            glow: 'shadow-[0_0_20px_rgba(245,158,11,0.4)]',
            badge: 'bg-amber-500 text-black',
            icon: 'text-amber-400',
            text: 'text-amber-300'
        },
        icon: Icons.Army,
        actionLabel: 'track'
    },
    campaign: {
        id: 'campaign',
        type: 'campaign',
        label: 'mission_campaign',
        labelPlural: 'campaigns_active',
        color: {
            bg: 'bg-blue-950/90',
            border: 'border-blue-500/50',
            glow: 'shadow-[0_0_20px_rgba(59,130,246,0.4)]',
            badge: 'bg-blue-500 text-white',
            icon: 'text-blue-400',
            text: 'text-blue-300'
        },
        icon: Icons.Radar,
        actionLabel: 'monitor'
    },
    patrol: {
        id: 'patrol',
        type: 'patrol',
        label: 'mission_patrol',
        labelPlural: 'patrols_active',
        color: {
            bg: 'bg-emerald-950/90',
            border: 'border-emerald-500/50',
            glow: 'shadow-[0_0_20px_rgba(16,185,129,0.4)]',
            badge: 'bg-emerald-500 text-black',
            icon: 'text-emerald-400',
            text: 'text-emerald-300'
        },
        icon: Icons.Map,
        actionLabel: 'view'
    }
};

interface AlertCardProps {
    config: AlertConfig;
    count: number;
    timeRemaining: number;
    onClick: () => void;
}

const AlertCard: React.FC<AlertCardProps> = ({ config, count, timeRemaining, onClick }) => {
    const { t } = useLanguage();
    const IconComponent = config.icon;
    const isCritical = config.id === 'attack' && count > 0;
    const isUrgent = timeRemaining < 300000;
    
    const label = count > 1 
        ? `${count} ${t.common.ui[config.labelPlural as keyof typeof t.common.ui] || config.labelPlural}`
        : t.common.ui[config.label as keyof typeof t.common.ui] || config.label;

    return (
        <button 
            onClick={onClick}
            className={`
                ${config.color.bg} backdrop-blur-xl 
                border ${config.color.border} ${config.color.glow}
                rounded-lg overflow-hidden 
                transition-all duration-300 
                hover:scale-[1.02] active:scale-[0.98]
                ${isCritical ? 'animate-pulse' : ''}
                group
            `}
        >
            <div className="flex items-center gap-3 px-3 py-2">
                <div className={`
                    flex items-center justify-center 
                    w-8 h-8 rounded-lg 
                    ${config.color.badge}
                    ${isCritical ? 'animate-pulse' : 'group-hover:animate-bounce'}
                `}>
                    <IconComponent className="w-4 h-4" />
                </div>
                
                <div className="flex flex-col items-start min-w-0 flex-1">
                    <span className={`
                        text-xs uppercase tracking-wider font-bold 
                        ${config.color.text} 
                        truncate w-full
                    `}>
                        {label}
                    </span>
                    <span className="text-[10px] text-slate-400">
                        {t.common.ui[config.actionLabel as keyof typeof t.common.ui] || config.actionLabel}
                    </span>
                </div>
                
                <div className="flex flex-col items-end shrink-0">
                    <div className={`
                        font-mono text-sm font-bold 
                        ${isUrgent ? 'text-red-400 animate-pulse' : 'text-white'}
                    `}>
                        {formatDuration(Math.max(0, timeRemaining))}
                    </div>
                </div>
            </div>
            
            <div className={`
                h-0.5 w-full 
                bg-gradient-to-r from-transparent via-current to-transparent
                opacity-50
                ${config.color.text.replace('text-', 'via-')}
            `} />
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
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-slate-900 border border-white/10 rounded-xl shadow-2xl max-w-md w-full max-h-[80dvh] overflow-y-auto p-4 animate-[fadeIn_0.2s_ease-out]">
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
                return { icon: Icons.Army, iconColor: 'text-amber-400', label: t.common.ui.attack_outbound };
            case 'CAMPAIGN_ATTACK':
                return { icon: Icons.Radar, iconColor: 'text-blue-400', label: t.common.ui.mission_campaign };
            default:
                return { icon: Icons.Map, iconColor: 'text-emerald-400', label: t.common.ui.mission_patrol };
        }
    };

    const { icon: MissionIcon, iconColor, label } = getMissionInfo();

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-slate-800`}>
                        <MissionIcon className={`w-5 h-5 ${iconColor}`} />
                    </div>
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
            
            <div className="flex justify-end pt-2">
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

            <div className="fixed top-[72px] left-1/2 -translate-x-1/2 z-30 w-full max-w-md px-4">
                <div className="flex flex-col gap-2">
                    {alertData.incoming.items.length > 0 && (
                        <AlertCard 
                            config={alertData.incoming.config}
                            count={alertData.incoming.items.length}
                            timeRemaining={alertData.incoming.earliest!.endTime - Date.now()}
                            onClick={() => handleAttackClick(alertData.incoming.earliest)}
                        />
                    )}

                    {alertData.outbound.items.length > 0 && (
                        <AlertCard 
                            config={alertData.outbound.config}
                            count={alertData.outbound.items.length}
                            timeRemaining={alertData.outbound.earliest!.endTime - Date.now()}
                            onClick={() => handleMissionClick(alertData.outbound.earliest!.id)}
                        />
                    )}

                    {alertData.campaign.items.length > 0 && (
                        <AlertCard 
                            config={alertData.campaign.config}
                            count={alertData.campaign.items.length}
                            timeRemaining={alertData.campaign.earliest!.endTime - Date.now()}
                            onClick={() => handleMissionClick(alertData.campaign.earliest!.id)}
                        />
                    )}

                    {alertData.patrol.items.length > 0 && (
                        <AlertCard 
                            config={alertData.patrol.config}
                            count={alertData.patrol.items.length}
                            timeRemaining={alertData.patrol.earliest!.endTime - Date.now()}
                            onClick={() => handleMissionClick(alertData.patrol.earliest!.id)}
                        />
                    )}
                </div>
            </div>
        </>
    );
};
