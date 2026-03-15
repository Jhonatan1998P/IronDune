import { PlanetSnapshot, Resources, ResourceType } from './types.js';

/**
 * Calcula el estado de recursos de un planeta en un momento específico T (now).
 * Es una función pura.
 */
export function calculatePlanetResourcesAt(
    snapshot: PlanetSnapshot,
    now: Date
): Resources {
    const elapsedMs = now.getTime() - snapshot.lastUpdateAt.getTime();
    if (elapsedMs <= 0) return { ...snapshot.resources };

    const elapsedSec = BigInt(Math.floor(elapsedMs / 1000));
    
    const currentResources: Resources = { ...snapshot.resources };

    // Aplicar producción
    for (const res of Object.values(ResourceType)) {
        const production = snapshot.productionRates[res] * elapsedSec;
        currentResources[res] += production;
    }

    return currentResources;
}

/**
 * Avanza la cola de construcción.
 * Devuelve los edificios que se han completado entre snapshot.lastUpdateAt y now.
 */
export function getCompletedBuildings(
    queue: { buildingId: string; targetLevel: number; finishedAt: Date }[],
    lastUpdateAt: Date,
    now: Date
) {
    return queue.filter(item => 
        item.finishedAt > lastUpdateAt && item.finishedAt <= now
    );
}
