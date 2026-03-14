// ============================================================
// BOT SALVAGE ENGINE - Shared Logic
// ============================================================

import { UnitType, BotPersonality } from './enums.js';
import { supabase } from '../db/lib/supabase.js';
import { SALVAGE_TRAVEL_TIME_MS } from './constants.js';

const GLOBAL_STATE_ID = '00000000-0000-0000-0000-000000000000';
const BOT_SALVAGE_DELAY_MS = 10 * 60 * 1000; // 10 Minutes rule

export const processBotSalvageCheck = async (state, now) => {
    // 1. Fetch Global Loot
    const { data: global } = await supabase.from('profiles').select('game_state').eq('id', GLOBAL_STATE_ID).single();
    const lootFields = global?.game_state?.logisticLootFields || [];
    
    if (lootFields.length === 0) return { stateUpdates: {}, logs: [] };

    // 2. Identify eligible fields (older than 10 mins)
    const eligibleFields = lootFields.filter(f => (now - f.createdAt) >= BOT_SALVAGE_DELAY_MS);
    if (eligibleFields.length === 0) return { stateUpdates: {}, logs: [] };

    const logs = [];
    const stateUpdates = {};
    
    // 3. Roll for bots to send salvage missions
    // This logic runs for the "environment" or when processing offline bots
    // For now, we'll simulate bots competing for these fields
    
    // logic: 5% chance per eligible field that a random bot sends a mission
    for (const field of eligibleFields) {
        if (Math.random() < 0.05) {
            const botIdx = Math.floor(Math.random() * (state.rankingData?.bots?.length || 1));
            const bot = state.rankingData?.bots?.[botIdx];
            if (!bot) continue;

            // Simulate a bot mission (processed as an incoming event or just direct harvest if offline)
            // To keep it simple and competitive: bots just "steal" some resources if not defended
            // but the user wants them to "send missions". 
            
            // We'll add an "Incoming Bot Salvage" if we want conflicts, 
            // or just resolve it now if the field is unattended.
            
            // To follow the user's "Order of arrival" and "Conflict" rule:
            // Bots must also have missions with endTimes.
            
            // But bots don't have a 'state' like players. 
            // We'll treat bot salvage as "Virtual Missions" that the server tracks.
        }
    }

    return { stateUpdates, logs };
};
