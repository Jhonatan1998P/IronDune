// src/lib/gameEngine.ts
import { ResourceType } from '../types';

export interface ClientPlanetState {
    resources: Record<ResourceType, number>;
    productionRates: Record<ResourceType, number>; // Por segundo
    lastUpdateAt: number; // Timestamp ms
}

/**
 * Calcula los recursos interpolados para mostrar en la UI.
 * Evita saltos bruscos y mantiene la fluidez visual.
 */
export function interpolateResources(
    state: ClientPlanetState,
    serverTimeOffset: number
): Record<ResourceType, number> {
    const now = Date.now() + serverTimeOffset;
    const elapsedSec = Math.max(0, (now - state.lastUpdateAt) / 1000);
    
    const interpolated: any = {};
    
    for (const res of Object.values(ResourceType)) {
        interpolated[res] = Math.floor(state.resources[res] + (state.productionRates[res] * elapsedSec));
    }
    
    return interpolated;
}
