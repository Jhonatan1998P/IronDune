/**
 * Hook Global: useMultiplayer
 * 
 * Hook para acceder al contexto multijugador.
 * Este archivo solo exporta el hook para compatibilidad con Vite Fast Refresh.
 */

export { useMultiplayer } from './useMultiplayerHook';
export {
  MultiplayerProvider,
  MultiplayerContext,
} from './useMultiplayerInternal';
export type {
  MultiplayerContextType,
  MultiplayerProviderProps,
} from './useMultiplayerInternal';
