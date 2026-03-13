/**
 * BATTLE SERVICE (Client-side)
 * Communicates with the remote Battle Server to process critical game logic
 */

import { GameState, QueuedAttackResult, LogEntry } from '../../types';

const BATTLE_SERVER_URL = (import.meta as any).env?.VITE_SOCKET_SERVER_URL || 'http://localhost:10000';

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
            const response = await fetch(`${BATTLE_SERVER_URL}/api/battle/process-queue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state, now })
            });

            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            return await response.json();
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
            const response = await fetch(`${BATTLE_SERVER_URL}/api/battle/war-tick`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state, now })
            });

            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            return await response.json();
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
            const response = await fetch(`${BATTLE_SERVER_URL}/api/battle/enemy-attack-check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state, now })
            });

            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            return await response.json();
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
            const response = await fetch(`${BATTLE_SERVER_URL}/api/battle/nemesis-tick`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state, now })
            });

            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            return await response.json();
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
            const response = await fetch(`${BATTLE_SERVER_URL}/api/battle/simulate-combat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ attackerUnits, defenderUnits, terrainModifier })
            });

            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            console.error('[BattleService] Combat simulation failed:', error);
            throw error;
        }
    }
};
