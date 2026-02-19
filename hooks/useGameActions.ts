
import React, { useCallback } from 'react';
import { GameState, BuildingType, UnitType, TechType, MissionDuration, LogEntry, ResourceType } from '../types';
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

  return {
    build, recruit, research, handleBankTransaction, speedUp, startMission, 
    executeCampaignBattle, executeTrade, executeDiamondExchange,
    acceptTutorialStep, claimTutorialReward, toggleTutorialMinimize, spyOnAttacker, repair
  };
};
