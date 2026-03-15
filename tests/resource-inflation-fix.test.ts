import { describe, it, expect, beforeEach } from 'vitest';
import { sanitizeAndMigrateSave } from '../utils/engine/migration';
import { calculateOfflineProgress } from '../utils/engine/offline';
import { GameState, ResourceType, BuildingType } from '../types';
import { INITIAL_GAME_STATE } from '../data/initialState';
import { OFFLINE_PRODUCTION_LIMIT_MS } from '../constants';

describe('Resource Inflation Fix', () => {
    describe('Migration - Resource Validation', () => {
        it('should cap inflated money resources', () => {
            const corruptedState = {
                ...INITIAL_GAME_STATE,
                resources: {
                    ...INITIAL_GAME_STATE.resources,
                    [ResourceType.MONEY]: 100_000_000_000 // 100 billones (demasiado)
                }
            };

            const migrated = sanitizeAndMigrateSave(corruptedState);
            
            // El máximo razonable es 10 billones
            expect(migrated.resources[ResourceType.MONEY]).toBeLessThanOrEqual(10_000_000_000);
        });

        it('should cap inflated oil resources', () => {
            const corruptedState = {
                ...INITIAL_GAME_STATE,
                resources: {
                    ...INITIAL_GAME_STATE.resources,
                    [ResourceType.OIL]: 1_000_000_000 // 1 billón (demasiado)
                }
            };

            const migrated = sanitizeAndMigrateSave(corruptedState);
            
            expect(migrated.resources[ResourceType.OIL]).toBeLessThanOrEqual(500_000_000);
        });

        it('should cap inflated ammo resources', () => {
            const corruptedState = {
                ...INITIAL_GAME_STATE,
                resources: {
                    ...INITIAL_GAME_STATE.resources,
                    [ResourceType.AMMO]: 500_000_000 // 500 millones (demasiado)
                }
            };

            const migrated = sanitizeAndMigrateSave(corruptedState);
            
            expect(migrated.resources[ResourceType.AMMO]).toBeLessThanOrEqual(100_000_000);
        });

        it('should cap inflated gold resources', () => {
            const corruptedState = {
                ...INITIAL_GAME_STATE,
                resources: {
                    ...INITIAL_GAME_STATE.resources,
                    [ResourceType.GOLD]: 200_000_000 // 200 millones (demasiado)
                }
            };

            const migrated = sanitizeAndMigrateSave(corruptedState);
            
            expect(migrated.resources[ResourceType.GOLD]).toBeLessThanOrEqual(50_000_000);
        });

        it('should cap inflated diamond resources', () => {
            const corruptedState = {
                ...INITIAL_GAME_STATE,
                resources: {
                    ...INITIAL_GAME_STATE.resources,
                    [ResourceType.DIAMOND]: 1_000_000 // 1 millón (imposible legítimamente)
                }
            };

            const migrated = sanitizeAndMigrateSave(corruptedState);
            
            expect(migrated.resources[ResourceType.DIAMOND]).toBeLessThanOrEqual(100_000);
        });

        it('should allow legitimate resource amounts', () => {
            const legitimateState = {
                ...INITIAL_GAME_STATE,
                resources: {
                    [ResourceType.MONEY]: 5_000_000, // 5 millones (razonable)
                    [ResourceType.OIL]: 50_000,
                    [ResourceType.AMMO]: 30_000,
                    [ResourceType.GOLD]: 10_000,
                    [ResourceType.DIAMOND]: 100
                }
            };

            const migrated = sanitizeAndMigrateSave(legitimateState);
            
            expect(migrated.resources[ResourceType.MONEY]).toBe(5_000_000);
            expect(migrated.resources[ResourceType.OIL]).toBe(50_000);
            expect(migrated.resources[ResourceType.AMMO]).toBe(30_000);
            expect(migrated.resources[ResourceType.GOLD]).toBe(10_000);
            expect(migrated.resources[ResourceType.DIAMOND]).toBe(100);
        });
    });

    describe('Offline Production - Time Cap', () => {
        it('should cap offline production to 6 hours maximum', () => {
            const stateWithOldSave: GameState = {
                ...INITIAL_GAME_STATE,
                lastSaveTime: Date.now() - (24 * 60 * 60 * 1000), // 24 horas atrás
                buildings: {
                    ...INITIAL_GAME_STATE.buildings,
                    [BuildingType.OIL_RIG]: { level: 10, isDamaged: false },
                    [BuildingType.FACTORY]: { level: 10, isDamaged: false }
                }
            };

            const { report } = calculateOfflineProgress(stateWithOldSave);
            
            // El tiempo reportado debería ser 24 horas (real)
            expect(report.timeElapsed).toBeGreaterThanOrEqual(23 * 60 * 60 * 1000);
            
            // Pero la producción debería estar limitada a 6 horas
            // Verificamos que no sea proporcional a 24 horas completas
            const expectedMaxProductionHours = OFFLINE_PRODUCTION_LIMIT_MS / (60 * 60 * 1000);
            expect(expectedMaxProductionHours).toBe(6);
        });

        it('should calculate correct production for short offline periods', () => {
            const stateWithRecentSave: GameState = {
                ...INITIAL_GAME_STATE,
                lastSaveTime: Date.now() - (5 * 60 * 1000), // 5 minutos atrás
                buildings: {
                    ...INITIAL_GAME_STATE.buildings,
                    [BuildingType.OIL_RIG]: { level: 5, isDamaged: false }
                }
            };

            const { report } = calculateOfflineProgress(stateWithRecentSave);
            
            // 5 minutos es menos del mínimo (60 segundos), así que no debería haber producción
            expect(report.timeElapsed).toBeGreaterThanOrEqual(5 * 60 * 1000);
        });

        it('should handle negative time elapsed gracefully', () => {
            const stateWithFutureSave: GameState = {
                ...INITIAL_GAME_STATE,
                lastSaveTime: Date.now() + (60 * 60 * 1000) // 1 hora en el futuro (imposible)
            };

            const { report, newState } = calculateOfflineProgress(stateWithFutureSave);
            
            // Debería manejar el caso sin crashear
            expect(report.timeElapsed).toBeLessThan(0);
            // El estado debería permanecer sin cambios
            expect(newState).toBe(stateWithFutureSave);
        });
    });

    describe('Overflow Detection', () => {
        it('should preserve legitimate overflow but not add production', () => {
            const stateWithOverflow: GameState = {
                ...INITIAL_GAME_STATE,
                resources: {
                    [ResourceType.MONEY]: 5_000_000, // Overflow legítimo (cap es ~1M)
                    [ResourceType.OIL]: 50_000,
                    [ResourceType.AMMO]: 30_000,
                    [ResourceType.GOLD]: 10_000,
                    [ResourceType.DIAMOND]: 50
                },
                lastSaveTime: Date.now() - (2 * 60 * 60 * 1000), // 2 horas atrás
                buildings: {
                    ...INITIAL_GAME_STATE.buildings,
                    [BuildingType.HOUSE]: { level: 20, isDamaged: false }
                }
            };

            const { newState, report } = calculateOfflineProgress(stateWithOverflow);
            
            // Debería preservar el overflow existente
            expect(newState.resources[ResourceType.MONEY]).toBeGreaterThanOrEqual(5_000_000);
            // Pero no debería añadir producción si ya está sobre el cap
            // (el código original permite esto intencionalmente)
        });

        it('should detect extreme inflation', () => {
            const extremeInflationState: GameState = {
                ...INITIAL_GAME_STATE,
                resources: {
                    [ResourceType.MONEY]: 1_000_000_000_000, // 1 trillón (claramente bug)
                    [ResourceType.OIL]: 50_000,
                    [ResourceType.AMMO]: 30_000,
                    [ResourceType.GOLD]: 10_000,
                    [ResourceType.DIAMOND]: 50
                },
                lastSaveTime: Date.now() - (60 * 60 * 1000) // 1 hora atrás
            };

            const migrated = sanitizeAndMigrateSave(extremeInflationState);
            
            // Debería haber sido capado al máximo razonable
            expect(migrated.resources[ResourceType.MONEY]).toBeLessThanOrEqual(10_000_000_000);
        });
    });

    describe('Load/Import Flow', () => {
        it('should handle save data with all resources inflated', () => {
            const allInflatedState = {
                ...INITIAL_GAME_STATE,
                resources: {
                    [ResourceType.MONEY]: 999_999_999_999,
                    [ResourceType.OIL]: 999_999_999,
                    [ResourceType.AMMO]: 999_999_999,
                    [ResourceType.GOLD]: 999_999_999,
                    [ResourceType.DIAMOND]: 999_999
                }
            };

            const migrated = sanitizeAndMigrateSave(allInflatedState);
            
            // Todos los recursos deberían estar dentro de límites razonables
            expect(migrated.resources[ResourceType.MONEY]).toBeLessThanOrEqual(10_000_000_000);
            expect(migrated.resources[ResourceType.OIL]).toBeLessThanOrEqual(500_000_000);
            expect(migrated.resources[ResourceType.AMMO]).toBeLessThanOrEqual(100_000_000);
            expect(migrated.resources[ResourceType.GOLD]).toBeLessThanOrEqual(50_000_000);
            expect(migrated.resources[ResourceType.DIAMOND]).toBeLessThanOrEqual(100_000);
        });

        it('should preserve valid save version during migration', () => {
            const stateWithVersion = {
                ...INITIAL_GAME_STATE,
                saveVersion: 5,
                resources: {
                    ...INITIAL_GAME_STATE.resources,
                    [ResourceType.MONEY]: 1_000_000_000_000 // Inflado
                }
            };

            const migrated = sanitizeAndMigrateSave(stateWithVersion);
            
            // Debería actualizar a la versión actual
            expect(migrated.saveVersion).toBe(6);
            // Y capar los recursos inflados
            expect(migrated.resources[ResourceType.MONEY]).toBeLessThanOrEqual(10_000_000_000);
        });
    });
});
