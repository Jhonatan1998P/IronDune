/**
 * BATTLE SERVICE (Client-side)
 * Communicates with the remote Battle Server to process critical game logic
 */

import { GameState, QueuedAttackResult, LogEntry } from '../../types';
import { buildBackendUrl } from '../../lib/backend';
import { supabase } from '../../lib/supabase';

const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
        throw new Error('Missing auth token for battle endpoint');
    }

    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
};

const postBattle = async <T>(path: string, payload: unknown): Promise<T> => {
    const response = await fetch(buildBackendUrl(path), {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
};

export const battleService = {
    /**
     * Process the entire military queue (Incoming & Outgoing) on the server
     */
    async processQueue(state: GameState, now: number = Date.now()): Promise<{
        newState: GameState;
        queuedResults: QueuedAttackResult[];
        newLogs: LogEntry[];
    }> {
        try {
            return await postBattle('/api/battle/process-queue', { state, now });
        } catch (error) {
            console.error('[BattleService] Error processing queue:', error);
            // Fallback to local processing if server is down (optional, depending on security requirements)
            // For strict security, we might want to block here.
            throw error;
        }
    },

    /**
     * Process a war tick on the server
     */
    async processWarTick(state: GameState, now: number = Date.now()): Promise<{
        stateUpdates: Partial<GameState>;
        logs: LogEntry[];
    }> {
        try {
            return await postBattle('/api/battle/war-tick', { state, now });
        } catch (error) {
            console.error('[BattleService] Error processing war tick:', error);
            throw error;
        }
    },

    /**
     * Check for enemy attacks on the server
     */
    async processEnemyAttackCheck(state: GameState, now: number = Date.now()): Promise<{
        stateUpdates: Partial<GameState>;
        logs: LogEntry[];
    }> {
        try {
            return await postBattle('/api/battle/enemy-attack-check', { state, now });
        } catch (error) {
            console.error('[BattleService] Error checking enemy attacks:', error);
            throw error;
        }
    },

    /**
     * Process nemesis/grudges on the server
     */
    async processNemesisTick(state: GameState, now: number = Date.now()): Promise<{
        stateUpdates: Partial<GameState>;
        logs: LogEntry[];
    }> {
        try {
            return await postBattle('/api/battle/nemesis-tick', { state, now });
        } catch (error) {
            console.error('[BattleService] Error processing nemesis:', error);
            throw error;
        }
    },

    /**
     * Resolve a combat between two sets of units on the server
     */
    async simulateCombat(attackerUnits: any, defenderUnits: any, terrainModifier: number = 1.0): Promise<any> {
        try {
            return await postBattle('/api/battle/simulate-combat', { attackerUnits, defenderUnits, terrainModifier });
        } catch (error) {
            console.error('[BattleService] Combat simulation failed:', error);
            throw error;
        }
    }
};
