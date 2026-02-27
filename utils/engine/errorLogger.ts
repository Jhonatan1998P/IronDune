/**
 * Error Logger Module
 * 
 * Captures detailed error information during migration and saves to err.log
 * All error messages and logs are in English for universal debugging
 */

// ============================================
// ERROR LOG CONSTANTS
// ============================================
const ERROR_LOG_FILENAME = 'err.log';
const MAX_ERROR_LOG_SIZE = 10; // Maximum number of errors to keep in log

// ============================================
// ERROR LOG ENTRY INTERFACE
// ============================================
export interface ErrorLogEntry {
    timestamp: string;
    isoTimestamp: string;
    errorType: string;
    errorMessage: string;
    stackTrace: string;
    location: {
        file: string;
        function: string;
        line?: number;
        column?: number;
    };
    context: {
        saveVersion?: number;
        migrationStage: string;
        fieldName?: string;
        expectedType?: string;
        actualType?: string;
        actualValue?: string;
    };
    systemInfo: {
        userAgent: string;
        language: string;
        platform: string;
        screenResolution: string;
        memory?: string;
    };
    applicationState: {
        url: string;
        localStorageSize: number;
        hasSave: boolean;
        saveSize: number;
    };
    rawData: {
        savedDataPreview: string;
        corruptedFields: string[];
        validationErrors: string[];
    };
    recoveryAction: string;
    suggestions: string[];
}

// ============================================
// ERROR LOGGER CLASS
// ============================================
export class ErrorLogger {
    private static instance: ErrorLogger;
    private errorLog: ErrorLogEntry[] = [];
    private readonly STORAGE_KEY = 'ironDuneErrorLog';

    private constructor() {
        this.loadFromStorage();
    }

    public static getInstance(): ErrorLogger {
        if (!ErrorLogger.instance) {
            ErrorLogger.instance = new ErrorLogger();
        }
        return ErrorLogger.instance;
    }

    // ============================================
    // LOAD/SAVE ERROR LOG FROM STORAGE
    // ============================================
    private loadFromStorage(): void {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                this.errorLog = JSON.parse(stored);
            }
        } catch (e) {
            console.error('[ErrorLogger] Failed to load error log from storage:', e);
        }
    }

    private saveToStorage(): void {
        try {
            // Keep only the most recent errors
            if (this.errorLog.length > MAX_ERROR_LOG_SIZE) {
                this.errorLog = this.errorLog.slice(-MAX_ERROR_LOG_SIZE);
            }
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.errorLog));
        } catch (e) {
            console.error('[ErrorLogger] Failed to save error log to storage:', e);
        }
    }

    // ============================================
    // LOG ERROR - MAIN METHOD
    // ============================================
    public logError(params: {
        error: Error | unknown;
        location: { file: string; function: string; line?: number; column?: number };
        context: {
            saveVersion?: number;
            migrationStage: string;
            fieldName?: string;
            expectedType?: string;
            actualType?: string;
            actualValue?: any;
        };
        savedData?: any;
        recoveryAction: string;
        suggestions?: string[];
    }): void {
        const error = params.error instanceof Error ? params.error : new Error(String(params.error));
        
        const entry: ErrorLogEntry = {
            timestamp: new Date().toLocaleString('en-US'),
            isoTimestamp: new Date().toISOString(),
            errorType: error.name || 'UnknownError',
            errorMessage: error.message || 'Unknown error occurred',
            stackTrace: error.stack || 'No stack trace available',
            location: params.location,
            context: {
                saveVersion: params.context.saveVersion,
                migrationStage: params.context.migrationStage,
                fieldName: params.context.fieldName,
                expectedType: params.context.expectedType,
                actualType: params.context.actualType,
                actualValue: this.sanitizeValue(params.context.actualValue)
            },
            systemInfo: this.captureSystemInfo(),
            applicationState: this.captureApplicationState(params.savedData),
            rawData: this.captureRawData(params.savedData),
            recoveryAction: params.recoveryAction,
            suggestions: params.suggestions || []
        };

        this.errorLog.push(entry);
        this.saveToStorage();

        // Also log to console for immediate visibility
        this.logToConsole(entry);

        // Trigger download of error log file
        this.downloadErrorLogFile(entry);
    }

    // ============================================
    // CAPTURE SYSTEM INFORMATION
    // ============================================
    private captureSystemInfo(): ErrorLogEntry['systemInfo'] {
        return {
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            screenResolution: `${screen.width}x${screen.height}`,
            memory: (navigator as any).deviceMemory ? `${(navigator as any).deviceMemory}GB` : 'Unknown'
        };
    }

    // ============================================
    // CAPTURE APPLICATION STATE
    // ============================================
    private captureApplicationState(savedData: any): ErrorLogEntry['applicationState'] {
        let saveSize = 0;
        let hasSave = false;

        try {
            const saved = localStorage.getItem('ironDuneSave');
            if (saved) {
                hasSave = true;
                saveSize = saved.length;
            }
        } catch (e) {
            // Ignore errors in capturing state
        }

        try {
            if (savedData) {
                saveSize = JSON.stringify(savedData).length;
                hasSave = true;
            }
        } catch (e) {
            // Ignore
        }

        return {
            url: window.location.href,
            localStorageSize: this.getLocalStorageSize(),
            hasSave,
            saveSize
        };
    }

    // ============================================
    // CAPTURE RAW DATA
    // ============================================
    private captureRawData(savedData: any): ErrorLogEntry['rawData'] {
        const corruptedFields: string[] = [];
        const validationErrors: string[] = [];

        // Analyze saved data for potential issues
        if (savedData && typeof savedData === 'object') {
            // Check for NaN values
            this.checkForNaN(savedData, '', corruptedFields, validationErrors);
            
            // Check for Infinity values
            this.checkForInfinity(savedData, '', corruptedFields, validationErrors);
            
            // Check for type mismatches
            this.checkTypeMismatches(savedData, corruptedFields, validationErrors);
        }

        return {
            savedDataPreview: this.createDataPreview(savedData),
            corruptedFields,
            validationErrors
        };
    }

    // ============================================
    // CHECK FOR NaN VALUES
    // ============================================
    private checkForNaN(obj: any, path: string, corruptedFields: string[], validationErrors: string[]): void {
        if (typeof obj === 'number' && isNaN(obj)) {
            corruptedFields.push(path || 'root');
            validationErrors.push(`NaN value found at: ${path || 'root'}`);
            return;
        }

        if (typeof obj === 'object' && obj !== null) {
            Object.entries(obj).forEach(([key, value]) => {
                this.checkForNaN(value, path ? `${path}.${key}` : key, corruptedFields, validationErrors);
            });
        }
    }

    // ============================================
    // CHECK FOR Infinity VALUES
    // ============================================
    private checkForInfinity(obj: any, path: string, corruptedFields: string[], validationErrors: string[]): void {
        if (typeof obj === 'number' && (obj === Infinity || obj === -Infinity)) {
            corruptedFields.push(path || 'root');
            validationErrors.push(`Infinity value found at: ${path || 'root'} (value: ${obj})`);
            return;
        }

        if (typeof obj === 'object' && obj !== null) {
            Object.entries(obj).forEach(([key, value]) => {
                this.checkForInfinity(value, path ? `${path}.${key}` : key, corruptedFields, validationErrors);
            });
        }
    }

    // ============================================
    // CHECK TYPE MISMATCHES
    // ============================================
    private checkTypeMismatches(savedData: any, corruptedFields: string[], validationErrors: string[]): void {
        const expectedTypes: Record<string, string> = {
            'saveVersion': 'number',
            'playerName': 'string',
            'resources': 'object',
            'buildings': 'object',
            'units': 'object',
            'logs': 'array',
            'activeMissions': 'array',
            'incomingAttacks': 'array',
            'grudges': 'array',
            'spyReports': 'array'
        };

        Object.entries(expectedTypes).forEach(([field, expectedType]) => {
            const value = savedData[field];
            if (value !== undefined) {
                const actualType = Array.isArray(value) ? 'array' : typeof value;
                if (actualType !== expectedType) {
                    corruptedFields.push(field);
                    validationErrors.push(`Type mismatch at "${field}": expected ${expectedType}, got ${actualType}`);
                }
            }
        });
    }

    // ============================================
    // SANITIZE VALUE FOR LOGGING
    // ============================================
    private sanitizeValue(value: any): string {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (typeof value === 'number') {
            if (isNaN(value)) return 'NaN';
            if (value === Infinity) return 'Infinity';
            if (value === -Infinity) return '-Infinity';
            return value.toString();
        }
        if (typeof value === 'string') {
            return value.length > 200 ? value.substring(0, 200) + '... (truncated)' : value;
        }
        if (typeof value === 'object') {
            try {
                return JSON.stringify(value).substring(0, 500) + '... (truncated)';
            } catch {
                return '[Object could not be stringified]';
            }
        }
        return String(value);
    }

    // ============================================
    // CREATE DATA PREVIEW
    // ============================================
    private createDataPreview(savedData: any): string {
        if (!savedData) return '[No data available]';
        
        try {
            const preview = {
                saveVersion: savedData.saveVersion,
                playerName: savedData.playerName,
                resourcesCount: savedData.resources ? Object.keys(savedData.resources).length : 0,
                buildingsCount: savedData.buildings ? Object.keys(savedData.buildings).length : 0,
                unitsCount: savedData.units ? Object.keys(savedData.units).length : 0,
                logsCount: Array.isArray(savedData.logs) ? savedData.logs.length : 0,
                hasActiveWar: !!savedData.activeWar,
                hasGrudges: Array.isArray(savedData.grudges) && savedData.grudges.length > 0,
                hasSpyReports: Array.isArray(savedData.spyReports) && savedData.spyReports.length > 0
            };
            return JSON.stringify(preview, null, 2);
        } catch {
            return '[Could not create data preview]';
        }
    }

    // ============================================
    // GET LOCAL STORAGE SIZE
    // ============================================
    private getLocalStorageSize(): number {
        let total = 0;
        for (const key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += localStorage[key].length + key.length;
            }
        }
        return total;
    }

    // ============================================
    // LOG TO CONSOLE
    // ============================================
    private logToConsole(entry: ErrorLogEntry): void {
        console.groupCollapsed(`[ErrorLogger] ${entry.errorType}: ${entry.errorMessage}`);
        console.log('📅 Timestamp:', entry.timestamp);
        console.log('📍 Location:', entry.location);
        console.log('🔧 Context:', entry.context);
        console.log('💻 System Info:', entry.systemInfo);
        console.log('📊 Application State:', entry.applicationState);
        console.log('📁 Raw Data:', entry.rawData);
        console.log('✅ Recovery Action:', entry.recoveryAction);
        console.log('💡 Suggestions:', entry.suggestions);
        console.log('📋 Stack Trace:', entry.stackTrace);
        console.groupEnd();
    }

    // ============================================
    // DOWNLOAD ERROR LOG FILE
    // ============================================
    private downloadErrorLogFile(latestEntry: ErrorLogEntry): void {
        try {
            const logContent = this.formatErrorLog(latestEntry);
            const blob = new Blob([logContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            link.download = `err_${timestamp}.log`;
            link.href = url;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('[ErrorLogger] Failed to download error log file:', e);
        }
    }

    // ============================================
    // FORMAT ERROR LOG CONTENT
    // ============================================
    private formatErrorLog(entry: ErrorLogEntry): string {
        const separator = '='.repeat(80);
        const sectionSeparator = '-'.repeat(80);

        return `
${separator}
IRON DUNE OPERATIONS - ERROR LOG
${separator}

📅 ERROR OCCURRENCE INFORMATION
${sectionSeparator}
Timestamp: ${entry.timestamp}
ISO Timestamp: ${entry.isoTimestamp}
Error Type: ${entry.errorType}
Error Message: ${entry.errorMessage}

${sectionSeparator}
📍 ERROR LOCATION
${sectionSeparator}
File: ${entry.location.file}
Function: ${entry.location.function}
Line: ${entry.location.line || 'Unknown'}
Column: ${entry.location.column || 'Unknown'}

${sectionSeparator}
🔧 ERROR CONTEXT
${sectionSeparator}
Save Version: ${entry.context.saveVersion || 'Unknown'}
Migration Stage: ${entry.context.migrationStage}
Field Name: ${entry.context.fieldName || 'N/A'}
Expected Type: ${entry.context.expectedType || 'N/A'}
Actual Type: ${entry.context.actualType || 'N/A'}
Actual Value: ${entry.context.actualValue || 'N/A'}

${sectionSeparator}
💻 SYSTEM INFORMATION
${sectionSeparator}
User Agent: ${entry.systemInfo.userAgent}
Language: ${entry.systemInfo.language}
Platform: ${entry.systemInfo.platform}
Screen Resolution: ${entry.systemInfo.screenResolution}
Memory: ${entry.systemInfo.memory || 'Unknown'}

${sectionSeparator}
📊 APPLICATION STATE
${sectionSeparator}
URL: ${entry.applicationState.url}
Local Storage Size: ${entry.applicationState.localStorageSize} bytes
Has Save: ${entry.applicationState.hasSave}
Save Size: ${entry.applicationState.saveSize} bytes

${sectionSeparator}
📁 RAW DATA ANALYSIS
${sectionSeparator}
Saved Data Preview:
${entry.rawData.savedDataPreview}

Corrupted Fields (${entry.rawData.corruptedFields.length}):
${entry.rawData.corruptedFields.map(f => `  - ${f}`).join('\n') || '  None detected'}

Validation Errors (${entry.rawData.validationErrors.length}):
${entry.rawData.validationErrors.map(e => `  - ${e}`).join('\n') || '  None detected'}

${sectionSeparator}
✅ RECOVERY ACTION TAKEN
${sectionSeparator}
${entry.recoveryAction}

${sectionSeparator}
💡 SUGGESTIONS FOR RESOLUTION
${sectionSeparator}
${entry.suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n') || '  No suggestions available'}

${sectionSeparator}
📋 STACK TRACE
${sectionSeparator}
${entry.stackTrace}

${separator}
END OF ERROR LOG
${separator}
`;
    }

    // ============================================
    // GET ALL ERRORS
    // ============================================
    public getAllErrors(): ErrorLogEntry[] {
        return [...this.errorLog];
    }

    // ============================================
    // CLEAR ERROR LOG
    // ============================================
    public clearErrorLog(): void {
        this.errorLog = [];
        this.saveToStorage();
        console.log('[ErrorLogger] Error log cleared');
    }

    // ============================================
    // EXPORT ERROR LOG AS FILE
    // ============================================
    public exportErrorLog(): void {
        if (this.errorLog.length === 0) {
            console.log('[ErrorLogger] No errors to export');
            return;
        }

        const fullLog = this.errorLog.map(entry => this.formatErrorLog(entry)).join('\n\n');
        const blob = new Blob([fullLog], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.download = `err_full_${timestamp}.log`;
        link.href = url;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

// ============================================
// CONVENIENCE FUNCTION FOR MIGRATION ERRORS
// ============================================
export const logMigrationError = (params: {
    error: Error | unknown;
    location: { file: string; function: string; line?: number; column?: number };
    saveVersion?: number;
    migrationStage: string;
    fieldName?: string;
    expectedType?: string;
    actualType?: string;
    actualValue?: any;
    savedData?: any;
    recoveryAction: string;
    suggestions?: string[];
}): void => {
    ErrorLogger.getInstance().logError(params);
};

// ============================================
// WRAPPER FOR MIGRATION FUNCTION
// ============================================
export const withErrorLogging = <T extends (...args: any[]) => any>(
    fn: T,
    location: { file: string; function: string },
    migrationStage: string
): T => {
    return ((...args: any[]) => {
        try {
            return fn(...args);
        } catch (error) {
            logMigrationError({
                error,
                location,
                migrationStage,
                recoveryAction: 'Returned safe initial state to prevent application crash',
                suggestions: [
                    'Try clearing browser localStorage and starting a new game',
                    'Check if the save file was modified or corrupted',
                    'Ensure browser is up to date',
                    'Try importing the save file again',
                    'Contact support with the attached error log file'
                ]
            });
            throw error;
        }
    }) as T;
};
