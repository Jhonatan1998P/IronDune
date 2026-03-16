import React, { useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { useProfileRole } from '../../hooks/useProfileRole';
import { useToast } from '../ui/Toast';
import { BuildingType, ResourceType, UnitType } from '../../types/enums';
import { GameState } from '../../types';
import { Icons } from '../UIComponents';

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

const applyStateUpdate = (nextState: GameState, onError: (msg: string) => void) => {
  if (typeof window === 'undefined' || typeof window._updateGameState !== 'function') {
    onError('No se pudo aplicar el cambio. Recarga la vista.');
    return false;
  }
  window._updateGameState(nextState);
  return true;
};

export const DevToolsView: React.FC = () => {
  const { gameState } = useGame();
  const { role, isPrivileged } = useProfileRole();
  const { showSuccess, showWarning, showError } = useToast();

  const [resourceType, setResourceType] = useState<ResourceType>(ResourceType.MONEY);
  const [resourceAmount, setResourceAmount] = useState('1000');

  const [unitType, setUnitType] = useState<UnitType>(UnitType.CYBER_MARINE);
  const [unitAmount, setUnitAmount] = useState('10');

  const [buildingType, setBuildingType] = useState<BuildingType>(BuildingType.HOUSE);
  const [buildingLevels, setBuildingLevels] = useState('1');

  const resourceOptions = useMemo(() => Object.values(ResourceType), []);
  const unitOptions = useMemo(() => Object.values(UnitType), []);
  const buildingOptions = useMemo(() => Object.values(BuildingType), []);

  const addResources = () => {
    const amount = parsePositiveInt(resourceAmount);
    if (!amount) {
      showWarning('Cantidad invalida.');
      return;
    }

    const current = gameState.resources?.[resourceType] ?? 0;
    const nextState: GameState = {
      ...gameState,
      resources: {
        ...gameState.resources,
        [resourceType]: current + amount
      }
    };

    if (applyStateUpdate(nextState, showError)) {
      showSuccess(`Recurso agregado: ${formatKey(resourceType)} +${amount}.`);
    }
  };

  const addUnits = () => {
    const amount = parsePositiveInt(unitAmount);
    if (!amount) {
      showWarning('Cantidad invalida.');
      return;
    }

    const current = gameState.units?.[unitType] ?? 0;
    const nextState: GameState = {
      ...gameState,
      units: {
        ...gameState.units,
        [unitType]: current + amount
      }
    };

    if (applyStateUpdate(nextState, showError)) {
      showSuccess(`Tropas agregadas: ${formatKey(unitType)} +${amount}.`);
    }
  };

  const addBuildings = () => {
    const amount = parsePositiveInt(buildingLevels);
    if (!amount) {
      showWarning('Cantidad invalida.');
      return;
    }

    const current = gameState.buildings?.[buildingType]?.level ?? 0;
    const nextState: GameState = {
      ...gameState,
      buildings: {
        ...gameState.buildings,
        [buildingType]: {
          level: current + amount,
          isDamaged: gameState.buildings?.[buildingType]?.isDamaged ?? false
        }
      }
    };

    if (applyStateUpdate(nextState, showError)) {
      showSuccess(`Edificio actualizado: ${formatKey(buildingType)} +${amount} niveles.`);
    }
  };

  if (!isPrivileged) {
    return (
      <div className="w-full h-full flex items-center justify-center p-6">
        <div className="glass-panel w-full max-w-xl p-6 rounded-2xl border border-red-500/30 bg-red-950/20 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4">
            <Icons.Lock className="w-6 h-6 text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-red-200 uppercase tracking-widest">Acceso restringido</h2>
          <p className="text-sm text-slate-400 mt-2">Rol actual: {role}</p>
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
            <h1 className="text-xl md:text-2xl font-bold text-amber-200 uppercase tracking-widest">Dev Tools</h1>
            <p className="text-xs md:text-sm text-slate-400">Rol activo: {role}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-cyan-500/20 bg-slate-900/50">
          <div className="flex items-center gap-2 mb-4">
            <Icons.Resources.Money className="w-5 h-5 text-cyan-300" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-cyan-200">Recursos</h3>
          </div>

          <label className="text-[10px] uppercase tracking-widest text-slate-500">Tipo</label>
          <select
            value={resourceType}
            onChange={(e) => setResourceType(e.target.value as ResourceType)}
            className="w-full mt-2 mb-4 bg-slate-950/60 border border-white/10 rounded-lg p-2 text-sm text-slate-200"
          >
            {resourceOptions.map(option => (
              <option key={option} value={option}>{formatKey(option)}</option>
            ))}
          </select>

          <label className="text-[10px] uppercase tracking-widest text-slate-500">Cantidad</label>
          <input
            type="number"
            min={1}
            value={resourceAmount}
            onChange={(e) => setResourceAmount(e.target.value)}
            className="w-full mt-2 mb-4 bg-slate-950/60 border border-white/10 rounded-lg p-2 text-sm text-slate-200"
          />

          <button
            onClick={addResources}
            className="w-full py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 text-xs font-bold uppercase tracking-widest hover:bg-cyan-500/30 transition"
          >
            Agregar recursos
          </button>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-emerald-500/20 bg-slate-900/50">
          <div className="flex items-center gap-2 mb-4">
            <Icons.Army className="w-5 h-5 text-emerald-300" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-200">Tropas</h3>
          </div>

          <label className="text-[10px] uppercase tracking-widest text-slate-500">Tipo</label>
          <select
            value={unitType}
            onChange={(e) => setUnitType(e.target.value as UnitType)}
            className="w-full mt-2 mb-4 bg-slate-950/60 border border-white/10 rounded-lg p-2 text-sm text-slate-200"
          >
            {unitOptions.map(option => (
              <option key={option} value={option}>{formatKey(option)}</option>
            ))}
          </select>

          <label className="text-[10px] uppercase tracking-widest text-slate-500">Cantidad</label>
          <input
            type="number"
            min={1}
            value={unitAmount}
            onChange={(e) => setUnitAmount(e.target.value)}
            className="w-full mt-2 mb-4 bg-slate-950/60 border border-white/10 rounded-lg p-2 text-sm text-slate-200"
          />

          <button
            onClick={addUnits}
            className="w-full py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-bold uppercase tracking-widest hover:bg-emerald-500/30 transition"
          >
            Agregar tropas
          </button>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-amber-500/20 bg-slate-900/50">
          <div className="flex items-center gap-2 mb-4">
            <Icons.Base className="w-5 h-5 text-amber-300" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-amber-200">Edificios</h3>
          </div>

          <label className="text-[10px] uppercase tracking-widest text-slate-500">Tipo</label>
          <select
            value={buildingType}
            onChange={(e) => setBuildingType(e.target.value as BuildingType)}
            className="w-full mt-2 mb-4 bg-slate-950/60 border border-white/10 rounded-lg p-2 text-sm text-slate-200"
          >
            {buildingOptions.map(option => (
              <option key={option} value={option}>{formatKey(option)}</option>
            ))}
          </select>

          <label className="text-[10px] uppercase tracking-widest text-slate-500">Niveles</label>
          <input
            type="number"
            min={1}
            value={buildingLevels}
            onChange={(e) => setBuildingLevels(e.target.value)}
            className="w-full mt-2 mb-4 bg-slate-950/60 border border-white/10 rounded-lg p-2 text-sm text-slate-200"
          />

          <button
            onClick={addBuildings}
            className="w-full py-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-bold uppercase tracking-widest hover:bg-amber-500/30 transition"
          >
            Subir niveles
          </button>
        </div>
      </div>
    </div>
  );
};
