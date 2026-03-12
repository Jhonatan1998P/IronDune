import { GameState, BotPersonality, LogEntry } from '../../types';
import { harvestLogisticLootField } from './logisticLoot';

export const processBotSalvageCheck = (state: GameState, now: number): { stateUpdates: Partial<GameState>, logs: LogEntry[] } => {
    const logs: LogEntry[] = [];
    const updatedLootFields = [...(state.logisticLootFields || [])];
    let fieldsChanged = false;

    // Solo chequear ocasionalmente
    if (Math.random() > 0.05) { 
        return { stateUpdates: {}, logs: [] };
    }

    const bots = state.rankingData.bots;
    
    updatedLootFields.forEach((field, index) => {
        if (field.totalValue <= 0) return;

        // NUEVO: Los bots solo pueden recolectar después de 9 minutos de la creación del campo
        // Esto da tiempo al jugador para llegar primero
        const ageMs = now - field.createdAt;
        const nineMinutesMs = 9 * 60 * 1000;
        if (ageMs < nineMinutesMs) return;

        // Probabilidad de que un bot se fije en este campo
        const botIndex = Math.floor(Math.random() * bots.length);
        const bot = bots[botIndex];
        
        // Bots con personalidad ROGUE o WARLORD son más propensos a recolectar
        let harvestChance = 0.1;
        if (bot.personality === BotPersonality.ROGUE) harvestChance = 0.3;
        if (bot.personality === BotPersonality.WARLORD) harvestChance = 0.2;
        
        if (Math.random() < harvestChance) {
            // El bot recolecta una parte aleatoria
            const dronesSimulated = Math.floor(Math.random() * 5) + 1;
            const cargoPerDrone = 500000; // SALVAGER_CARGO_CAPACITY
            
            const { harvested, remaining } = harvestLogisticLootField(field, dronesSimulated, cargoPerDrone);
            
            if (Object.values(harvested).some(v => (v || 0) > 0)) {
                remaining.harvestCount = (field.harvestCount || 0) + 1;
                updatedLootFields[index] = remaining;
                fieldsChanged = true;
                
                // Solo logueamos si el bot "roba" un campo que el jugador generó o está en su zona
                if (field.defenderId === state.gameId || field.attackerId === state.gameId) {
                    logs.push({
                        id: `bot-salvage-${now}-${field.id}`,
                        messageKey: 'log_bot_salvage',
                        type: 'intel',
                        timestamp: now,
                        params: { 
                            botName: bot.name, 
                            loot: harvested,
                            fieldName: field.origin === 'WAR' ? 'War Debris' : 'Combat Debris'
                        }
                    });
                }
            }
        }
    });

    if (fieldsChanged) {
        return {
            stateUpdates: {
                logisticLootFields: updatedLootFields
            },
            logs
        };
    }

    return { stateUpdates: {}, logs: [] };
};
