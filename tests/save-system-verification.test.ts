import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState, ResourceType, BuildingType, UnitType, TechType } from '../types';
import { INITIAL_GAME_STATE } from '../data/initialState';
import { sanitizeAndMigrateSave } from '../utils/engine/migration';
import { encodeSaveData, decodeSaveData } from '../utils/engine/security';

/**
 * TESTS DEL SISTEMA DE GUARDADO
 * 
 * Verifican que:
 * 1. TODO el gameState se guarda completamente
 * 2. El estado guardado puede recuperarse íntegramente
 * 3. Todos los campos críticos están presentes
 * 4. El encoding/decoding funciona correctamente
 * 5. La migración preserva todos los datos
 */

// ============================================
// CONSTANTES DE CAMPOS REQUERIDOS
// ============================================
const REQUIRED_FIELDS = [
    // Identificación
    'saveVersion', 'gameId', 'playerName', 'playerFlag', 'hasChangedName', 'peerId',
    
    // Recursos
    'resources', 'maxResources',
    
    // Edificios y unidades
    'buildings', 'units',
    
    // Tecnología
    'researchedTechs', 'techLevels', 'activeResearch',
    
    // Actividades en curso
    'activeConstructions', 'activeRecruitments', 'activeMissions',
    
    // Combate
    'incomingAttacks', 'attackQueue', 'activeWar', 'grudges', 'enemyAttackCounts',
    'targetAttackCounts', 'allyReinforcements',
    
    // Inteligencia
    'spyReports',
    
    // Ranking y diplomacia
    'rankingData', 'diplomaticActions', 'reputationHistory', 'interactionRecords',
    
    // Estadísticas
    'lifetimeStats',
    
    // Economía
    'bankBalance', 'currentInterestRate', 'nextRateChangeTime', 'lastInterestPayoutTime',
    'empirePoints', 'marketOffers', 'activeMarketEvent', 'marketNextRefreshTime',
    
    // Campaña y tutorial
    'campaignProgress', 'lastCampaignMissionFinishedTime',
    'completedTutorials', 'currentTutorialId', 'tutorialClaimable', 'tutorialAccepted',
    'isTutorialMinimized',
    
    // Tiempos del sistema
    'lastSaveTime', 'lastReputationDecayTime', 'lastEnemyAttackCheckTime',
    'lastEnemyAttackResetTime', 'lastAttackResetTime', 'nextAttackTime',
    'lastProcessedAttackTime',
    
    // Códigos de regalo
    'redeemedGiftCodes', 'giftCodeCooldowns',
    
    // Logs
    'logs'
];

describe('Sistema de Guardado - Verificación Completa', () => {
    
    // ============================================
    // HELPERS
    // ============================================
    
    const createCompleteGameState = (): GameState => {
        const state: GameState = {
            ...INITIAL_GAME_STATE,
            saveVersion: 6,
            gameId: 'test-game-123',
            playerName: 'TestCommander',
            playerFlag: 'US',
            hasChangedName: true,
            peerId: 'test-peer-id-456',
            
            // Recursos
            resources: {
                [ResourceType.MONEY]: 1500000,
                [ResourceType.OIL]: 75000,
                [ResourceType.AMMO]: 45000,
                [ResourceType.GOLD]: 25000,
                [ResourceType.DIAMOND]: 150
            },
            
            // Edificios
            buildings: {
                ...INITIAL_GAME_STATE.buildings,
                [BuildingType.HOUSE]: { level: 50, isDamaged: false },
                [BuildingType.FACTORY]: { level: 25, isDamaged: false },
                [BuildingType.OIL_RIG]: { level: 15, isDamaged: false },
                [BuildingType.GOLD_MINE]: { level: 10, isDamaged: false },
                [BuildingType.DIAMOND_MINE]: { level: 3, isDamaged: false },
                [BuildingType.BANK]: { level: 5, isDamaged: false },
            },
            
            // Unidades
            units: {
                ...INITIAL_GAME_STATE.units,
                [UnitType.HEAVY_COMMANDO]: 100,
                [UnitType.SCOUT_TANK]: 50,
                [UnitType.TITAN_MBT]: 25,
            },
            
            // Tecnologías
            researchedTechs: [
                TechType.RESOURCE_MANAGEMENT,
                TechType.EFFICIENT_WORKFLOWS,
                TechType.DEEP_DRILLING
            ],
            techLevels: {
                [TechType.EFFICIENT_WORKFLOWS]: 5,
                [TechType.DEEP_DRILLING]: 3
            },
            
            // Construcciones activas
            activeConstructions: [
                {
                    id: 'const-1',
                    buildingType: BuildingType.HOUSE,
                    count: 5,
                    endTime: Date.now() + 60000
                }
            ],
            
            // Reclutamientos activos
            activeRecruitments: [
                {
                    id: 'recruit-1',
                    unitType: UnitType.HEAVY_COMMANDO,
                    count: 10,
                    endTime: Date.now() + 120000
                }
            ],
            
            // Investigación activa
            activeResearch: {
                techId: TechType.MASS_PRODUCTION,
                endTime: Date.now() + 300000
            },
            
            // Misiones activas
            activeMissions: [
                {
                    id: 'mission-1',
                    type: 'PATROL',
                    startTime: Date.now() - 60000,
                    endTime: Date.now() + 240000,
                    duration: 5,
                    units: { [UnitType.HEAVY_COMMANDO]: 20 },
                    levelId: 3,
                    targetId: '',
                    targetName: '',
                    targetScore: 1000,
                    isWarAttack: false
                }
            ],
            
            // Ataques entrantes
            incomingAttacks: [
                {
                    id: 'attack-1',
                    attackerName: 'EnemyBot',
                    attackerScore: 1500,
                    units: { [UnitType.HEAVY_COMMANDO]: 10 },
                    startTime: Date.now() - 60000,
                    endTime: Date.now() + 840000,
                    delayCount: 0,
                    isWarWave: false,
                    isScouted: false
                }
            ],
            
            // Sistema de guerra
            activeWar: null,
            
            // Sistema de rencores
            grudges: [
                {
                    id: 'grudge-1',
                    botId: 'bot-5',
                    botName: 'VengefulBot',
                    botPersonality: 'WARLORD',
                    botScore: 2000,
                    createdAt: Date.now() - 300000,
                    retaliationTime: Date.now() + 600000,
                    notified: false
                }
            ],
            
            // Reportes de espionaje
            spyReports: [
                {
                    id: 'spy-1',
                    botId: 'bot-3',
                    botName: 'TargetBot',
                    botScore: 1800,
                    botPersonality: 'TYCOON',
                    createdAt: Date.now() - 600000,
                    expiresAt: Date.now() + 3000000,
                    units: { [UnitType.HEAVY_COMMANDO]: 50 },
                    resources: { [ResourceType.MONEY]: 100000 },
                    buildings: { [BuildingType.HOUSE]: 20 }
                }
            ],
            
            // Datos de ranking
            rankingData: {
                bots: INITIAL_GAME_STATE.rankingData.bots.slice(0, 10),
                lastUpdateTime: Date.now()
            },
            
            // Acciones diplomáticas
            diplomaticActions: {
                'bot-1': {
                    lastGiftTime: Date.now() - 7200000,
                    lastAllianceTime: 0,
                    lastPeaceTime: 0
                }
            },
            
            // Estadísticas de vida
            lifetimeStats: {
                enemiesKilled: 150,
                unitsLost: 75,
                resourcesMined: 5000000,
                missionsCompleted: 45,
                highestRankAchieved: 1500
            },
            
            // Sistema de ataques enemigos
            enemyAttackCounts: {
                'bot-5': {
                    count: 2,
                    lastAttackTime: Date.now() - 1800000
                }
            },
            lastEnemyAttackCheckTime: Date.now() - 1800000,
            lastEnemyAttackResetTime: Date.now() - 43200000,
            
            // Contadores de ataques
            targetAttackCounts: {},
            lastAttackResetTime: Date.now() - 3600000,
            
            // Mercado
            marketOffers: [],
            activeMarketEvent: null,
            marketNextRefreshTime: Date.now() + 1800000,
            
            // Tutorial
            completedTutorials: ['step-1', 'step-2', 'step-3'],
            currentTutorialId: 'step-4',
            tutorialClaimable: false,
            tutorialAccepted: true,
            isTutorialMinimized: false,
            
            // Banco
            bankBalance: 250000,
            currentInterestRate: 0.05,
            nextRateChangeTime: Date.now() + 43200000,
            lastInterestPayoutTime: Date.now() - 21600000,
            
            // Puntos de imperio
            empirePoints: 3500,
            
            // Progreso de campaña
            campaignProgress: 5,
            lastCampaignMissionFinishedTime: Date.now() - 900000,
            
            // Tiempos de reputación
            lastReputationDecayTime: Date.now() - 3600000,
            
            // Historial de reputación
            reputationHistory: {
                'bot-1': [
                    { change: 8, reason: 'gift', timestamp: Date.now() - 7200000 }
                ]
            },
            
            // Registros de interacción
            interactionRecords: {
                'bot-1': [
                    { type: 'gift', timestamp: Date.now() - 7200000 }
                ]
            },
            
            // Códigos de regalo
            redeemedGiftCodes: ['DIARIO-2024-01-15'],
            giftCodeCooldowns: {
                'DIARIO': Date.now() - 43200000,
                'MANCO': Date.now() - 86400000
            },
            
            // Logs
            logs: [
                {
                    id: 'log-1',
                    messageKey: 'log_building_complete',
                    params: { building: 'HOUSE', level: 50 },
                    timestamp: Date.now() - 60000,
                    type: 'build',
                    archived: false
                },
                {
                    id: 'log-2',
                    messageKey: 'log_mission_complete',
                    params: { mission: 'PATROL', success: true },
                    timestamp: Date.now() - 120000,
                    type: 'mission',
                    archived: false
                }
            ],
            
            // Refuerzos aliados
            allyReinforcements: [],
            
            // Cola de ataques
            attackQueue: [],
            lastProcessedAttackTime: 0,
            
            // Tiempo de próximo ataque
            nextAttackTime: Date.now() + 10800000,
            
            // Tiempo de guardado
            lastSaveTime: Date.now()
        };
        
        return state;
    };

    // ============================================
    // TESTS DE COMPLETITUD DEL ESTADO
    // ============================================

    describe('Completitud del GameState', () => {

        it('should have all required fields in complete GameState', () => {
            const completeState = createCompleteGameState();
            
            const missingFields = REQUIRED_FIELDS.filter(field => !(field in completeState));
            
            expect(missingFields).toEqual([]);
            expect(Object.keys(completeState).length).toBeGreaterThanOrEqual(REQUIRED_FIELDS.length);
        });

        it('should preserve all fields after JSON serialization', () => {
            const completeState = createCompleteGameState();
            
            const serialized = JSON.stringify(completeState);
            const deserialized: GameState = JSON.parse(serialized);
            
            const missingFields = REQUIRED_FIELDS.filter(field => !(field in deserialized));
            
            expect(missingFields).toEqual([]);
            
            // Verificar algunos campos críticos específicamente
            expect(deserialized.saveVersion).toBe(completeState.saveVersion);
            expect(deserialized.playerName).toBe(completeState.playerName);
            expect(deserialized.resources).toEqual(completeState.resources);
            expect(deserialized.buildings).toEqual(completeState.buildings);
            expect(deserialized.units).toEqual(completeState.units);
        });

        it('should preserve all fields after encode/decode cycle', () => {
            const completeState = createCompleteGameState();
            
            const encoded = encodeSaveData(completeState);
            expect(encoded).toBeTruthy();
            expect(encoded.length).toBeGreaterThan(1000); // Debería ser una cadena larga
            
            const decoded = decodeSaveData(encoded);
            expect(decoded).toBeTruthy();
            
            if (decoded) {
                const missingFields = REQUIRED_FIELDS.filter(field => !(field in decoded));
                expect(missingFields).toEqual([]);
                
                // Verificar campos críticos
                expect(decoded.saveVersion).toBe(completeState.saveVersion);
                expect(decoded.playerName).toBe(completeState.playerName);
                expect(decoded.resources).toEqual(completeState.resources);
            }
        });
    });

    // ============================================
    // TESTS DE MIGRACIÓN
    // ============================================
    
    describe('Migración del Estado Guardado', () => {
        
        it('should preserve all fields during migration', () => {
            const completeState = createCompleteGameState();
            
            const migrated = sanitizeAndMigrateSave(completeState);
            
            // playerFlag es un campo nuevo que podría no estar en migraciones
            const newFields = ['playerFlag'];
            const missingFields = REQUIRED_FIELDS
                .filter(field => !newFields.includes(field))
                .filter(field => !(field in migrated));
            
            expect(missingFields).toEqual([]);
            
            // Verificar que los datos críticos se preservan
            expect(migrated.playerName).toBe('TestCommander');
            expect(migrated.resources[ResourceType.MONEY]).toBe(1500000);
            expect(migrated.buildings[BuildingType.HOUSE].level).toBe(50);
            expect(migrated.units[UnitType.HEAVY_COMMANDO]).toBe(100);
            expect(migrated.researchedTechs.length).toBe(3);
            expect(migrated.activeMissions.length).toBe(1);
            expect(migrated.spyReports.length).toBe(1);
            expect(migrated.logs.length).toBe(2);
        });

        it('should handle migration from older save version', () => {
            const oldState: any = {
                ...createCompleteGameState(),
                saveVersion: 5,
                // Campos que podrían faltar en versiones antiguas
                reputationHistory: undefined,
                interactionRecords: undefined,
                playerFlag: undefined // playerFlag es nuevo
            };
            
            const migrated = sanitizeAndMigrateSave(oldState);
            
            // Debería actualizar la versión
            expect(migrated.saveVersion).toBe(6);
            
            // Debería tener la mayoría de campos requeridos (excepto los nuevos como playerFlag)
            const newFields = ['playerFlag'];
            const missingFields = REQUIRED_FIELDS
                .filter(field => !newFields.includes(field))
                .filter(field => !(field in migrated));
            
            expect(missingFields).toEqual([]);
        });

        it('should preserve timestamps during migration', () => {
            const completeState = createCompleteGameState();
            const originalLastSaveTime = completeState.lastSaveTime;
            
            const migrated = sanitizeAndMigrateSave(completeState);
            
            // El lastSaveTime debería preservarse (con pequeña tolerancia)
            expect(migrated.lastSaveTime).toBeCloseTo(originalLastSaveTime, 0);
            expect(migrated.lastReputationDecayTime).toBeGreaterThan(0);
            expect(migrated.lastEnemyAttackCheckTime).toBeGreaterThan(0);
        });
    });

    // ============================================
    // TESTS DE VALIDACIÓN DE CAMPOS CRÍTICOS
    // ============================================
    
    describe('Validación de Campos Críticos', () => {
        
        it('should have valid resources object with all resource types', () => {
            const completeState = createCompleteGameState();
            
            expect(completeState.resources).toBeDefined();
            expect(Object.keys(completeState.resources).length).toBe(5);
            expect(completeState.resources[ResourceType.MONEY]).toBeDefined();
            expect(completeState.resources[ResourceType.OIL]).toBeDefined();
            expect(completeState.resources[ResourceType.AMMO]).toBeDefined();
            expect(completeState.resources[ResourceType.GOLD]).toBeDefined();
            expect(completeState.resources[ResourceType.DIAMOND]).toBeDefined();
        });

        it('should have valid buildings object with all building types', () => {
            const completeState = createCompleteGameState();
            
            expect(completeState.buildings).toBeDefined();
            expect(Object.keys(completeState.buildings).length).toBeGreaterThan(10);
            
            // Verificar que cada edificio tiene la estructura correcta
            Object.values(completeState.buildings).forEach(building => {
                expect(building).toHaveProperty('level');
                expect(building).toHaveProperty('isDamaged');
                expect(typeof building.level).toBe('number');
                expect(typeof building.isDamaged).toBe('boolean');
            });
        });

        it('should have valid rankingData with bots array', () => {
            const completeState = createCompleteGameState();
            
            expect(completeState.rankingData).toBeDefined();
            expect(completeState.rankingData.bots).toBeDefined();
            expect(Array.isArray(completeState.rankingData.bots)).toBe(true);
            expect(completeState.rankingData.bots.length).toBeGreaterThan(0);
            expect(completeState.rankingData.lastUpdateTime).toBeGreaterThan(0);
        });

        it('should have valid logs array with proper structure', () => {
            const completeState = createCompleteGameState();
            
            expect(completeState.logs).toBeDefined();
            expect(Array.isArray(completeState.logs)).toBe(true);
            
            completeState.logs.forEach(log => {
                expect(log).toHaveProperty('id');
                expect(log).toHaveProperty('messageKey');
                expect(log).toHaveProperty('timestamp');
                expect(log).toHaveProperty('type');
                expect(log).toHaveProperty('archived');
            });
        });

        it('should have valid spyReports array with proper structure', () => {
            const completeState = createCompleteGameState();
            
            expect(completeState.spyReports).toBeDefined();
            expect(Array.isArray(completeState.spyReports)).toBe(true);
            
            if (completeState.spyReports.length > 0) {
                const report = completeState.spyReports[0];
                expect(report).toHaveProperty('id');
                expect(report).toHaveProperty('botId');
                expect(report).toHaveProperty('expiresAt');
                expect(report).toHaveProperty('units');
            }
        });
    });

    // ============================================
    // TESTS DE TAMAÑO Y RENDIMIENTO
    // ============================================
    
    describe('Tamaño y Rendimiento del Guardado', () => {
        
        it('should have reasonable save size', () => {
            const completeState = createCompleteGameState();
            
            const jsonSize = JSON.stringify(completeState).length;
            const encodedSize = encodeSaveData(completeState).length;
            
            // El tamaño debería ser razonable (< 100KB para JSON, < 150KB encoded)
            expect(jsonSize).toBeLessThan(100000);
            expect(encodedSize).toBeLessThan(150000);
            
            console.log(`[SaveSize] JSON: ${(jsonSize / 1024).toFixed(2)} KB, Encoded: ${(encodedSize / 1024).toFixed(2)} KB`);
        });

        it('should serialize and deserialize quickly', () => {
            const completeState = createCompleteGameState();
            
            const start = performance.now();
            
            for (let i = 0; i < 100; i++) {
                const serialized = JSON.stringify(completeState);
                JSON.parse(serialized);
            }
            
            const elapsed = performance.now() - start;
            const avgTime = elapsed / 100;
            
            console.log(`[SavePerformance] Average serialization time: ${avgTime.toFixed(2)}ms`);
            
            // Debería ser rápido (< 10ms promedio)
            expect(avgTime).toBeLessThan(10);
        });
    });

    // ============================================
    // TESTS DE INTEGRIDAD DE DATOS
    // ============================================
    
    describe('Integridad de Datos', () => {
        
        it('should detect corrupted save data', () => {
            const corruptedJson = JSON.stringify({
                saveVersion: 6,
                playerName: 'Test',
                // Faltan campos críticos
            });
            
            const parsed = JSON.parse(corruptedJson);
            const migrated = sanitizeAndMigrateSave(parsed);
            
            // Debería rellenar campos faltantes con valores por defecto
            expect(migrated.resources).toBeDefined();
            expect(migrated.buildings).toBeDefined();
            expect(migrated.units).toBeDefined();
        });

        it('should handle save with null/undefined fields gracefully', () => {
            const stateWithNulls: any = {
                ...createCompleteGameState(),
                peerId: null,
                activeWar: null,
                activeResearch: null,
                spyReports: undefined,
            };
            
            const migrated = sanitizeAndMigrateSave(stateWithNulls);
            
            // Debería manejar nulls/undefineds correctamente
            expect(migrated.peerId).toBe(null);
            expect(migrated.activeWar).toBe(null);
            expect(migrated.spyReports).toBeDefined(); // Debería tener array por defecto
        });
    });
});
