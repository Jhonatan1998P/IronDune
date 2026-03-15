
import { BuildingType, UnitType, TechType, ResourceType } from '../../types';

const API_URL = (import.meta as any).env?.VITE_SOCKET_SERVER_URL || 'http://localhost:10000';

export const gameService = {
  async build(userId: string, buildingType: BuildingType, amount: number = 1) {
    const response = await fetch(`${API_URL}/api/game/build`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, buildingType, amount })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to build');
    }
    return response.json();
  },

  async recruit(userId: string, unitType: UnitType, amount: number) {
    const response = await fetch(`${API_URL}/api/game/recruit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, unitType, amount })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to recruit');
    }
    return response.json();
  },

  async research(userId: string, techType: TechType) {
    const response = await fetch(`${API_URL}/api/game/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, techType })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to research');
    }
    return response.json();
  },

  async handleBankTransaction(userId: string, amount: number, type: 'deposit' | 'withdraw') {
    const response = await fetch(`${API_URL}/api/game/bank-transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, amount, type })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to process bank transaction');
    }
    return response.json();
  },

  async repair(userId: string, buildingType: BuildingType) {
    const response = await fetch(`${API_URL}/api/game/repair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, buildingType })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to repair');
    }
    return response.json();
  },

  async handleDiamondExchange(userId: string, targetResource: ResourceType, amount: number) {
    const response = await fetch(`${API_URL}/api/game/diamond-exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, targetResource, amount })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to exchange diamonds');
    }
    return response.json();
  },

  async startMission(params: {
    userId: string;
    targetId: string;
    type: string;
    units: Partial<Record<UnitType, number>>;
    resources?: Partial<Record<ResourceType, number>>;
    travelTime?: number;
  }) {
    const response = await fetch(`${API_URL}/api/game/start-mission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to start mission');
    }
    return response.json();
  }
};
