
import { GameState } from '../types';

declare global {
    interface Window {
        debugTestAllyAttack?: () => void;
    }
}

/**
 * Debugging utilities for the frontend.
 * Redundant bot generation logic removed due to server migration.
 */
export const createDebugAllyAttackTest = (
    _setGameState: React.Dispatch<React.SetStateAction<GameState>>
): (() => void) => {
    return () => {
        console.warn('[DEBUG] Ally attack test disabled - server side logic required.');
    };
};
