
import React, { useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { ResourceType } from '../types';
import { ResourceDisplay, SmartTooltip, Icons } from './UIComponents';
import { formatNumber, formatDuration } from '../utils';
import { useLanguage } from '../context/LanguageContext';
import { NEWBIE_PROTECTION_THRESHOLD } from '../constants';
import { getIncomeStats } from '../utils/engine/selectors';

interface GameHeaderProps {
    onToggleStatus?: () => void;
}

export const GameHeader: React.FC<GameHeaderProps> = ({ onToggleStatus }) => {
  const { gameState } = useGame();
  const { t } = useLanguage();
  
  const isProtected = gameState.empirePoints < NEWBIE_PROTECTION_THRESHOLD;
  
  const now = Date.now();
  const isCoolingDown = gameState.nextAttackTime > now;
  const cooldownLeft = Math.max(0, gameState.nextAttackTime - now);

  const totalActiveTasks = gameState.activeConstructions.length + gameState.activeRecruitments.length + (gameState.activeResearch ? 1 : 0);
  const hasIncoming = gameState.incomingAttacks.length > 0;

  let statusColor = 'bg-emerald-500';
  if (isCoolingDown) statusColor = 'bg-blue-500';
  if (gameState.activeWar) statusColor = 'bg-red-600 animate-pulse'; 
  
  if (isProtected) statusColor = 'bg-cyan-500';

  const { production, upkeep } = useMemo(() => getIncomeStats(gameState), [
      gameState.buildings, 
      gameState.units, 
      gameState.researchedTechs, 
      gameState.techLevels, 
      gameState.bankBalance, 
      gameState.currentInterestRate
  ]);

  const tooltipContent = (
      <div className="w-64 space-y-3">
          <div className="border-b border-white/10 pb-2">
              <div className="font-bold uppercase tracking-wider text-cyan-400 mb-1 flex justify-between items-center">
                  <span>STATUS</span>
                  <span className="text-white text-lg">{gameState.activeWar ? t.common.war.status_war : (isProtected ? t.common.war.status_protected : (isCoolingDown ? t.common.war.status_cooldown : t.common.war.status_ready))}</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                  {gameState.activeWar ? t.common.war.active_against_empire : t.common.war.bot_attack_time}
              </p>
          </div>
          
          {isProtected ? (
              <div className="bg-cyan-900/20 p-2 rounded border border-cyan-500/30 text-[10px] text-cyan-300">
                  <span className="font-bold block uppercase mb-1">{t.common.war.status_newbie_protection}</span>
                  ({formatNumber(gameState.empirePoints)} / {NEWBIE_PROTECTION_THRESHOLD})
              </div>
          ) : isCoolingDown ? (
              <div className="bg-blue-900/20 p-2 rounded border border-blue-500/30 text-[10px] text-blue-300">
                  <span className="font-bold block uppercase mb-1">{t.common.war.status_peace_time}</span>
                  {t.common.war.status_time_remaining}: {formatDuration(cooldownLeft)}
              </div>
          ) : !gameState.activeWar ? (
              <div className="bg-green-900/20 p-2 rounded border border-green-500/30 text-[10px] text-green-300">
                  <span className="font-bold block uppercase">{t.common.war.status_attacks_enabled}</span>
              </div>
          ) : null}
      </div>
  );

  return (
    <header className="glass-panel z-30 shrink-0 border-b border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.4)] backdrop-blur-xl bg-slate-900/80">
      <div className="w-full px-3 py-2 md:px-6 md:py-3 flex items-center gap-3 md:gap-6">
        
        {/* LOGO */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.4)] relative group overflow-hidden">
            <span className="font-tech font-bold text-black text-lg relative z-10">ID</span>
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
          </div>
          <div className="hidden md:block">
            <h1 className="font-tech text-lg font-bold text-white tracking-[0.2em] leading-none mb-1">{t.common.ui.app_title}</h1>
            <div className="text-[9px] text-cyan-400 uppercase tracking-widest font-mono opacity-80">{t.common.ui.app_subtitle}</div>
          </div>
        </div>
        
        {/* RESOURCES BAR */}
        <div className="flex-1 min-w-0">
            <div className="flex lg:grid lg:grid-cols-7 items-center gap-2 lg:gap-3 overflow-x-auto lg:overflow-visible no-scrollbar mask-image-sides lg:mask-none py-1">
                
                {/* SCORE */}
                <SmartTooltip content={`${t.common.ui.total_score}: ${formatNumber(gameState.empirePoints)}`}>
                  <div className="flex flex-col justify-center bg-black/40 px-3 py-1.5 rounded border border-white/5 h-[44px] lg:h-[50px] cursor-help hover:border-amber-500/50 transition-colors lg:w-full min-w-[70px] shrink-0">
                     <div className="lg:flex lg:justify-between lg:items-center">
                        <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-0.5 lg:mb-0 hidden lg:block">{t.common.stats.empire_points.split(' ')[0]}</div>
                        <div className="text-[9px] text-amber-500/50 flex justify-center lg:block"><Icons.Crown /></div>
                     </div>
                     <div className="flex items-center justify-center lg:justify-start gap-1.5 text-amber-400">
                        <span className="font-mono font-bold text-sm leading-none">{formatNumber(gameState.empirePoints)}</span>
                     </div>
                  </div>
                </SmartTooltip>

                <ResourceDisplay 
                    label={t.common.resources.DIAMOND} 
                    value={gameState.resources[ResourceType.DIAMOND]} 
                    max={gameState.maxResources[ResourceType.DIAMOND]}
                    color="text-cyan-300"
                    production={production[ResourceType.DIAMOND] * 600} 
                    upkeep={0}
                    icon={<Icons.Resources.Diamond className="w-4 h-4 text-cyan-400" />}
                />

                <ResourceDisplay 
                    label={t.common.resources.MONEY} 
                    value={gameState.resources[ResourceType.MONEY]} 
                    max={gameState.maxResources[ResourceType.MONEY]}
                    color="text-emerald-400"
                    production={production[ResourceType.MONEY] * 600}
                    upkeep={upkeep[ResourceType.MONEY] * 600}
                    icon={<Icons.Resources.Money className="w-4 h-4 text-emerald-500" />}
                />

                <ResourceDisplay 
                    label={t.common.resources.AMMO} 
                    value={gameState.resources[ResourceType.AMMO]} 
                    max={gameState.maxResources[ResourceType.AMMO]}
                    color="text-orange-400"
                    production={production[ResourceType.AMMO] * 600}
                    upkeep={upkeep[ResourceType.AMMO] * 600}
                    icon={<Icons.Resources.Ammo className="w-4 h-4 text-orange-500" />}
                />

                <ResourceDisplay 
                    label={t.common.resources.OIL} 
                    value={gameState.resources[ResourceType.OIL]} 
                    max={gameState.maxResources[ResourceType.OIL]}
                    color="text-purple-400"
                    production={production[ResourceType.OIL] * 600}
                    upkeep={upkeep[ResourceType.OIL] * 600}
                    icon={<Icons.Resources.Oil className="w-4 h-4 text-purple-500" />}
                />

                <ResourceDisplay 
                    label={t.common.resources.GOLD} 
                    value={gameState.resources[ResourceType.GOLD]} 
                    max={gameState.maxResources[ResourceType.GOLD]}
                    color="text-yellow-400" 
                    production={production[ResourceType.GOLD] * 600}
                    upkeep={upkeep[ResourceType.GOLD] * 600}
                    icon={<Icons.Resources.Gold className="w-4 h-4 text-yellow-500" />}
                />

                {/* ATTACK STATUS */}
                <SmartTooltip content={tooltipContent}>
                    <div className="flex flex-col justify-center min-w-[70px] lg:w-full bg-black/40 px-3 py-1.5 rounded border border-white/5 h-[44px] lg:h-[50px] cursor-help hover:bg-white/5 transition-colors shrink-0">
                        <div className="flex justify-between items-center text-[9px] text-slate-500 uppercase tracking-widest mb-1 lg:mb-2">
                            <span className="hidden lg:inline">STATUS</span>
                            <span className="lg:hidden text-center w-full block"><Icons.Warning /></span>
                            {gameState.activeWar ? (
                                <span className="text-red-500 font-bold animate-pulse hidden lg:inline">{t.common.war.status_war}</span>
                            ) : isProtected ? (
                                <span className="text-cyan-400 font-bold hidden lg:inline">{t.common.war.status_safe}</span>
                            ) : isCoolingDown ? (
                                <span className="text-blue-400 font-bold hidden lg:inline">{t.common.war.status_wait}</span>
                            ) : (
                                <span className="text-green-400 font-bold hidden lg:inline">{t.common.war.status_ready}</span>
                            )}
                        </div>
                        <div className="h-1 bg-slate-900 rounded-full overflow-hidden border border-white/5 w-full">
                            <div className={`h-full ${statusColor} transition-all duration-1000 ease-out`} style={{ width: `${(isProtected || gameState.activeWar) ? 100 : (isCoolingDown ? Math.min(100, (cooldownLeft / (6 * 60 * 60 * 1000)) * 100) : 15)}%` }}></div>
                        </div>
                    </div>
                </SmartTooltip>

            </div>
        </div>

        {/* MOBILE: Right Panel Trigger */}
        <div className="xl:hidden shrink-0 pl-2 border-l border-white/10">
            <button 
                onClick={onToggleStatus}
                className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg relative transition-colors border border-white/5"
            >
                {hasIncoming ? (
                    <div className="text-red-500 animate-pulse">
                        <Icons.Warning />
                    </div>
                ) : (
                    <Icons.Radar />
                )}
                
                {/* Badge for active tasks */}
                {!hasIncoming && totalActiveTasks > 0 && (
                    <span className="absolute -top-1 -right-1 bg-cyan-500 text-black text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-lg">
                        {totalActiveTasks}
                    </span>
                )}
            </button>
        </div>

      </div>
    </header>
  );
};
