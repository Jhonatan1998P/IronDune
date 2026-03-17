import { useGameStoreSelector } from '../stores/gameStore';
import type { GameEngineSnapshot } from '../stores/gameStore';

export const useGame = (): GameEngineSnapshot => {
  return useGameStoreSelector((state) => state);
};

export const useGameSelector = <T,>(selector: (state: GameEngineSnapshot['gameState']) => T): T => {
  return useGameStoreSelector((state) => selector(state.gameState));
};
