
import React, { useCallback } from 'react';
import { GameState, BuildingType, UnitType, TechType, MissionDuration, LogEntry, ResourceType, GiftCode, ActiveMission } from '../types';
import { gameEventBus } from '../utils/eventBus';
import { GameEventType } from '../types/events';
import { 
    executeBuild, 
    executeRecruit, 
    executeResearch, 
    executeStartMission, 
    executeSalvageMission,
    executeCampaignAttack, 
    executeSpeedUp, 
    executeEspionage,
    executeTrade as executeTradeAction,
    executeDiamondExchange as executeDiamondAction,
    executeRepair
} from '../utils/engine/actions';
import { executeBankTransaction } from '../utils/engine/finance';
import { TUTORIAL_STEPS } from '../data/tutorial';
import { sendGift, proposeAlliance, proposePeace } from '../utils/engine/diplomacy';
import { useAuth } from './useAuth';
import { buildBackendUrl } from '../lib/backend';

const limitLogs = (logs: LogEntry[], maxTotal: number = 100): LogEntry[] => {
    const importantLogs = logs.filter(log => 
        log.type === 'combat' || log.type === 'mission' || log.type === 'intel' || log.type === 'war'
    );
    const otherLogs = logs.filter(log => 
        log.type !== 'combat' && log.type !== 'mission' && log.type !== 'intel' && log.type !== 'war'
    );
    
    const limitedOther = otherLogs.slice(0, maxTotal - importantLogs.length);
    return [...importantLogs, ...limitedOther]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, maxTotal);
};

const getResourceDiff = (before: Record<ResourceType, number>, after: Record<ResourceType, number>) => {
  const costs: Partial<Record<ResourceType, number>> = {};
  const gains: Partial<Record<ResourceType, number>> = {};

  (Object.values(ResourceType) as ResourceType[]).forEach((resource) => {
    const prev = before[resource] || 0;
    const next = after[resource] || 0;
    if (next < prev) {
      costs[resource] = prev - next;
    } else if (next > prev) {
      gains[resource] = next - prev;
    }
  });

  return { costs, gains };
};

const hasAmounts = (amounts: Partial<Record<ResourceType, number>>) => Object.values(amounts).some((value) => (value || 0) > 0);

type CommandType =
  | 'BUILD_START'
  | 'BUILD_REPAIR'
  | 'RECRUIT_START'
  | 'RESEARCH_START'
  | 'SPEEDUP'
  | 'TRADE_EXECUTE'
  | 'DIAMOND_EXCHANGE'
  | 'ESPIONAGE_START'
  | 'BANK_DEPOSIT'
  | 'BANK_WITHDRAW'
  | 'TUTORIAL_CLAIM_REWARD'
  | 'GIFT_CODE_REDEEM'
  | 'DIPLOMACY_GIFT'
  | 'DIPLOMACY_PROPOSE_ALLIANCE'
  | 'DIPLOMACY_PROPOSE_PEACE';

const SERVER_STATE_PATCH_KEYS: Array<keyof GameState> = [
  'buildings',
  'units',
  'activeConstructions',
  'activeRecruitments',
  'activeResearch',
  'techLevels',
  'researchedTechs',
  'marketOffers',
  'marketNextRefreshTime',
  'activeMarketEvent',
  'spyReports',
  'empirePoints',
  'logs',
  'rankingData',
  'diplomaticActions',
  'redeemedGiftCodes',
  'giftCodeCooldowns',
  'completedTutorials',
  'currentTutorialId',
  'tutorialClaimable',
  'tutorialAccepted',
  'isTutorialMinimized',
];

interface LocalActionResult {
  success: boolean;
  newState?: GameState;
  errorKey?: string;
}

const stripServerManagedFields = (state: GameState): Partial<GameState> => {
  const sanitized = { ...state } as Partial<GameState>;
  delete sanitized.resources;
  delete sanitized.maxResources;
  delete sanitized.bankBalance;
  delete sanitized.currentInterestRate;
  delete sanitized.nextRateChangeTime;
  delete sanitized.lastInterestPayoutTime;
  return sanitized;
};

const createCommandId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const randomHex = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  const a = randomHex();
  const b = randomHex();
  return `${a.slice(0, 8)}-${a.slice(0, 4)}-4${a.slice(5, 8)}-a${b.slice(1, 4)}-${a.slice(0, 4)}${b}`;
};

const buildStatePatch = (before: GameState, after: GameState) => {
  const patch: Partial<GameState> = {};
  const sanitizedBefore = stripServerManagedFields(before);
  const sanitizedAfter = stripServerManagedFields(after);

  SERVER_STATE_PATCH_KEYS.forEach((key) => {
    if (JSON.stringify(sanitizedBefore[key]) === JSON.stringify(sanitizedAfter[key])) return;
    patch[key] = sanitizedAfter[key] as any;
  });

  return patch;
};

export const useGameActions = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  addLog: (messageKey: string, type?: LogEntry['type'], params?: any) => void
) => {
  const { session } = useAuth();

  const dispatchCommand = useCallback(async (
    commandType: CommandType,
    expectedRevision: number,
    payload: Record<string, unknown>
  ) => {
    const token = session?.access_token;
    if (!token) {
      return { ok: false, errorCode: 'MISSING_AUTH', diagnostics: [] as string[] };
    }

    const response = await fetch(buildBackendUrl('/api/command'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        commandId: createCommandId(),
        type: commandType,
        payload,
        expectedRevision,
      }),
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        errorCode: body?.errorCode || 'COMMAND_FAILED',
        diagnostics: body?.diagnostics || [],
      };
    }

    return {
      ok: Boolean(body?.ok),
      newRevision: Number.isFinite(body?.newRevision) ? body.newRevision : undefined,
      diagnostics: body?.diagnostics || [],
    };
  }, [session?.access_token]);

  const applyActionWithServerValidation = useCallback((
    commandType: CommandType,
    preview: LocalActionResult,
    executor: (state: GameState) => LocalActionResult
  ) => {
    if (!preview.success || !preview.newState) {
      if (preview.errorKey) addLog(preview.errorKey, 'info');
      return;
    }

    const { costs, gains } = getResourceDiff(gameState.resources, preview.newState.resources);
    const statePatch = buildStatePatch(gameState, preview.newState);
    const expectedRevision = Number(gameState.revision || 0);

    const run = async () => {
      const commandResult = await dispatchCommand(commandType, expectedRevision, {
        costs: hasAmounts(costs) ? costs : {},
        gains: hasAmounts(gains) ? gains : {},
        statePatch,
      });

      if (!commandResult.ok) {
        if (commandResult.errorCode === 'INSUFFICIENT_FUNDS') {
          addLog('insufficient_funds', 'info');
          return;
        }
        if (commandResult.errorCode === 'REVISION_MISMATCH') {
          addLog('server_sync_error', 'info');
          return;
        }
        addLog('server_sync_error', 'info');
        return;
      }
      setGameState((prev) => {
        const result = executor(prev);
        if (result.success && result.newState) {
          return {
            ...result.newState,
            revision: commandResult.newRevision ?? prev.revision,
          };
        }
        return prev;
      });
    };

    run();
  }, [addLog, dispatchCommand, gameState, setGameState]);

  const build = useCallback((type: BuildingType, amount: number = 1) => {
    const preview = executeBuild(gameState, type, amount);
    applyActionWithServerValidation('BUILD_START', preview, (state: GameState) => executeBuild(state, type, amount));
  }, [applyActionWithServerValidation, gameState]);

  const repair = useCallback((type: BuildingType) => {
      const preview = executeRepair(gameState, type);
      applyActionWithServerValidation('BUILD_REPAIR', preview, (state: GameState) => executeRepair(state, type));
  }, [applyActionWithServerValidation, gameState]);

  const recruit = useCallback((type: UnitType, amount: number = 1) => {
    const preview = executeRecruit(gameState, type, amount);
    applyActionWithServerValidation('RECRUIT_START', preview, (state: GameState) => executeRecruit(state, type, amount));
  }, [applyActionWithServerValidation, gameState]);

  const research = useCallback((techId: TechType) => {
    const preview = executeResearch(gameState, techId);
    applyActionWithServerValidation('RESEARCH_START', preview, (state: GameState) => executeResearch(state, techId));
  }, [applyActionWithServerValidation, gameState]);

  const handleBankTransaction = useCallback((amount: number, type: 'deposit' | 'withdraw') => {
      const preview = executeBankTransaction(gameState, amount, type);
      if (!preview.success || !preview.newState) {
        if (preview.errorKey) addLog(preview.errorKey, 'info');
        return;
      }

      const { costs, gains } = getResourceDiff(gameState.resources, preview.newState.resources);
      const statePatch = buildStatePatch(gameState, preview.newState);
      const expectedRevision = Number(gameState.revision || 0);

      const run = async () => {
        const commandResult = await dispatchCommand(type === 'deposit' ? 'BANK_DEPOSIT' : 'BANK_WITHDRAW', expectedRevision, {
          costs: hasAmounts(costs) ? costs : {},
          gains: hasAmounts(gains) ? gains : {},
          statePatch,
        });

        if (!commandResult.ok) {
          if (commandResult.errorCode === 'INSUFFICIENT_FUNDS') {
            addLog('insufficient_funds', 'info');
            return;
          }
          addLog('server_sync_error', 'info');
          return;
        }

        setGameState((prev) => {
          const result = executeBankTransaction(prev, amount, type);
          if (!result.success || !result.newState) return prev;
          return {
            ...result.newState,
            revision: commandResult.newRevision ?? prev.revision,
          };
        });
      };

      run();
  }, [addLog, dispatchCommand, gameState, setGameState]);

  const speedUp = useCallback((targetId: string, type: 'BUILD' | 'RECRUIT' | 'RESEARCH' | 'MISSION') => {
      const preview = executeSpeedUp(gameState, targetId, type);
      applyActionWithServerValidation('SPEEDUP', preview, (state: GameState) => executeSpeedUp(state, targetId, type));
  }, [applyActionWithServerValidation, gameState]);

  const startMission = useCallback((units: Partial<Record<UnitType, number>>, duration: MissionDuration) => {
    setGameState(prev => {
        const result = executeStartMission(prev, units, duration);
        if (result.success && result.newState) return result.newState;
        if (result.errorKey) addLog(result.errorKey, 'info');
        return prev;
    });
  }, [addLog, setGameState]);

  const startSalvageMission = useCallback((lootId: string, drones: number) => {
    setGameState(prev => {
        const result = executeSalvageMission(prev, lootId, drones);
        if (result.success && result.newState) return result.newState;
        if (result.errorKey) addLog(result.errorKey, 'info');
        return prev;
    });
  }, [addLog, setGameState]);

  const executeCampaignBattle = useCallback((levelId: number, playerUnits: Partial<Record<UnitType, number>>) => {
      const result = executeCampaignAttack(gameState, levelId, playerUnits);
      
      if (result.success && result.newState) {
          setGameState(result.newState);
          return true;
      }
      if (result.errorKey) addLog(result.errorKey, 'info');
      return null;
  }, [gameState, addLog, setGameState]);

  const executeTrade = useCallback((offerId: string, amount: number) => {
      const preview = executeTradeAction(gameState, offerId, amount);
      applyActionWithServerValidation('TRADE_EXECUTE', preview, (state: GameState) => executeTradeAction(state, offerId, amount));
  }, [applyActionWithServerValidation, gameState]);

  const executeDiamondExchange = useCallback((targetResource: ResourceType, amount: number) => {
      const preview = executeDiamondAction(gameState, targetResource, amount);
      if (!preview.success || !preview.newState) {
        if (preview.errorKey) {
          const errorLog: LogEntry = {
            id: `err-${Date.now()}-${Math.random()}`,
            messageKey: preview.errorKey,
            type: 'info',
            timestamp: Date.now(),
            params: {},
          };
          setGameState((prev) => ({ ...prev, logs: limitLogs([errorLog, ...prev.logs], 100) }));
        }
        return;
      }

      applyActionWithServerValidation('DIAMOND_EXCHANGE', preview, (state: GameState) => {
        const result = executeDiamondAction(state, targetResource, amount);
        if (!result.success || !result.newState) return { success: false };
        if (result.log) {
          return {
            success: true,
            newState: {
              ...result.newState,
              logs: limitLogs([result.log, ...result.newState.logs], 100),
            },
          };
        }
        return result;
      });
  }, [applyActionWithServerValidation, gameState, setGameState]);

  const acceptTutorialStep = useCallback(() => {
    setGameState(prev => ({ ...prev, tutorialAccepted: true }));
  }, [setGameState]);

  const applyTutorialRewardLocal = useCallback((state: GameState): LocalActionResult => {
      if (!state.currentTutorialId || !state.tutorialClaimable) return { success: false };
      const step = TUTORIAL_STEPS.find(s => s.id === state.currentTutorialId);
      if (!step) return { success: false };

      const newCompleted = [...state.completedTutorials, step.id];
      const nextStep = TUTORIAL_STEPS.find(s => !newCompleted.includes(s.id));
      const newResources = { ...state.resources };
      const newBuildings = { ...state.buildings };
      const newUnits = { ...state.units };

      Object.entries(step.reward).forEach(([r, val]) => {
          const res = r as ResourceType;
          newResources[res] = Math.min(state.maxResources[res], newResources[res] + (val as number));
      });

      if (step.buildingReward) {
          Object.entries(step.buildingReward).forEach(([bId, amount]) => {
              const bType = bId as BuildingType;
              if (newBuildings[bType]) {
                  newBuildings[bType] = {
                      ...newBuildings[bType],
                      level: newBuildings[bType].level + (amount as number)
                  };
              }
          });
      }

      if (step.unitReward) {
          Object.entries(step.unitReward).forEach(([uId, amount]) => {
              const uType = uId as UnitType;
              newUnits[uType] = (newUnits[uType] || 0) + (amount as number);
          });
      }

      return {
          success: true,
          newState: {
              ...state,
              completedTutorials: newCompleted,
              currentTutorialId: nextStep ? nextStep.id : null,
              tutorialClaimable: false,
              tutorialAccepted: false,
              resources: newResources,
              buildings: newBuildings,
              units: newUnits,
              isTutorialMinimized: false
          }
      };
  }, []);

  const claimTutorialReward = useCallback(() => {
      const preview = applyTutorialRewardLocal(gameState);
      if (!preview.success || !preview.newState) return;
      applyActionWithServerValidation('TUTORIAL_CLAIM_REWARD', preview, (state: GameState) => applyTutorialRewardLocal(state));
  }, [applyActionWithServerValidation, applyTutorialRewardLocal, gameState]);

  const toggleTutorialMinimize = useCallback(() => {
    setGameState(prev => ({ ...prev, isTutorialMinimized: !prev.isTutorialMinimized }));
  }, [setGameState]);

  const spyOnAttacker = useCallback((attackId: string) => {
      const preview = executeEspionage(gameState, attackId);
      applyActionWithServerValidation('ESPIONAGE_START', preview, (state: GameState) => executeEspionage(state, attackId));
  }, [applyActionWithServerValidation, gameState]);

  const changePlayerName = useCallback((newName: string, flag?: string): { success: boolean; errorKey?: string } => {
      const trimmedName = newName.trim();
      
      if (trimmedName.length < 2) {
          return { success: false, errorKey: 'name_too_short' };
      }
      if (trimmedName.length > 20) {
          return { success: false, errorKey: 'name_too_long' };
      }
      if (!/^[a-zA-Z0-9_\s]+$/.test(trimmedName)) {
          return { success: false, errorKey: 'name_invalid_chars' };
      }
      
      const nameLower = trimmedName.toLowerCase();
      // Si el nombre no cambió, pero la bandera sí, permitimos el cambio (y no cobramos por el nombre si no cambió)
      const nameChanged = nameLower !== gameState.playerName.toLowerCase();

      if (nameChanged) {
        const nameTaken = gameState.rankingData.bots.some(
            bot => bot.name.toLowerCase() === nameLower
        );
        
        if (nameTaken) {
            return { success: false, errorKey: 'name_already_taken' };
        }
      }
      
      const isFreeChange = !gameState.hasChangedName;
      // Solo cobramos si el nombre cambió y no es el cambio gratis
      const cost = (nameChanged && !isFreeChange) ? 20 : 0;
      
      if (cost > 0 && gameState.resources[ResourceType.DIAMOND] < cost) {
          return { success: false, errorKey: 'not_enough_diamonds' };
      }
      
      setGameState(prev => ({
          ...prev,
          playerName: trimmedName,
          playerFlag: flag !== undefined ? flag : prev.playerFlag,
          hasChangedName: nameChanged ? true : prev.hasChangedName,
          resources: {
              ...prev.resources,
              [ResourceType.DIAMOND]: prev.resources[ResourceType.DIAMOND] - cost
          }
      }));
      
      if (nameChanged) {
        addLog('name_changed', 'info', { newName: trimmedName, wasFree: isFreeChange });
      }
      return { success: true };
  }, [gameState.playerName, gameState.hasChangedName, gameState.resources, gameState.rankingData.bots, addLog, setGameState]);

  const sendDiplomaticGift = useCallback((botId: string): { success: boolean; messageKey?: string; params?: Record<string, any> } => {
      const now = Date.now();
      const result = sendGift(gameState, botId, now);
      
      if (result.success && result.newReputation !== undefined) {
          const preview: LocalActionResult = {
            success: true,
            newState: {
              ...gameState,
              rankingData: {
                ...gameState.rankingData,
                bots: gameState.rankingData.bots.map(bot => bot.id === botId ? { ...bot, reputation: result.newReputation! } : bot)
              },
              diplomaticActions: {
                ...gameState.diplomaticActions,
                [botId]: {
                  ...(gameState.diplomaticActions[botId] || {}),
                  lastGiftTime: now,
                },
              },
              resources: result.newResources ? { ...gameState.resources, ...result.newResources } : gameState.resources,
              logs: limitLogs([
                {
                  id: `dip-gift-${now}`,
                  messageKey: result.messageKey,
                  type: 'info',
                  timestamp: now,
                  params: result.params,
                },
                ...gameState.logs,
              ], 100),
            },
          };

          applyActionWithServerValidation('DIPLOMACY_GIFT', preview, (state: GameState) => {
            const live = sendGift(state, botId, now);
            if (!live.success || live.newReputation === undefined) return { success: false };
            return {
              success: true,
              newState: {
                ...state,
                rankingData: {
                  ...state.rankingData,
                  bots: state.rankingData.bots.map(bot => bot.id === botId ? { ...bot, reputation: live.newReputation! } : bot),
                },
                diplomaticActions: {
                  ...state.diplomaticActions,
                  [botId]: {
                    ...(state.diplomaticActions[botId] || {}),
                    lastGiftTime: now,
                  },
                },
                resources: live.newResources ? { ...state.resources, ...live.newResources } : state.resources,
                logs: limitLogs([
                  {
                    id: `dip-gift-${now}`,
                    messageKey: live.messageKey,
                    type: 'info',
                    timestamp: now,
                    params: live.params,
                  },
                  ...state.logs,
                ], 100),
              },
            };
          });

          return { success: true, messageKey: result.messageKey, params: result.params };
      }
      
      addLog(result.messageKey, 'info', result.params);
      return { success: false, messageKey: result.messageKey, params: result.params };
  }, [gameState, addLog, setGameState]);

  const proposeDiplomaticAlliance = useCallback((botId: string): { success: boolean; messageKey?: string; params?: Record<string, any> } => {
      const now = Date.now();
      const result = proposeAlliance(gameState, botId, now);
      
      if (result.success && result.newReputation !== undefined) {
          const preview: LocalActionResult = {
            success: true,
            newState: {
              ...gameState,
              rankingData: {
                ...gameState.rankingData,
                bots: gameState.rankingData.bots.map(bot => bot.id === botId ? { ...bot, reputation: result.newReputation! } : bot),
              },
              diplomaticActions: {
                ...gameState.diplomaticActions,
                [botId]: {
                  ...(gameState.diplomaticActions[botId] || {}),
                  lastAllianceTime: now,
                },
              },
              logs: limitLogs([
                {
                  id: `dip-alliance-${now}`,
                  messageKey: result.messageKey,
                  type: 'info',
                  timestamp: now,
                  params: result.params,
                },
                ...gameState.logs,
              ], 100),
            },
          };

          applyActionWithServerValidation('DIPLOMACY_PROPOSE_ALLIANCE', preview, (state: GameState) => {
            const live = proposeAlliance(state, botId, now);
            if (!live.success || live.newReputation === undefined) return { success: false };
            return {
              success: true,
              newState: {
                ...state,
                rankingData: {
                  ...state.rankingData,
                  bots: state.rankingData.bots.map(bot => bot.id === botId ? { ...bot, reputation: live.newReputation! } : bot),
                },
                diplomaticActions: {
                  ...state.diplomaticActions,
                  [botId]: {
                    ...(state.diplomaticActions[botId] || {}),
                    lastAllianceTime: now,
                  },
                },
                logs: limitLogs([
                  {
                    id: `dip-alliance-${now}`,
                    messageKey: live.messageKey,
                    type: 'info',
                    timestamp: now,
                    params: live.params,
                  },
                  ...state.logs,
                ], 100),
              },
            };
          });

          return { success: true, messageKey: result.messageKey, params: result.params };
      }
      
      addLog(result.messageKey, 'info', result.params);
      return { success: false, messageKey: result.messageKey, params: result.params };
  }, [gameState, addLog, setGameState]);

  const proposeDiplomaticPeace = useCallback((botId: string): { success: boolean; messageKey?: string; params?: Record<string, any> } => {
      const now = Date.now();
      const result = proposePeace(gameState, botId, now);
      
      if (result.success && result.newReputation !== undefined) {
          const preview: LocalActionResult = {
            success: true,
            newState: {
              ...gameState,
              rankingData: {
                ...gameState.rankingData,
                bots: gameState.rankingData.bots.map(bot => bot.id === botId ? { ...bot, reputation: result.newReputation! } : bot),
              },
              diplomaticActions: {
                ...gameState.diplomaticActions,
                [botId]: {
                  ...(gameState.diplomaticActions[botId] || {}),
                  lastPeaceTime: now,
                },
              },
              logs: limitLogs([
                {
                  id: `dip-peace-${now}`,
                  messageKey: result.messageKey,
                  type: 'info',
                  timestamp: now,
                  params: result.params,
                },
                ...gameState.logs,
              ], 100),
            },
          };

          applyActionWithServerValidation('DIPLOMACY_PROPOSE_PEACE', preview, (state: GameState) => {
            const live = proposePeace(state, botId, now);
            if (!live.success || live.newReputation === undefined) return { success: false };
            return {
              success: true,
              newState: {
                ...state,
                rankingData: {
                  ...state.rankingData,
                  bots: state.rankingData.bots.map(bot => bot.id === botId ? { ...bot, reputation: live.newReputation! } : bot),
                },
                diplomaticActions: {
                  ...state.diplomaticActions,
                  [botId]: {
                    ...(state.diplomaticActions[botId] || {}),
                    lastPeaceTime: now,
                  },
                },
                logs: limitLogs([
                  {
                    id: `dip-peace-${now}`,
                    messageKey: live.messageKey,
                    type: 'info',
                    timestamp: now,
                    params: live.params,
                  },
                  ...state.logs,
                ], 100),
              },
            };
          });

          return { success: true, messageKey: result.messageKey, params: result.params };
      }
      
      addLog(result.messageKey, 'info', result.params);
      return { success: false, messageKey: result.messageKey, params: result.params };
  }, [gameState, addLog, setGameState]);

  const GIFT_CODES: GiftCode[] = [
      {
          code: 'DIARIO',
          rewards: { [ResourceType.DIAMOND]: 10 },
          cooldownHours: 24
      },
      {
          code: 'MANCO',
          rewards: { [ResourceType.MONEY]: 50000000, [ResourceType.DIAMOND]: 10 },
          cooldownHours: 0
      }
  ];

  const redeemGiftCode = useCallback((code: string): { success: boolean; messageKey?: string; params?: Record<string, any>; hoursRemaining?: number; minutesRemaining?: number } => {
      const normalizedCode = code.trim().toUpperCase();
      const now = Date.now();
      
      const giftCode = GIFT_CODES.find(gc => gc.code === normalizedCode);
      
      if (!giftCode) {
          return { success: false, messageKey: 'gift_code_invalid' };
      }
      
      if (giftCode.cooldownHours === 0) {
          const alreadyRedeemed = gameState.redeemedGiftCodes.some(
              rc => rc.code === normalizedCode
          );
          
          if (alreadyRedeemed) {
              return { success: false, messageKey: 'gift_code_already_redeemed' };
          }
      } else {
          const lastRedeemed = gameState.giftCodeCooldowns[normalizedCode];
          if (lastRedeemed) {
              const cooldownMs = giftCode.cooldownHours * 60 * 60 * 1000;
              const timeSinceLastRedeemed = now - lastRedeemed;
              
              if (timeSinceLastRedeemed < cooldownMs) {
                  const remainingMs = cooldownMs - timeSinceLastRedeemed;
                  const hoursRemaining = Math.floor(remainingMs / (60 * 60 * 1000));
                  const minutesRemaining = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
                  return { 
                      success: false, 
                      messageKey: 'gift_code_cooldown', 
                      params: { hours: hoursRemaining, minutes: minutesRemaining },
                      hoursRemaining,
                      minutesRemaining
                  };
              }
          }
      }
      
      const preview: LocalActionResult = {
        success: true,
        newState: (() => {
          const newResources = { ...gameState.resources };
          Object.entries(giftCode.rewards).forEach(([resource, amount]) => {
            const resType = resource as ResourceType;
            const currentAmount = newResources[resType] || 0;
            const maxAmount = gameState.maxResources[resType] || currentAmount;
            newResources[resType] = Math.min(maxAmount, currentAmount + (amount || 0));
          });

          const newRedeemedCodes = giftCode.cooldownHours === 0
            ? [...gameState.redeemedGiftCodes, { code: normalizedCode, redeemedAt: now }]
            : [...gameState.redeemedGiftCodes];

          const newCooldowns = giftCode.cooldownHours === 0
            ? { ...gameState.giftCodeCooldowns }
            : { ...gameState.giftCodeCooldowns, [normalizedCode]: now };

          return {
            ...gameState,
            resources: newResources,
            redeemedGiftCodes: newRedeemedCodes,
            giftCodeCooldowns: newCooldowns,
            logs: limitLogs([
              {
                id: `gift-${now}`,
                messageKey: 'gift_code_success',
                type: 'info',
                timestamp: now,
                params: { code: normalizedCode, rewards: giftCode.rewards },
              },
              ...gameState.logs,
            ], 100),
          };
        })(),
      };

      applyActionWithServerValidation('GIFT_CODE_REDEEM', preview, (state: GameState) => {
        const liveGiftCode = GIFT_CODES.find(gc => gc.code === normalizedCode);
        if (!liveGiftCode) return { success: false };

        if (liveGiftCode.cooldownHours === 0) {
          const alreadyRedeemed = state.redeemedGiftCodes.some(rc => rc.code === normalizedCode);
          if (alreadyRedeemed) return { success: false };
        } else {
          const lastRedeemed = state.giftCodeCooldowns[normalizedCode];
          if (lastRedeemed) {
            const cooldownMs = liveGiftCode.cooldownHours * 60 * 60 * 1000;
            if (now - lastRedeemed < cooldownMs) return { success: false };
          }
        }

        const newResources = { ...state.resources };
        Object.entries(liveGiftCode.rewards).forEach(([resource, amount]) => {
          const resType = resource as ResourceType;
          const currentAmount = newResources[resType] || 0;
          const maxAmount = state.maxResources[resType] || currentAmount;
          newResources[resType] = Math.min(maxAmount, currentAmount + (amount || 0));
        });

        const newRedeemedCodes = liveGiftCode.cooldownHours === 0
          ? [...state.redeemedGiftCodes, { code: normalizedCode, redeemedAt: now }]
          : [...state.redeemedGiftCodes];

        const newCooldowns = liveGiftCode.cooldownHours === 0
          ? { ...state.giftCodeCooldowns }
          : { ...state.giftCodeCooldowns, [normalizedCode]: now };

        return {
          success: true,
          newState: {
            ...state,
            resources: newResources,
            redeemedGiftCodes: newRedeemedCodes,
            giftCodeCooldowns: newCooldowns,
            logs: limitLogs([
              {
                id: `gift-${now}`,
                messageKey: 'gift_code_success',
                type: 'info',
                timestamp: now,
                params: { code: normalizedCode, rewards: liveGiftCode.rewards },
              },
              ...state.logs,
            ], 100),
          },
        };
      });
      
      return { success: true, messageKey: 'gift_code_success' };
  }, [GIFT_CODES, applyActionWithServerValidation, gameState]);

    const applyP2PBattleResult = useCallback((result: any, isAttacker: boolean) => {
        setGameState(prev => {
            const newState = { ...prev };

            if (isAttacker) {
                // ATACANTE: Las tropas enviadas YA fueron descontadas de la base al lanzar.
                // Al resolver solo debemos DEVOLVER los supervivientes a la base.
                const survivors = result.battleResult?.finalPlayerArmy as Partial<Record<UnitType, number>> | undefined;
                if (survivors) {
                    const newUnits = { ...newState.units };
                    for (const [unitType, count] of Object.entries(survivors)) {
                        const unitCount = count as number;
                        if (unitCount > 0) {
                            newUnits[unitType as UnitType] = (newUnits[unitType as UnitType] || 0) + unitCount;
                        }
                    }
                    newState.units = newUnits;
                }
            } else {
                // DEFENSOR: Sus tropas nunca salieron de la base, descontar las bajas recibidas.
                const casualties = result.defenderCasualties as Partial<Record<UnitType, number>> | undefined;
                if (casualties) {
                    const newUnits = { ...newState.units };
                    for (const [unitType, count] of Object.entries(casualties)) {
                        const unitCount = count as number;
                        if (newUnits[unitType as UnitType] !== undefined) {
                            newUnits[unitType as UnitType] = Math.max(0, newUnits[unitType as UnitType] - unitCount);
                        }
                    }
                    newState.units = newUnits;
                }
            }

            // --- Loot/edificios: SOLO si el atacante GANA (winner === 'PLAYER') ---
            if (result.winner === 'PLAYER' && isAttacker && result.loot) {
                const newResources = { ...newState.resources };
                for (const [resType, count] of Object.entries(result.loot)) {
                    newResources[resType as ResourceType] = (newResources[resType as ResourceType] || 0) + (count as number);
                }
                newState.resources = newResources;
            } else if (result.winner === 'PLAYER' && !isAttacker && result.loot) {
                // Defensor pierde recursos
                const newResources = { ...newState.resources };
                for (const [resType, count] of Object.entries(result.loot)) {
                    newResources[resType as ResourceType] = Math.max(0, (newResources[resType as ResourceType] || 0) - (count as number));
                }
                newState.resources = newResources;
            }

            // --- Regla 3: Edificios perdidos por el defensor (tasas escalonadas) ---
            if (result.winner === 'PLAYER' && !isAttacker && result.stolenBuildings) {
                const newBuildings = { ...newState.buildings };
                for (const [bType, count] of Object.entries(result.stolenBuildings)) {
                    const bt = bType as BuildingType;
                    const currentLevel = newBuildings[bt]?.level || 0;
                    if (bt !== BuildingType.DIAMOND_MINE && currentLevel > 0) {
                        newBuildings[bt] = {
                            ...newBuildings[bt],
                            level: Math.max(0, currentLevel - (count as number))
                        };
                    }
                }
                newState.buildings = newBuildings;

            } else if (result.winner === 'PLAYER' && isAttacker && result.stolenBuildings) {
                // Atacante: recibe edificios (calculados por el defensor o estimados)
                const newBuildings = { ...newState.buildings };
                for (const [bType, count] of Object.entries(result.stolenBuildings)) {
                    const bt = bType as BuildingType;
                    if (bt !== BuildingType.DIAMOND_MINE) {
                        const currentLevel = newBuildings[bt]?.level || 0;
                        newBuildings[bt] = { ...(newBuildings[bt] || {}), level: currentLevel + (count as number) };
                    }
                }
                newState.buildings = newBuildings;
            }

            // --- Defensor: remover de incomingAttacks ---
            if (!isAttacker) {
                newState.incomingAttacks = newState.incomingAttacks.filter(a => a.id !== result.attackId);
            }

            // --- Atacante: remover la ActiveMission P2P correspondiente ---
            if (isAttacker) {
                newState.activeMissions = (newState.activeMissions || []).filter(m => m.id !== result.attackId);
            }

            // Update lifetime stats
            if (result.battleResult) {
                const playerCasualtyCount = Object.values(result.battleResult.totalPlayerCasualties || {}).reduce((a: number, b: any) => a + (b || 0), 0) as number;
                const enemyCasualtyCount = Object.values(result.battleResult.totalEnemyCasualties || {}).reduce((a: number, b: any) => a + (b || 0), 0) as number;
                
                newState.lifetimeStats = {
                    ...newState.lifetimeStats,
                    unitsLost: (newState.lifetimeStats.unitsLost || 0) + playerCasualtyCount,
                    enemiesKilled: (newState.lifetimeStats.enemiesKilled || 0) + enemyCasualtyCount,
                    battlesWon: (newState.lifetimeStats.battlesWon || 0) + (result.winner === 'PLAYER' ? 1 : 0),
                    battlesLost: (newState.lifetimeStats.battlesLost || 0) + (result.winner !== 'PLAYER' ? 1 : 0),
                };
            }

            return newState;
        });

        // Trigger immediate save for critical battle result
        gameEventBus.emit(GameEventType.TRIGGER_SAVE, { force: true });

        // Emitir log via eventBus para que useGameEngine.addLog dispare setHasNewReports(true)
        const messageKey = isAttacker
            ? (result.winner === 'PLAYER' ? 'combat_p2p_victory' : 'combat_p2p_defeat')
            : (result.winner === 'PLAYER' ? 'combat_p2p_defenseFail' : 'combat_p2p_defenseSuccess');

        gameEventBus.emit(GameEventType.ADD_LOG, {
            messageKey,
            type: 'combat',
            params: {
                combatResult: result.battleResult,
                attackerId: result.attackerId,
                defenderId: result.defenderId,
                loot: result.loot,
                buildingLoot: result.stolenBuildings,
                winner: result.winner,
                attacker: result.attackerName || result.attackerId,
                defender: result.defenderName || result.defenderId,
            }
        });
    }, [setGameState]);

    const addP2PIncomingAttack = useCallback((attack: any) => {
        setGameState(prev => {
            // Check if it already exists
            if (prev.incomingAttacks.some(a => a.id === attack.id)) return prev;
            return {
                ...prev,
                incomingAttacks: [...prev.incomingAttacks, attack].sort((a, b) => a.endTime - b.endTime)
            };
        });
    }, [setGameState]);

    /**
     * Registra una misión P2P saliente en activeMissions y descuenta las tropas
     * enviadas del inventario local — todo en un solo setGameState atómico.
     */
    const addP2PMission = useCallback((mission: ActiveMission) => {
        setGameState(prev => {
            // Idempotente: si ya existe no hacer nada
            if ((prev.activeMissions || []).some(m => m.id === mission.id)) return prev;

            // Descontar tropas enviadas
            const newUnits = { ...prev.units };
            for (const [uType, count] of Object.entries(mission.units)) {
                const current = newUnits[uType as UnitType] ?? 0;
                newUnits[uType as UnitType] = Math.max(0, current - (count as number));
            }

            return {
                ...prev,
                units: newUnits,
                activeMissions: [...(prev.activeMissions || []), mission]
            };
        });
    }, [setGameState]);

  // Recibe recursos enviados por otro jugador P2P; los acredita respetando el cap de almacenamiento
  const receiveP2PResource = useCallback((resource: ResourceType, amount: number) => {
    if (amount <= 0) return;
    setGameState(prev => ({
      ...prev,
      resources: {
        ...prev.resources,
        [resource]: Math.min(prev.maxResources[resource], (prev.resources[resource] || 0) + amount),
      },
    }));
  }, [setGameState]);

  // Descuenta recursos del jugador al enviarlos P2P; no puede bajar de 0
  const deductLocalResource = useCallback((resource: ResourceType, amount: number) => {
    if (amount <= 0) return;
    setGameState(prev => ({
      ...prev,
      resources: {
        ...prev.resources,
        [resource]: Math.max(0, (prev.resources[resource] || 0) - amount),
      },
    }));
  }, [setGameState]);

  return {
    addP2PIncomingAttack,
    addP2PMission,
    applyP2PBattleResult,
    receiveP2PResource,
    deductLocalResource,
    build, recruit, research, handleBankTransaction, speedUp, startMission, startSalvageMission,
    executeCampaignBattle, executeTrade, executeDiamondExchange,
    acceptTutorialStep, claimTutorialReward, toggleTutorialMinimize, spyOnAttacker, repair,
    changePlayerName,
    sendDiplomaticGift, proposeDiplomaticAlliance, proposeDiplomaticPeace,
    redeemGiftCode
  };
};
