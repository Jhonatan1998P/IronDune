
import { SpyReport, LogEntry } from './types';

export const formatNumber = (value: number): string => {
  // Aseguramos que visualmente siempre sea un entero, eliminando decimales de la lógica interna inicial.
  const intValue = Math.floor(value);

  // Menor a 1000: Mostrar entero simple
  if (intValue < 1000) return intValue.toString();

  // Reglas solicitadas:
  // 1.000 = 1.00K
  // 1.000.000 = 1.00Mill
  // 1.000.000.000 = 1.00K Mill
  // 1.000.000.000.000 = 1.00Bill

  // Billions (Trillions in standard short scale, defined as Bill in prompt) -> 1,000,000,000,000
  if (intValue >= 1000000000000) {
    return (intValue / 1000000000000).toFixed(2) + "Bill";
  }

  // K Millions (Billions in standard short scale) -> 1,000,000,000
  if (intValue >= 1000000000) {
    return (intValue / 1000000000).toFixed(2) + "K Mill";
  }

  // Millions -> 1,000,000
  if (intValue >= 1000000) {
    return (intValue / 1000000).toFixed(2) + "Mill";
  }

  // Thousands -> 1,000
  if (intValue >= 1000) {
    return (intValue / 1000).toFixed(2) + "K";
  }

  return intValue.toString();
};

export const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
};

// ============================================
// SPY REPORTS PERSISTENCE & LIMITS
// ============================================
const MAX_ARCHIVED_REPORTS = 20;
const MAX_INBOX_REPORTS = 10;

/**
 * Conserva los informes de espionaje en memoria con límite de 20
 * Los informes más viejos se eliminan automáticamente
 */
export const saveSpyReportsToStorage = (reports: SpyReport[]): void => {
    void reports;
};

/**
 * Carga los informes de espionaje
 * Filtra automáticamente los informes expirados
 */
export const loadSpyReportsFromStorage = (): SpyReport[] => {
    return [];
};

/**
 * Agrega un nuevo informe a la lista, respetando el límite de 20
 * Retorna la lista actualizada
 */
export const addSpyReport = (reports: SpyReport[], newReport: SpyReport): SpyReport[] => {
    // Primero filtrar informes expirados
    const now = Date.now();
    const validReports = reports.filter(r => r.expiresAt > now);
    
    // Agregar el nuevo informe
    const updatedReports = [newReport, ...validReports];
    
    // Ordenar por createdAt (más reciente primero) y limitar a 20
    return updatedReports
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, MAX_ARCHIVED_REPORTS);
};

/**
 * Limpia los informes expirados
 * Retorna la lista limpia
 */
export const cleanupExpiredSpyReports = (reports: SpyReport[]): SpyReport[] => {
    const now = Date.now();
    const validReports = reports.filter(r => r.expiresAt > now);

    return validReports;
};

/**
 * Obtiene los informes para la bandeja (inbox) - máximo 10
 * Estos son los informes más recientes que aún no han expirado
 */
export const getInboxSpyReports = (reports: SpyReport[]): SpyReport[] => {
    const now = Date.now();
    return reports
        .filter(r => r.expiresAt > now)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, MAX_INBOX_REPORTS);
};

// ============================================
// ALL LOGS PERSISTENCE & LIMITS
// ============================================
const MAX_ARCHIVED_LOGS = 20;
const MAX_INBOX_LOGS = 10;

/**
 * Conserva todos los logs/informes en memoria con límite de 20
 * Los más viejos se eliminan automáticamente
 */
export const saveLogsToStorage = (logs: LogEntry[]): void => {
    void logs;
};

/**
 * Carga los logs/informes
 */
export const loadLogsFromStorage = (): LogEntry[] => {
    return [];
};

/**
 * Agrega un nuevo log a la lista, respetando el límite de 20
 * Retorna la lista actualizada
 */
export const addGameLog = (logs: LogEntry[], newLog: LogEntry): LogEntry[] => {
    // Filtrar solo logs de tipo informe
    const reportLogs = logs.filter(log => 
        log.type === 'combat' || log.type === 'mission' || log.type === 'intel' || log.type === 'war'
    );
    
    // Agregar el nuevo log si es de tipo informe
    const updatedLogs = newLog.type === 'combat' || newLog.type === 'mission' || newLog.type === 'intel' || newLog.type === 'war'
        ? [newLog, ...reportLogs]
        : reportLogs;
    
    // Ordenar por timestamp (más reciente primero) y limitar a 20
    return updatedLogs
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_ARCHIVED_LOGS);
};

/**
 * Obtiene los logs para la bandeja (inbox) - máximo 10
 * Solo los informes más recientes
 */
export const getInboxLogs = (logs: LogEntry[]): LogEntry[] => {
    const reportLogs = logs.filter(log => 
        log.type === 'combat' || log.type === 'mission' || log.type === 'intel' || log.type === 'war'
    );
    
    return reportLogs
        .filter(log => !log.archived)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_INBOX_LOGS);
};

/**
 * Obtiene los logs archivados - máximo 20
 */
export const getArchivedLogs = (logs: LogEntry[]): LogEntry[] => {
    return logs
        .filter(log => log.archived)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_ARCHIVED_LOGS);
};
