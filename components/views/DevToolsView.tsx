import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useProfileRole } from '../../hooks/useProfileRole';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../hooks/useLanguage';
import { useToast } from '../ui/Toast';
import { BuildingType, ResourceType, UnitType } from '../../types/enums';
import { GameState } from '../../types';
import { Icons, ResourceIcon } from '../UIComponents';
import { useGameStoreSelector } from '../../stores/gameStore';
import { selectGameState } from '../../stores/selectors/gameSelectors';
import { buildBackendUrl } from '../../lib/backend';

const formatKey = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const parsePositiveInt = (value: string) => {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed;
};

const applyStateUpdate = (nextState: GameState, onError: (msg: string) => void, fallbackMessage: string) => {
  if (typeof window === 'undefined' || typeof window._updateGameState !== 'function') {
    onError(fallbackMessage);
    return false;
  }
  window._updateGameState(nextState);
  return true;
};

type DevSubview = 'actions' | 'metrics' | 'debug';

interface DevMetricsResponse {
  ok: boolean;
  server?: {
    time: number;
    connectedPlayers: number;
    commandMetrics?: {
      totals?: Record<string, number>;
      latencyMs?: Record<string, number>;
      rates?: Record<string, number>;
    };
  };
  player?: {
    revision: number;
    updatedAt: string | null;
    resources: Record<string, number>;
    queues: {
      activeConstructions: number;
      activeRecruitments: number;
      activeResearch: number;
    };
    totals: {
      buildingLevels: number;
      unitCount: number;
      logs: number;
    };
  };
  error?: string;
}

export const DevToolsView: React.FC = () => {
  const gameState = useGameStoreSelector(selectGameState);
  const { role, isPrivileged } = useProfileRole();
  const { session } = useAuth();
  const { language } = useLanguage();
  const { showSuccess, showWarning, showError } = useToast();
  const isEs = language === 'es';

  const [resourceType, setResourceType] = useState<ResourceType>(ResourceType.MONEY);
  const [resourceAmount, setResourceAmount] = useState('1000');

  const [unitType, setUnitType] = useState<UnitType>(UnitType.CYBER_MARINE);
  const [unitAmount, setUnitAmount] = useState('10');

  const [buildingType, setBuildingType] = useState<BuildingType>(BuildingType.HOUSE);
  const [buildingLevels, setBuildingLevels] = useState('1');
  const [subview, setSubview] = useState<DevSubview>('actions');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<DevMetricsResponse | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  const resourceOptions = useMemo(() => Object.values(ResourceType), []);
  const unitOptions = useMemo(() => Object.values(UnitType), []);
  const buildingOptions = useMemo(() => Object.values(BuildingType), []);

  const labels = useMemo(() => ({
    title: isEs ? 'Herramientas de Control' : 'Control Tools',
    activeRole: isEs ? 'Rol activo' : 'Active role',
    restrictedTitle: isEs ? 'Acceso restringido' : 'Restricted access',
    restrictedRole: isEs ? 'Rol actual' : 'Current role',
    invalidAmount: isEs ? 'Cantidad invalida.' : 'Invalid amount.',
    applyFallback: isEs ? 'No se pudo aplicar el cambio. Recarga la vista.' : 'Could not apply update. Reload the view.',
    actionDone: isEs ? 'Operacion completada.' : 'Operation completed.',
    serverError: isEs ? 'No se pudo procesar la operacion en el servidor.' : 'Server could not process operation.',
    authError: isEs ? 'Tu sesion no esta disponible.' : 'Your session is not available.',
    sectionActions: isEs ? 'Acciones' : 'Actions',
    sectionMetrics: isEs ? 'Metricas' : 'Metrics',
    sectionDebug: isEs ? 'Pruebas rapidas' : 'Quick tests',
    resources: isEs ? 'Recursos' : 'Resources',
    troops: isEs ? 'Tropas' : 'Units',
    buildings: isEs ? 'Edificios' : 'Buildings',
    type: isEs ? 'Tipo' : 'Type',
    amount: isEs ? 'Cantidad' : 'Amount',
    levels: isEs ? 'Niveles' : 'Levels',
    addResources: isEs ? 'Agregar recursos' : 'Add resources',
    addTroops: isEs ? 'Agregar tropas' : 'Add units',
    addLevels: isEs ? 'Subir niveles' : 'Increase levels',
    refresh: isEs ? 'Actualizar metricas' : 'Refresh metrics',
    commands: isEs ? 'Comandos servidor' : 'Server commands',
    connectedPlayers: isEs ? 'Jugadores conectados' : 'Connected players',
    revision: isEs ? 'Revision actual' : 'Current revision',
    queueStatus: isEs ? 'Colas activas' : 'Active queues',
    stateTotals: isEs ? 'Totales de estado' : 'State totals',
    requests: isEs ? 'Solicitudes' : 'Requests',
    success: isEs ? 'Exitos' : 'Success',
    conflicts: isEs ? 'Conflictos' : 'Conflicts',
    errorRate: isEs ? 'Tasa error' : 'Error rate',
    p95: 'P95(ms)',
    buildQueue: isEs ? 'Construccion' : 'Build',
    recruitQueue: isEs ? 'Reclutamiento' : 'Recruit',
    researchQueue: isEs ? 'Investigacion' : 'Research',
    unitTotal: isEs ? 'Total tropas' : 'Total units',
    buildingLevelsTotal: isEs ? 'Niveles edificios' : 'Building levels',
    logsTotal: isEs ? 'Registros' : 'Logs',
    lifecycle: isEs ? 'Resolver lifecycle y colas' : 'Resolve lifecycle and queues',
    bootstrap: isEs ? 'Recargar estado (bootstrap)' : 'Reload state (bootstrap)',
    quickHint: isEs ? 'Estas acciones se ejecutan por endpoint para validar flujo server-side.' : 'These actions run through endpoints to validate server-side flow.',
  }), [isEs]);

  const runDevAction = useCallback(async (
    action: string,
    payload: Record<string, unknown>,
    successMessage: string,
  ) => {
    const token = session?.access_token;
    if (!token) {
      showError(labels.authError);
      return false;
    }

    setBusyAction(action);
    try {
      const response = await fetch(buildBackendUrl('/api/devtools/action'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, ...payload }),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) {
        showError(body?.error || labels.serverError);
        return false;
      }

      if (body?.gameState) {
        applyStateUpdate(body.gameState as GameState, showError, labels.applyFallback);
      }
      showSuccess(successMessage || labels.actionDone);
      return true;
    } catch {
      showError(labels.serverError);
      return false;
    } finally {
      setBusyAction(null);
    }
  }, [labels.actionDone, labels.applyFallback, labels.authError, labels.serverError, session?.access_token, showError, showSuccess]);

  const loadMetrics = useCallback(async () => {
    const token = session?.access_token;
    if (!token) return;
    setMetricsLoading(true);
    try {
      const response = await fetch(buildBackendUrl('/api/devtools/metrics'), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setMetrics({ ok: false, error: body?.error || 'metrics_failed' });
      } else {
        setMetrics(body as DevMetricsResponse);
      }
    } catch {
      setMetrics({ ok: false, error: 'metrics_failed' });
    } finally {
      setMetricsLoading(false);
    }
  }, [session?.access_token]);

  const reloadBootstrap = useCallback(async () => {
    const token = session?.access_token;
    if (!token) {
      showError(labels.authError);
      return;
    }

    setBusyAction('BOOTSTRAP_REFRESH');
    try {
      const response = await fetch(buildBackendUrl('/api/bootstrap'), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.game_state) {
        showError(body?.error || labels.serverError);
        return;
      }
      applyStateUpdate(body.game_state as GameState, showError, labels.applyFallback);
      showSuccess(labels.actionDone);
    } catch {
      showError(labels.serverError);
    } finally {
      setBusyAction(null);
    }
  }, [labels.actionDone, labels.applyFallback, labels.authError, labels.serverError, session?.access_token, showError, showSuccess]);

  useEffect(() => {
    if (!isPrivileged) return;
    void loadMetrics();
    const interval = window.setInterval(() => {
      void loadMetrics();
    }, 10000);
    return () => window.clearInterval(interval);
  }, [isPrivileged, loadMetrics]);

  const addResources = () => {
    const amount = parsePositiveInt(resourceAmount);
    if (!amount) {
      showWarning(labels.invalidAmount);
      return;
    }
    void runDevAction('ADD_RESOURCE', { resourceType, amount }, `${labels.resources}: ${formatKey(resourceType)} +${amount}`);
  };

  const addUnits = () => {
    const amount = parsePositiveInt(unitAmount);
    if (!amount) {
      showWarning(labels.invalidAmount);
      return;
    }
    void runDevAction('ADD_UNIT', { unitType, amount }, `${labels.troops}: ${formatKey(unitType)} +${amount}`);
  };

  const addBuildings = () => {
    const amount = parsePositiveInt(buildingLevels);
    if (!amount) {
      showWarning(labels.invalidAmount);
      return;
    }
    void runDevAction('ADD_BUILDING_LEVELS', { buildingType, amount }, `${labels.buildings}: ${formatKey(buildingType)} +${amount}`);
  };

  if (!isPrivileged) {
    return (
      <div className="w-full h-full flex items-center justify-center p-6">
        <div className="glass-panel w-full max-w-xl p-6 rounded-2xl border border-red-500/30 bg-red-950/20 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4">
            <Icons.Lock className="w-6 h-6 text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-red-200 uppercase tracking-widest">{labels.restrictedTitle}</h2>
          <p className="text-sm text-slate-400 mt-2">{labels.restrictedRole}: {role}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col gap-6 p-3 md:p-6">
      <div className="glass-panel p-5 md:p-6 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/30 via-slate-900/60 to-slate-950/60">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <Icons.Terminal className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-amber-200 uppercase tracking-widest">{labels.title}</h1>
            <p className="text-xs md:text-sm text-slate-400">{labels.activeRole}: {role}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {([
            { id: 'actions', label: labels.sectionActions },
            { id: 'metrics', label: labels.sectionMetrics },
            { id: 'debug', label: labels.sectionDebug },
          ] as Array<{ id: DevSubview; label: string }>).map(tab => (
            <button
              key={tab.id}
              onClick={() => setSubview(tab.id)}
              className={`py-2 rounded-lg border text-[10px] md:text-xs font-bold uppercase tracking-widest transition ${
                subview === tab.id
                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                  : 'bg-slate-900/50 border-white/10 text-slate-300 hover:bg-slate-900/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {subview === 'actions' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-cyan-500/20 bg-slate-900/50">
          <div className="flex items-center gap-2 mb-4">
            <ResourceIcon resource={ResourceType.MONEY} className="w-5 h-5" alt="Money" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-cyan-200">{labels.resources}</h3>
          </div>

          <label className="text-[10px] uppercase tracking-widest text-slate-500">{labels.type}</label>
          <select
            value={resourceType}
            onChange={(e) => setResourceType(e.target.value as ResourceType)}
            className="w-full mt-2 mb-4 bg-slate-950/60 border border-white/10 rounded-lg p-2 text-sm text-slate-200"
          >
            {resourceOptions.map(option => (
              <option key={option} value={option}>{formatKey(option)}</option>
            ))}
          </select>

          <label className="text-[10px] uppercase tracking-widest text-slate-500">{labels.amount}</label>
          <input
            type="number"
            min={1}
            value={resourceAmount}
            onChange={(e) => setResourceAmount(e.target.value)}
            className="w-full mt-2 mb-4 bg-slate-950/60 border border-white/10 rounded-lg p-2 text-sm text-slate-200"
          />

          <button
            onClick={addResources}
            disabled={busyAction !== null}
            className="w-full py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 text-xs font-bold uppercase tracking-widest hover:bg-cyan-500/30 transition"
          >
            {labels.addResources}
          </button>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-emerald-500/20 bg-slate-900/50">
          <div className="flex items-center gap-2 mb-4">
            <Icons.Army className="w-5 h-5 text-emerald-300" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-200">{labels.troops}</h3>
          </div>

          <label className="text-[10px] uppercase tracking-widest text-slate-500">{labels.type}</label>
          <select
            value={unitType}
            onChange={(e) => setUnitType(e.target.value as UnitType)}
            className="w-full mt-2 mb-4 bg-slate-950/60 border border-white/10 rounded-lg p-2 text-sm text-slate-200"
          >
            {unitOptions.map(option => (
              <option key={option} value={option}>{formatKey(option)}</option>
            ))}
          </select>

          <label className="text-[10px] uppercase tracking-widest text-slate-500">{labels.amount}</label>
          <input
            type="number"
            min={1}
            value={unitAmount}
            onChange={(e) => setUnitAmount(e.target.value)}
            className="w-full mt-2 mb-4 bg-slate-950/60 border border-white/10 rounded-lg p-2 text-sm text-slate-200"
          />

          <button
            onClick={addUnits}
            disabled={busyAction !== null}
            className="w-full py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-bold uppercase tracking-widest hover:bg-emerald-500/30 transition"
          >
            {labels.addTroops}
          </button>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-amber-500/20 bg-slate-900/50">
          <div className="flex items-center gap-2 mb-4">
            <Icons.Base className="w-5 h-5 text-amber-300" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-amber-200">{labels.buildings}</h3>
          </div>

          <label className="text-[10px] uppercase tracking-widest text-slate-500">{labels.type}</label>
          <select
            value={buildingType}
            onChange={(e) => setBuildingType(e.target.value as BuildingType)}
            className="w-full mt-2 mb-4 bg-slate-950/60 border border-white/10 rounded-lg p-2 text-sm text-slate-200"
          >
            {buildingOptions.map(option => (
              <option key={option} value={option}>{formatKey(option)}</option>
            ))}
          </select>

          <label className="text-[10px] uppercase tracking-widest text-slate-500">{labels.levels}</label>
          <input
            type="number"
            min={1}
            value={buildingLevels}
            onChange={(e) => setBuildingLevels(e.target.value)}
            className="w-full mt-2 mb-4 bg-slate-950/60 border border-white/10 rounded-lg p-2 text-sm text-slate-200"
          />

          <button
            onClick={addBuildings}
            disabled={busyAction !== null}
            className="w-full py-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-bold uppercase tracking-widest hover:bg-amber-500/30 transition"
          >
            {labels.addLevels}
          </button>
        </div>
      </div>
      )}

      {subview === 'metrics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass-panel p-5 rounded-2xl border border-cyan-500/20 bg-slate-900/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-cyan-200">{labels.commands}</h3>
              <button
                onClick={() => void loadMetrics()}
                disabled={metricsLoading}
                className="px-3 py-1 rounded-lg border border-cyan-500/30 text-cyan-200 text-[10px] uppercase tracking-widest"
              >
                {labels.refresh}
              </button>
            </div>
            <div className="space-y-2 text-xs text-slate-300">
              <div>{labels.connectedPlayers}: {metrics?.server?.connectedPlayers ?? '-'}</div>
              <div>{labels.revision}: {metrics?.player?.revision ?? Number(gameState.revision || 0)}</div>
              <div>{labels.requests}: {metrics?.server?.commandMetrics?.totals?.requests ?? '-'}</div>
              <div>{labels.success}: {metrics?.server?.commandMetrics?.totals?.success ?? '-'}</div>
              <div>{labels.conflicts}: {metrics?.server?.commandMetrics?.totals?.conflicts ?? '-'}</div>
              <div>{labels.errorRate}: {metrics?.server?.commandMetrics?.rates?.errorRate ?? '-'}</div>
              <div>{labels.p95}: {metrics?.server?.commandMetrics?.latencyMs?.p95 ?? '-'}</div>
            </div>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-emerald-500/20 bg-slate-900/50">
            <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-200 mb-4">{labels.queueStatus}</h3>
            <div className="space-y-2 text-xs text-slate-300">
              <div>{labels.buildQueue}: {metrics?.player?.queues?.activeConstructions ?? (gameState.activeConstructions?.length || 0)}</div>
              <div>{labels.recruitQueue}: {metrics?.player?.queues?.activeRecruitments ?? (gameState.activeRecruitments?.length || 0)}</div>
              <div>{labels.researchQueue}: {metrics?.player?.queues?.activeResearch ?? (gameState.activeResearch ? 1 : 0)}</div>
            </div>

            <h4 className="text-sm font-bold uppercase tracking-widest text-emerald-300 mt-5 mb-2">{labels.stateTotals}</h4>
            <div className="space-y-2 text-xs text-slate-300">
              <div>{labels.unitTotal}: {metrics?.player?.totals?.unitCount ?? Object.values(gameState.units || {}).reduce((acc, value) => acc + Number(value || 0), 0)}</div>
              <div>{labels.buildingLevelsTotal}: {metrics?.player?.totals?.buildingLevels ?? Object.values(gameState.buildings || {}).reduce((acc, building) => acc + Number(building?.level || 0), 0)}</div>
              <div>{labels.logsTotal}: {metrics?.player?.totals?.logs ?? (gameState.logs?.length || 0)}</div>
            </div>
          </div>
        </div>
      )}

      {subview === 'debug' && (
        <div className="glass-panel p-5 rounded-2xl border border-amber-500/20 bg-slate-900/50">
          <p className="text-xs text-slate-400 mb-5">{labels.quickHint}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={() => void runDevAction('RESOLVE_LIFECYCLE', {}, labels.actionDone)}
              disabled={busyAction !== null}
              className="py-3 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-100 text-xs font-bold uppercase tracking-widest"
            >
              {labels.lifecycle}
            </button>
            <button
              onClick={() => void reloadBootstrap()}
              disabled={busyAction !== null}
              className="py-3 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-100 text-xs font-bold uppercase tracking-widest"
            >
              {labels.bootstrap}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
