import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useP2PGameSync } from '../hooks/useP2PGameSync';
import { useMultiplayer } from '../hooks/useMultiplayer';
import { gameEventBus } from '../utils/eventBus';
import { P2PSpyRequest } from '../types/multiplayer';
import { ResourceType, UnitType, BuildingType } from '../types/enums';
import { useGameStore } from '../stores/gameStore';

vi.mock('../hooks/useMultiplayer', () => ({
  useMultiplayer: vi.fn(),
}));

describe('P2P Espionage System', () => {
  const mockSendToPeer = vi.fn();
  const mockLocalPlayerId = 'player-123';
  const mockGameState = {
    playerName: 'Test Player',
    empirePoints: 1000,
    units: {
      [UnitType.CYBER_MARINE]: 50,
      [UnitType.TITAN_MBT]: 10,
    },
    resources: {
      [ResourceType.MONEY]: 5000,
      [ResourceType.GOLD]: 1000,
    },
    buildings: {
      [BuildingType.HOUSE]: { level: 5 },
      [BuildingType.FACTORY]: { level: 2 },
    },
    incomingAttacks: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    const currentSnapshot = useGameStore.getState().snapshot;
    useGameStore.getState().setSnapshot({
      ...currentSnapshot,
      gameState: {
        ...currentSnapshot.gameState,
        ...mockGameState,
      } as any,
      addP2PIncomingAttack: vi.fn(),
      applyP2PBattleResult: vi.fn(),
    });

    (useMultiplayer as any).mockReturnValue({
      sendToPeer: mockSendToPeer,
      localPlayerId: mockLocalPlayerId,
    });
  });

  it('should respond to a P2P_SPY_REQUEST with correct player data', () => {
    // Renderizar el hook para activar los listeners del eventBus
    renderHook(() => useP2PGameSync());

    const spyRequest: P2PSpyRequest & { _senderPeerId: string } = {
      type: 'P2P_SPY_REQUEST',
      spyId: 'spy-999',
      attackerId: 'attacker-456',
      attackerName: 'Attacker Player',
      targetId: mockLocalPlayerId,
      timestamp: Date.now(),
      _senderPeerId: 'peer-abc',
    };

    // Simular recepción de solicitud de espionaje vía eventBus
    gameEventBus.emit('P2P_SPY_REQUEST' as any, spyRequest);

    // Verificar que se envió una respuesta al peer correcto
    expect(mockSendToPeer).toHaveBeenCalledTimes(1);
    const [targetPeerId, action] = mockSendToPeer.mock.calls[0];

    expect(targetPeerId).toBe('peer-abc');
    expect(action.type).toBe('P2P_SPY_RESPONSE');
    
    const payload = action.payload;
    expect(payload.spyId).toBe('spy-999');
    expect(payload.targetName).toBe('Test Player');
    expect(payload.targetScore).toBe(1000);
    
    // Verificar que los datos del reporte coinciden con el estado del jugador
    expect(payload.units[UnitType.CYBER_MARINE]).toBe(50);
    expect(payload.resources[ResourceType.MONEY]).toBe(5000);
    expect(payload.buildings[BuildingType.HOUSE]).toBe(5);
  });
});
