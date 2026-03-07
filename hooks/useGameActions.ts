
import React, { useCallback } from 'react';
import { GameState, BuildingType, UnitType, TechType, MissionDuration, LogEntry, ResourceType, GiftCode, ActiveMission } from '../types';
import { gameEventBus } from '../utils/eventBus';
import { GameEventType } from '../types/events';
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
import { P2P_PLUNDER_RATES, PLUNDERABLE_BUILDINGS } from '../constants';

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
                      logs: limitLogs([result.log, ...finalState.logs], 100)
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
                  logs: limitLogs([errorLog, ...prev.logs], 100)
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
                  logs: limitLogs([newLog, ...prev.logs], 100)
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
                  logs: limitLogs([newLog, ...prev.logs], 100)
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
                  logs: limitLogs([newLog, ...prev.logs], 100)
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
              logs: limitLogs([newLog, ...prev.logs], 100)
          };
      });
      
      return { success: true, messageKey: 'gift_code_success' };
  }, [gameState, setGameState]);

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
            if (result.winner === 'PLAYER' && !isAttacker) {
                // Calcular cuántos edificios pierde el defensor basado en sus edificios REALES
                // y el número del ataque (attackNumber enviado por el atacante)
                const attackNumber: number = typeof result.attackNumber === 'number' && result.attackNumber >= 1
                    ? result.attackNumber
                    : 1;
                const plunderRateIndex = Math.min(attackNumber - 1, P2P_PLUNDER_RATES.length - 1);
                const plunderRate = P2P_PLUNDER_RATES[plunderRateIndex];

                const newBuildings = { ...newState.buildings };
                for (const bType of PLUNDERABLE_BUILDINGS) {
                    const currentLevel = newBuildings[bType]?.level || 0;
                    if (currentLevel > 0) {
                        const toLose = Math.max(1, Math.floor(currentLevel * plunderRate));
                        newBuildings[bType] = {
                            ...newBuildings[bType],
                            level: Math.max(0, currentLevel - toLose)
                        };
                    }
                }
                newState.buildings = newBuildings;

            } else if (result.winner === 'PLAYER' && isAttacker && result.stolenBuildings) {
                // Atacante: recibe edificios (calculados por el defensor o estimados)
                const newBuildings = { ...newState.buildings };
                for (const [bType, count] of Object.entries(result.stolenBuildings)) {
                    const bt = bType as BuildingType;
                    newBuildings[bt] = { ...newBuildings[bt], level: newBuildings[bt].level + (count as number) };
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

            return newState;
        });

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
    build, recruit, research, handleBankTransaction, speedUp, startMission, 
    executeCampaignBattle, executeTrade, executeDiamondExchange,
    acceptTutorialStep, claimTutorialReward, toggleTutorialMinimize, spyOnAttacker, repair,
    changePlayerName,
    sendDiplomaticGift, proposeDiplomaticAlliance, proposeDiplomaticPeace,
    redeemGiftCode
  };
};
