
import React, { useCallback } from 'react';
import { GameState, BuildingType, UnitType, TechType, MissionDuration, LogEntry, ResourceType, GiftCode } from '../types';
import { 
    executeBuild, 
    executeRecruit, 
    executeResearch, 
    executeStartMission, 
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

export const useGameActions = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  addLog: (messageKey: string, type?: LogEntry['type'], params?: any) => void
) => {

  const build = useCallback((type: BuildingType, amount: number = 1) => {
    setGameState(prev => {
        const result = executeBuild(prev, type, amount);
        if (result.success && result.newState) return result.newState;
        if (result.errorKey) addLog(result.errorKey, 'info');
        return prev;
    });
  }, [addLog, setGameState]);

  const repair = useCallback((type: BuildingType) => {
      setGameState(prev => {
          const result = executeRepair(prev, type);
          if (result.success && result.newState) return result.newState;
          if (result.errorKey) addLog(result.errorKey, 'info');
          return prev;
      });
  }, [addLog, setGameState]);

  const recruit = useCallback((type: UnitType, amount: number = 1) => {
    setGameState(prev => {
        const result = executeRecruit(prev, type, amount);
        if (result.success && result.newState) return result.newState;
        if (result.errorKey) addLog(result.errorKey, 'info');
        return prev;
    });
  }, [addLog, setGameState]);

  const research = useCallback((techId: TechType) => {
    setGameState(prev => {
        const result = executeResearch(prev, techId);
        if (result.success && result.newState) {
            return result.newState;
        }
        if (result.errorKey) addLog(result.errorKey, 'info');
        return prev;
    });
  }, [addLog, setGameState]);

  const handleBankTransaction = useCallback((amount: number, type: 'deposit' | 'withdraw') => {
      setGameState(prev => {
          const result = executeBankTransaction(prev, amount, type);
          if (result.success && result.newState) {
              return result.newState;
          }
          if (result.errorKey) addLog(result.errorKey, 'info');
          return prev;
      });
  }, [addLog, setGameState]);

  const speedUp = useCallback((targetId: string, type: 'BUILD' | 'RECRUIT' | 'RESEARCH' | 'MISSION') => {
      setGameState(prev => {
          const result = executeSpeedUp(prev, targetId, type);
          if (result.success && result.newState) return result.newState;
          if (result.errorKey) addLog(result.errorKey, 'info');
          return prev;
      });
  }, [addLog, setGameState]);

  const startMission = useCallback((units: Partial<Record<UnitType, number>>, duration: MissionDuration) => {
      setGameState(prev => {
          const result = executeStartMission(prev, units, duration);
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
      setGameState(prev => {
          const result = executeTradeAction(prev, offerId, amount);
          if (result.success && result.newState) {
              return result.newState;
          }
          if (result.errorKey) addLog(result.errorKey, 'info');
          return prev;
      });
  }, [addLog, setGameState]);

  const executeDiamondExchange = useCallback((targetResource: ResourceType, amount: number) => {
      setGameState(prev => {
          // Utilizar 'prev' asegura que calculamos contra el estado más reciente, evitando race conditions
          const result = executeDiamondAction(prev, targetResource, amount);

          if (result.success && result.newState) {
              let finalState = result.newState;
              
              // Inyectar el log manualmente aquí para mantener la actualización atómica
              if (result.log) {
                  finalState = {
                      ...finalState,
                      logs: [result.log, ...finalState.logs].slice(0, 100)
                  };
              }
              return finalState;
          } else if (result.errorKey) {
              // Si falla, necesitamos registrar el error sin romper el flujo de estado
              const errorLog: LogEntry = {
                  id: `err-${Date.now()}-${Math.random()}`,
                  messageKey: result.errorKey,
                  type: 'info',
                  timestamp: Date.now(),
                  params: {}
              };
              return {
                  ...prev,
                  logs: [errorLog, ...prev.logs].slice(0, 100)
              };
          }
          
          return prev;
      });
  }, [setGameState]);

  const acceptTutorialStep = useCallback(() => {
    setGameState(prev => ({ ...prev, tutorialAccepted: true }));
  }, [setGameState]);

  const claimTutorialReward = useCallback(() => {
      setGameState(prev => {
          if (!prev.currentTutorialId || !prev.tutorialClaimable) return prev;
          const step = TUTORIAL_STEPS.find(s => s.id === prev.currentTutorialId);
          if (!step) return prev;

          const newCompleted = [...prev.completedTutorials, step.id];
          const nextStep = TUTORIAL_STEPS.find(s => !newCompleted.includes(s.id));
          const newResources = { ...prev.resources };
          const newBuildings = { ...prev.buildings };
          const newUnits = { ...prev.units };
          
          // Apply Resource Rewards
          Object.entries(step.reward).forEach(([r, val]) => {
              const res = r as ResourceType;
              newResources[res] = Math.min(prev.maxResources[res], newResources[res] + (val as number));
          });

          // Apply Building Rewards (Levels/Quantity)
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

          // Apply Unit Rewards
          if (step.unitReward) {
              Object.entries(step.unitReward).forEach(([uId, amount]) => {
                  const uType = uId as UnitType;
                  newUnits[uType] = (newUnits[uType] || 0) + (amount as number);
              });
          }

          return {
              ...prev,
              completedTutorials: newCompleted,
              currentTutorialId: nextStep ? nextStep.id : null,
              tutorialClaimable: false,
              tutorialAccepted: false,
              resources: newResources,
              buildings: newBuildings,
              units: newUnits,
              isTutorialMinimized: false
          };
      });
  }, [setGameState]);

  const toggleTutorialMinimize = useCallback(() => {
    setGameState(prev => ({ ...prev, isTutorialMinimized: !prev.isTutorialMinimized }));
  }, [setGameState]);

  const spyOnAttacker = useCallback((attackId: string) => {
      setGameState(prev => {
          const result = executeEspionage(prev, attackId);
          if (result.success && result.newState) return result.newState;
          if (result.errorKey) addLog(result.errorKey, 'info');
          return prev;
      });
  }, [addLog, setGameState]);

  const changePlayerName = useCallback((newName: string): { success: boolean; errorKey?: string } => {
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
      const nameTaken = gameState.rankingData.bots.some(
          bot => bot.name.toLowerCase() === nameLower
      );
      
      if (nameTaken) {
          return { success: false, errorKey: 'name_already_taken' };
      }
      
      const isFreeChange = !gameState.hasChangedName;
      const cost = isFreeChange ? 0 : 20;
      
      if (!isFreeChange && gameState.resources[ResourceType.DIAMOND] < cost) {
          return { success: false, errorKey: 'not_enough_diamonds' };
      }
      
      setGameState(prev => ({
          ...prev,
          playerName: trimmedName,
          hasChangedName: true,
          resources: {
              ...prev.resources,
              [ResourceType.DIAMOND]: prev.resources[ResourceType.DIAMOND] - cost
          }
      }));
      
      addLog('name_changed', 'info', { newName: trimmedName, wasFree: isFreeChange });
      return { success: true };
  }, [gameState, addLog, setGameState]);

  const sendDiplomaticGift = useCallback((botId: string): { success: boolean; messageKey?: string; params?: Record<string, any> } => {
      const now = Date.now();
      const result = sendGift(gameState, botId, now);
      
      if (result.success && result.newReputation !== undefined) {
          setGameState(prev => {
              const newBots = prev.rankingData.bots.map(bot => 
                  bot.id === botId 
                      ? { ...bot, reputation: result.newReputation! }
                      : bot
              );
              
              const newDiplomaticActions = {
                  ...prev.diplomaticActions,
                  [botId]: {
                      ...(prev.diplomaticActions[botId] || {}),
                      lastGiftTime: now
                  }
              };
              
              const newLog: LogEntry = {
                  id: `dip-gift-${now}`,
                  messageKey: result.messageKey,
                  type: 'info',
                  timestamp: now,
                  params: result.params
              };
              
              const newResources = result.newResources 
                  ? { ...prev.resources, ...result.newResources }
                  : prev.resources;
              
              return {
                  ...prev,
                  rankingData: {
                      ...prev.rankingData,
                      bots: newBots
                  },
                  diplomaticActions: newDiplomaticActions,
                  resources: newResources,
                  logs: [newLog, ...prev.logs].slice(0, 100)
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
          setGameState(prev => {
              const newBots = prev.rankingData.bots.map(bot => 
                  bot.id === botId 
                      ? { ...bot, reputation: result.newReputation! }
                      : bot
              );
              
              const newDiplomaticActions = {
                  ...prev.diplomaticActions,
                  [botId]: {
                      ...(prev.diplomaticActions[botId] || {}),
                      lastAllianceTime: now
                  }
              };
              
              const newLog: LogEntry = {
                  id: `dip-alliance-${now}`,
                  messageKey: result.messageKey,
                  type: 'info',
                  timestamp: now,
                  params: result.params
              };
              
              return {
                  ...prev,
                  rankingData: {
                      ...prev.rankingData,
                      bots: newBots
                  },
                  diplomaticActions: newDiplomaticActions,
                  logs: [newLog, ...prev.logs].slice(0, 100)
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
          setGameState(prev => {
              const newBots = prev.rankingData.bots.map(bot => 
                  bot.id === botId 
                      ? { ...bot, reputation: result.newReputation! }
                      : bot
              );
              
              const newDiplomaticActions = {
                  ...prev.diplomaticActions,
                  [botId]: {
                      ...(prev.diplomaticActions[botId] || {}),
                      lastPeaceTime: now
                  }
              };
              
              const newLog: LogEntry = {
                  id: `dip-peace-${now}`,
                  messageKey: result.messageKey,
                  type: 'info',
                  timestamp: now,
                  params: result.params
              };
              
              return {
                  ...prev,
                  rankingData: {
                      ...prev.rankingData,
                      bots: newBots
                  },
                  diplomaticActions: newDiplomaticActions,
                  logs: [newLog, ...prev.logs].slice(0, 100)
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
      
      setGameState(prev => {
          const newResources = { ...prev.resources };
          
          Object.entries(giftCode.rewards).forEach(([resource, amount]) => {
              const resType = resource as ResourceType;
              const currentAmount = newResources[resType] || 0;
              const maxAmount = prev.maxResources[resType] || currentAmount;
              newResources[resType] = Math.min(maxAmount, currentAmount + (amount || 0));
          });
          
          let newRedeemedCodes = [...prev.redeemedGiftCodes];
          let newCooldowns = { ...prev.giftCodeCooldowns };
          
          if (giftCode.cooldownHours === 0) {
              newRedeemedCodes.push({ code: normalizedCode, redeemedAt: now });
          } else {
              newCooldowns[normalizedCode] = now;
          }
          
          const newLog: LogEntry = {
              id: `gift-${now}`,
              messageKey: 'gift_code_success',
              type: 'info',
              timestamp: now,
              params: { code: normalizedCode, rewards: giftCode.rewards }
          };
          
          return {
              ...prev,
              resources: newResources,
              redeemedGiftCodes: newRedeemedCodes,
              giftCodeCooldowns: newCooldowns,
              logs: [newLog, ...prev.logs].slice(0, 100)
          };
      });
      
      return { success: true, messageKey: 'gift_code_success' };
  }, [gameState, setGameState]);

  return {
    build, recruit, research, handleBankTransaction, speedUp, startMission, 
    executeCampaignBattle, executeTrade, executeDiamondExchange,
    acceptTutorialStep, claimTutorialReward, toggleTutorialMinimize, spyOnAttacker, repair,
    changePlayerName,
    sendDiplomaticGift, proposeDiplomaticAlliance, proposeDiplomaticPeace,
    redeemGiftCode
  };
};
