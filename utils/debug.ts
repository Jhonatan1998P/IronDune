
import { GameState, IncomingAttack, LogEntry, UnitType } from '../types';
import { BotPersonality } from '../types/enums';
import { REPUTATION_ALLY_THRESHOLD } from '../constants';
import { generateBotArmy } from './engine/missions';

declare global {
    interface Window {
        debugTestAllyAttack?: () => void;
    }
}

export const createDebugAllyAttackTest = (
    setGameState: React.Dispatch<React.SetStateAction<GameState>>
): (() => void) => {
    return () => {
        const now = Date.now();
        const arrivalTime = now + 10000; // 10 seconds from now

        setGameState((prevState: GameState) => {
            let state = { ...prevState };

            // Step 1: Ensure there's an ally with high reputation
            // Find any bot and boost their reputation to ally level
            const bots = [...state.rankingData.bots];
            let allyBot = bots.find(b => (b.reputation ?? 50) >= REPUTATION_ALLY_THRESHOLD);
            
            if (!allyBot) {
                // Find a bot that's not an enemy and boost their reputation
                const enemyThreshold = 30;
                allyBot = bots.find(b => (b.reputation ?? 50) > enemyThreshold);
                
                if (allyBot) {
                    const botIndex = bots.findIndex(b => b.id === allyBot!.id);
                    if (botIndex !== -1) {
                        bots[botIndex] = {
                            ...bots[botIndex],
                            reputation: 80 // Set to ally threshold
                        };
                    }
                } else {
                    // Last resort: modify the first bot
                    bots[0] = {
                        ...bots[0],
                        reputation: 80
                    };
                }
            }

            // Step 2: Create a fake enemy attack with 100+ units
            const playerScore = state.empirePoints || 1000;
            const enemyScore = Math.max(playerScore * 0.8, 500); // Enemy at 80% of player score, min 500
            
            const enemyArmy = generateBotArmy(enemyScore, 0.15, BotPersonality.WARLORD);
            
            // Ensure we have at least 100 units
            let totalUnits = Object.values(enemyArmy).reduce((sum, count) => sum + (count || 0), 0);
            if (totalUnits < 100) {
                enemyArmy[UnitType.CYBER_MARINE] = (enemyArmy[UnitType.CYBER_MARINE] || 0) + (100 - totalUnits);
            }

            // Step 3: Create the incoming attack
            const attack: IncomingAttack = {
                id: `debug-attack-${now}`,
                attackerName: `Test Enemy Commander`,
                attackerScore: enemyScore,
                units: enemyArmy,
                startTime: now,
                endTime: arrivalTime,
                isWarWave: false,
                delayCount: 0,
                isScouted: false
            };

            // Step 4: Add log entry to indicate the debug attack
            const debugLog: LogEntry = {
                id: `debug-log-${now}`,
                messageKey: 'log_enemy_attack',
                type: 'combat',
                timestamp: now,
                params: {
                    attacker: attack.attackerName,
                    reputation: 25
                }
            };

            // Update state
            state = {
                ...state,
                rankingData: {
                    ...state.rankingData,
                    bots
                },
                incomingAttacks: [...state.incomingAttacks, attack],
                logs: [debugLog, ...(state.logs || [])].slice(0, 100)
            };

            console.log('[DEBUG] Test ally attack created!');
            console.log('[DEBUG] Attack arriving in 10 seconds...');
            console.log('[DEBUG] Enemy units:', enemyArmy);
            console.log('[DEBUG] Ally with high reputation:', bots.find(b => (b.reputation ?? 50) >= REPUTATION_ALLY_THRESHOLD)?.name);

            return state;
        });
    };
};
