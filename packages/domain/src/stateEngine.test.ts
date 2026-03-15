import { describe, it, expect } from 'vitest';
import { calculatePlanetResourcesAt } from './stateEngine.js';
import { ResourceType, PlanetSnapshot } from './types.js';

describe('stateEngine', () => {
    it('should calculate production correctly over 10 minutes', () => {
        const lastUpdateAt = new Date('2026-03-15T12:00:00Z');
        const now = new Date('2026-03-15T12:10:00Z'); // +600s
        
        const snapshot: PlanetSnapshot = {
            lastUpdateAt,
            resources: {
                [ResourceType.MONEY]: 1000n,
                [ResourceType.OIL]: 500n,
                [ResourceType.AMMO]: 200n,
                [ResourceType.GOLD]: 0n,
                [ResourceType.DIAMOND]: 0n,
            },
            productionRates: {
                [ResourceType.MONEY]: 10n, // 10/s = 6000 en 10min
                [ResourceType.OIL]: 5n,   // 5/s = 3000
                [ResourceType.AMMO]: 1n,   // 1/s = 600
                [ResourceType.GOLD]: 0n,
                [ResourceType.DIAMOND]: 0n,
            },
            version: 1
        };

        const result = calculatePlanetResourcesAt(snapshot, now);

        expect(result[ResourceType.MONEY]).toBe(7000n);
        expect(result[ResourceType.OIL]).toBe(3500n);
        expect(result[ResourceType.AMMO]).toBe(800n);
    });

    it('should return snapshot resources if no time passed', () => {
        const now = new Date('2026-03-15T12:00:00Z');
        const snapshot: PlanetSnapshot = {
            lastUpdateAt: now,
            resources: {
                [ResourceType.MONEY]: 1000n,
                [ResourceType.OIL]: 0n,
                [ResourceType.AMMO]: 0n,
                [ResourceType.GOLD]: 0n,
                [ResourceType.DIAMOND]: 0n,
            },
            productionRates: {
                [ResourceType.MONEY]: 10n,
                [ResourceType.OIL]: 0n,
                [ResourceType.AMMO]: 0n,
                [ResourceType.GOLD]: 0n,
                [ResourceType.DIAMOND]: 0n,
            },
            version: 1
        };

        const result = calculatePlanetResourcesAt(snapshot, now);
        expect(result[ResourceType.MONEY]).toBe(1000n);
    });
});
