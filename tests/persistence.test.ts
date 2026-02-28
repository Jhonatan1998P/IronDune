import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { saveSpyReportsToStorage, loadSpyReportsFromStorage, addSpyReport, cleanupExpiredSpyReports, getInboxSpyReports, saveLogsToStorage, loadLogsFromStorage, addGameLog, getInboxLogs, getArchivedLogs } from '../utils';
import { SpyReport, LogEntry } from '../types';
import { ResourceType, BuildingType, UnitType } from '../types/enums';

const createMockSpyReport = (overrides: Partial<SpyReport> = {}): SpyReport => ({
    id: 'spy-1',
    botId: 'bot-1',
    botName: 'Test Bot',
    botScore: 5000,
    botPersonality: 'WARLORD' as any,
    createdAt: Date.now(),
    expiresAt: Date.now() + 600000,
    units: { [UnitType.CYBER_MARINE]: 50 },
    resources: { [ResourceType.MONEY]: 1000 },
    buildings: { [BuildingType.HOUSE]: 5 },
    ...overrides
});

const createMockLog = (overrides: Partial<LogEntry> = {}): LogEntry => ({
    id: 'log-1',
    messageKey: 'log_battle_win',
    timestamp: Date.now(),
    type: 'combat',
    params: { targetName: 'Enemy' },
    archived: false,
    ...overrides
});

describe('Spy Reports Persistence', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    describe('saveSpyReportsToStorage', () => {
        it('should save spy reports to localStorage', () => {
            const reports = [createMockSpyReport()];
            saveSpyReportsToStorage(reports);
            
            const saved = localStorage.getItem('ironDuneSpyReports');
            expect(saved).toBeTruthy();
            expect(JSON.parse(saved!)).toHaveLength(1);
        });

        it('should limit reports to 20', () => {
            const reports = Array(30).fill(null).map((_, i) => 
                createMockSpyReport({ id: `spy-${i}`, createdAt: Date.now() - i * 1000 })
            );
            saveSpyReportsToStorage(reports);
            
            const saved = localStorage.getItem('ironDuneSpyReports');
            const parsed = JSON.parse(saved!);
            expect(parsed).toHaveLength(20);
        });

        it('should sort reports by createdAt descending', () => {
            const reports = [
                createMockSpyReport({ id: 'old', createdAt: Date.now() - 10000 }),
                createMockSpyReport({ id: 'new', createdAt: Date.now() })
            ];
            saveSpyReportsToStorage(reports);
            
            const saved = localStorage.getItem('ironDuneSpyReports');
            const parsed = JSON.parse(saved!);
            expect(parsed[0].id).toBe('new');
        });
    });

    describe('loadSpyReportsFromStorage', () => {
        it('should return empty array if no data', () => {
            const result = loadSpyReportsFromStorage();
            expect(result).toEqual([]);
        });

        it('should filter expired reports', () => {
            const expiredReport = createMockSpyReport({ 
                id: 'expired', 
                expiresAt: Date.now() - 1000 
            });
            const validReport = createMockSpyReport({ 
                id: 'valid', 
                expiresAt: Date.now() + 600000 
            });
            
            localStorage.setItem('ironDuneSpyReports', JSON.stringify([expiredReport, validReport]));
            
            const result = loadSpyReportsFromStorage();
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('valid');
        });

        it('should handle corrupted JSON gracefully', () => {
            localStorage.setItem('ironDuneSpyReports', 'invalid json');
            const result = loadSpyReportsFromStorage();
            expect(result).toEqual([]);
        });
    });

    describe('addSpyReport', () => {
        it('should add new report and maintain limit', () => {
            const existingReports = Array(20).fill(null).map((_, i) => 
                createMockSpyReport({ id: `spy-${i}`, createdAt: Date.now() - i * 1000, expiresAt: Date.now() + 600000 })
            );
            
            const newReport = createMockSpyReport({ id: 'new-spy', createdAt: Date.now(), expiresAt: Date.now() + 600000 });
            const result = addSpyReport(existingReports, newReport);
            
            expect(result).toHaveLength(20);
            expect(result[0].id).toBe('new-spy');
        });

        it('should filter expired reports before adding', () => {
            const existingReports = [
                createMockSpyReport({ id: 'expired', expiresAt: Date.now() - 1000 })
            ];
            const newReport = createMockSpyReport({ id: 'new', expiresAt: Date.now() + 600000 });
            
            const result = addSpyReport(existingReports, newReport);
            
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('new');
        });
    });

    describe('cleanupExpiredSpyReports', () => {
        it('should remove expired reports', () => {
            const reports = [
                createMockSpyReport({ id: 'expired', expiresAt: Date.now() - 1000 }),
                createMockSpyReport({ id: 'valid', expiresAt: Date.now() + 600000 })
            ];
            
            const result = cleanupExpiredSpyReports(reports);
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('valid');
        });

        it('should save to storage if changes occurred', () => {
            const reports = [
                createMockSpyReport({ id: 'expired', expiresAt: Date.now() - 1000 })
            ];
            
            cleanupExpiredSpyReports(reports);
            
            const saved = localStorage.getItem('ironDuneSpyReports');
            expect(saved).toBe('[]');
        });
    });

    describe('getInboxSpyReports', () => {
        it('should return max 10 non-expired reports', () => {
            const reports = Array(15).fill(null).map((_, i) => 
                createMockSpyReport({ id: `spy-${i}`, expiresAt: Date.now() + 600000 })
            );
            
            const result = getInboxSpyReports(reports);
            expect(result).toHaveLength(10);
        });
    });
});

describe('Logs Persistence', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    describe('saveLogsToStorage', () => {
        it('should save logs to localStorage', () => {
            const logs = [createMockLog({ type: 'combat' })];
            saveLogsToStorage(logs);
            
            const saved = localStorage.getItem('ironDuneLogs');
            expect(saved).toBeTruthy();
        });

        it('should filter only report logs (combat, mission, intel, war)', () => {
            const logs = [
                createMockLog({ id: 'combat', type: 'combat' }),
                createMockLog({ id: 'mission', type: 'mission' }),
                createMockLog({ id: 'intel', type: 'intel' }),
                createMockLog({ id: 'war', type: 'war' }),
                createMockLog({ id: 'info', type: 'info' }),
                createMockLog({ id: 'build', type: 'build' })
            ];
            saveLogsToStorage(logs);
            
            const saved = localStorage.getItem('ironDuneLogs');
            const parsed = JSON.parse(saved!);
            expect(parsed).toHaveLength(4);
        });

        it('should limit logs to 20', () => {
            const logs = Array(30).fill(null).map((_, i) => 
                createMockLog({ id: `log-${i}`, type: 'combat', timestamp: Date.now() - i * 1000 })
            );
            saveLogsToStorage(logs);
            
            const saved = localStorage.getItem('ironDuneLogs');
            const parsed = JSON.parse(saved!);
            expect(parsed).toHaveLength(20);
        });

        it('should sort logs by timestamp descending', () => {
            const logs = [
                createMockLog({ id: 'old', type: 'combat', timestamp: Date.now() - 10000 }),
                createMockLog({ id: 'new', type: 'combat', timestamp: Date.now() })
            ];
            saveLogsToStorage(logs);
            
            const saved = localStorage.getItem('ironDuneLogs');
            const parsed = JSON.parse(saved!);
            expect(parsed[0].id).toBe('new');
        });
    });

    describe('loadLogsFromStorage', () => {
        it('should return empty array if no data', () => {
            const result = loadLogsFromStorage();
            expect(result).toEqual([]);
        });

        it('should handle corrupted JSON gracefully', () => {
            localStorage.setItem('ironDuneLogs', 'invalid json');
            const result = loadLogsFromStorage();
            expect(result).toEqual([]);
        });

        it('should limit to 20 if more exist', () => {
            const logs = Array(25).fill(null).map((_, i) => 
                createMockLog({ id: `log-${i}`, type: 'combat' })
            );
            localStorage.setItem('ironDuneLogs', JSON.stringify(logs));
            
            const result = loadLogsFromStorage();
            expect(result).toHaveLength(20);
        });
    });

    describe('addGameLog', () => {
        it('should add new combat log', () => {
            const newLog = createMockLog({ id: 'new-log', type: 'combat' });
            const result = addGameLog([], newLog);
            
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('new-log');
        });

        it('should not add non-report logs', () => {
            const newLog = createMockLog({ id: 'info-log', type: 'info' });
            const result = addGameLog([], newLog);
            
            expect(result).toHaveLength(0);
        });

        it('should maintain limit of 20', () => {
            const existingLogs = Array(20).fill(null).map((_, i) => 
                createMockLog({ id: `log-${i}`, type: 'combat', timestamp: Date.now() - i * 1000 })
            );
            const newLog = createMockLog({ id: 'new-log', type: 'combat', timestamp: Date.now() });
            
            const result = addGameLog(existingLogs, newLog);
            
            expect(result).toHaveLength(20);
            expect(result[0].id).toBe('new-log');
        });
    });

    describe('getInboxLogs', () => {
        it('should return max 10 non-archived report logs', () => {
            const logs = [
                createMockLog({ id: 'archived', type: 'combat', archived: true }),
                ...Array(12).fill(null).map((_, i) => 
                    createMockLog({ id: `log-${i}`, type: 'combat', archived: false })
                )
            ];
            
            const result = getInboxLogs(logs);
            expect(result).toHaveLength(10);
        });

        it('should filter only report types', () => {
            const logs = [
                createMockLog({ id: 'combat', type: 'combat' }),
                createMockLog({ id: 'info', type: 'info' })
            ];
            
            const result = getInboxLogs(logs);
            expect(result).toHaveLength(1);
        });
    });

    describe('getArchivedLogs', () => {
        it('should return only archived logs', () => {
            const logs = [
                createMockLog({ id: 'archived', type: 'combat', archived: true }),
                createMockLog({ id: 'not-archived', type: 'combat', archived: false })
            ];
            
            const result = getArchivedLogs(logs);
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('archived');
        });

        it('should limit to 20', () => {
            const logs = Array(25).fill(null).map((_, i) => 
                createMockLog({ id: `log-${i}`, type: 'combat', archived: true })
            );
            
            const result = getArchivedLogs(logs);
            expect(result).toHaveLength(20);
        });
    });
});

describe('Persistence Data Integrity', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should preserve spy reports after multiple save/load cycles', () => {
        const originalReports = [
            createMockSpyReport({ id: 'spy-1', createdAt: Date.now() - 1000, expiresAt: Date.now() + 600000 }),
            createMockSpyReport({ id: 'spy-2', createdAt: Date.now(), expiresAt: Date.now() + 600000 })
        ];
        
        saveSpyReportsToStorage(originalReports);
        const loaded1 = loadSpyReportsFromStorage();
        
        saveSpyReportsToStorage(loaded1);
        const loaded2 = loadSpyReportsFromStorage();
        
        expect(loaded2).toHaveLength(2);
        expect(loaded2.find(r => r.id === 'spy-2')).toBeTruthy();
        expect(loaded2.find(r => r.id === 'spy-1')).toBeTruthy();
    });

    it('should preserve logs after multiple save/load cycles', () => {
        const originalLogs = [
            createMockLog({ id: 'log-1', type: 'combat' }),
            createMockLog({ id: 'log-2', type: 'mission' })
        ];
        
        saveLogsToStorage(originalLogs);
        const loaded1 = loadLogsFromStorage();
        
        saveLogsToStorage(loaded1);
        const loaded2 = loadLogsFromStorage();
        
        expect(loaded2).toHaveLength(2);
    });

    it('should handle concurrent saves without data loss', () => {
        const reports1 = [createMockSpyReport({ id: 'spy-1' })];
        const reports2 = [createMockSpyReport({ id: 'spy-2' })];
        
        saveSpyReportsToStorage(reports1);
        saveSpyReportsToStorage(reports2);
        
        const saved = localStorage.getItem('ironDuneSpyReports');
        const parsed = JSON.parse(saved!);
        expect(parsed).toHaveLength(1);
        expect(parsed[0].id).toBe('spy-2');
    });
});

describe('Log Types Persistence - All Report Types', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    const REPORT_TYPES = ['combat', 'mission', 'intel', 'war'] as const;

    describe('saveLogsToStorage', () => {
        it('should save combat reports', () => {
            const logs = [createMockLog({ type: 'combat' })];
            saveLogsToStorage(logs);
            
            const saved = localStorage.getItem('ironDuneLogs');
            const parsed = JSON.parse(saved!);
            expect(parsed).toHaveLength(1);
            expect(parsed[0].type).toBe('combat');
        });

        it('should save mission reports', () => {
            const logs = [createMockLog({ type: 'mission' })];
            saveLogsToStorage(logs);
            
            const saved = localStorage.getItem('ironDuneLogs');
            const parsed = JSON.parse(saved!);
            expect(parsed).toHaveLength(1);
            expect(parsed[0].type).toBe('mission');
        });

        it('should save intel reports', () => {
            const logs = [createMockLog({ type: 'intel' })];
            saveLogsToStorage(logs);
            
            const saved = localStorage.getItem('ironDuneLogs');
            const parsed = JSON.parse(saved!);
            expect(parsed).toHaveLength(1);
            expect(parsed[0].type).toBe('intel');
        });

        it('should save war reports', () => {
            const logs = [createMockLog({ type: 'war' })];
            saveLogsToStorage(logs);
            
            const saved = localStorage.getItem('ironDuneLogs');
            const parsed = JSON.parse(saved!);
            expect(parsed).toHaveLength(1);
            expect(parsed[0].type).toBe('war');
        });

        it('should NOT save non-report logs (info, build, research, etc.)', () => {
            const logs = [
                createMockLog({ id: 'info', type: 'info' }),
                createMockLog({ id: 'build', type: 'build' }),
                createMockLog({ id: 'research', type: 'research' }),
                createMockLog({ id: 'finance', type: 'finance' }),
                createMockLog({ id: 'market', type: 'market' }),
                createMockLog({ id: 'tutorial', type: 'tutorial' }),
                createMockLog({ id: 'economy', type: 'economy' })
            ];
            saveLogsToStorage(logs);
            
            const saved = localStorage.getItem('ironDuneLogs');
            expect(saved).toBe('[]');
        });

        it('should save all report types together', () => {
            const logs = REPORT_TYPES.map(type => createMockLog({ type }));
            saveLogsToStorage(logs);
            
            const saved = localStorage.getItem('ironDuneLogs');
            const parsed = JSON.parse(saved!);
            expect(parsed).toHaveLength(4);
        });
    });

    describe('addGameLog', () => {
        it('should add combat log', () => {
            const newLog = createMockLog({ type: 'combat' });
            const result = addGameLog([], newLog);
            expect(result).toHaveLength(1);
        });

        it('should add mission log', () => {
            const newLog = createMockLog({ type: 'mission' });
            const result = addGameLog([], newLog);
            expect(result).toHaveLength(1);
        });

        it('should add intel log', () => {
            const newLog = createMockLog({ type: 'intel' });
            const result = addGameLog([], newLog);
            expect(result).toHaveLength(1);
        });

        it('should add war log', () => {
            const newLog = createMockLog({ type: 'war' });
            const result = addGameLog([], newLog);
            expect(result).toHaveLength(1);
        });

        it('should NOT add non-report logs', () => {
            const nonReportTypes = ['info', 'build', 'research', 'finance', 'market', 'tutorial', 'economy'];
            nonReportTypes.forEach(type => {
                const newLog = createMockLog({ type: type as any });
                const result = addGameLog([], newLog);
                expect(result).toHaveLength(0);
            });
        });
    });

    describe('getInboxLogs', () => {
        it('should return only report types', () => {
            const logs = [
                createMockLog({ type: 'combat' }),
                createMockLog({ type: 'mission' }),
                createMockLog({ type: 'intel' }),
                createMockLog({ type: 'war' }),
                createMockLog({ type: 'info' }),
                createMockLog({ type: 'build' })
            ];
            
            const result = getInboxLogs(logs);
            expect(result).toHaveLength(4);
            expect(result.every(l => ['combat', 'mission', 'intel', 'war'].includes(l.type))).toBe(true);
        });
    });

    describe('Data integrity after save/load cycle', () => {
        it('should preserve all report types after save/load', () => {
            const logs = REPORT_TYPES.map(type => createMockLog({ type }));
            
            saveLogsToStorage(logs);
            const loaded = loadLogsFromStorage();
            
            expect(loaded).toHaveLength(4);
            const types = loaded.map(l => l.type).sort();
            expect(types).toEqual(['combat', 'intel', 'mission', 'war']);
        });

        it('should preserve archived status for all report types', () => {
            const logs = REPORT_TYPES.map((type, i) => 
                createMockLog({ type, archived: i % 2 === 0 })
            );
            
            saveLogsToStorage(logs);
            const loaded = loadLogsFromStorage();
            
            expect(loaded.filter(l => l.archived).length).toBe(2);
            expect(loaded.filter(l => !l.archived).length).toBe(2);
        });

        it('should preserve params for all report types', () => {
            const logs = [
                createMockLog({ type: 'combat', params: { enemy: 'Bot1', unitsLost: 50 } }),
                createMockLog({ type: 'mission', params: { missionId: '123', success: true } }),
                createMockLog({ type: 'intel', params: { target: 'Bot2', resources: { MONEY: 1000 } } }),
                createMockLog({ type: 'war', params: { wave: 3, victory: false } })
            ];
            
            saveLogsToStorage(logs);
            const loaded = loadLogsFromStorage();
            
            const combatLog = loaded.find(l => l.type === 'combat');
            expect(combatLog?.params?.enemy).toBe('Bot1');
            
            const missionLog = loaded.find(l => l.type === 'mission');
            expect(missionLog?.params?.missionId).toBe('123');
            
            const intelLog = loaded.find(l => l.type === 'intel');
            expect(intelLog?.params?.target).toBe('Bot2');
            
            const warLog = loaded.find(l => l.type === 'war');
            expect(warLog?.params?.wave).toBe(3);
        });
    });
});
