// Tipos de dominio para Iron Dune Operations

export enum ResourceType {
    MONEY = 'money',
    OIL = 'oil',
    AMMO = 'ammo',
    GOLD = 'gold',
    DIAMOND = 'diamond'
}

export type Resources = Record<ResourceType, bigint>;

export interface PlanetSnapshot {
    lastUpdateAt: Date;
    resources: Resources;
    productionRates: Resources; // Por segundo
    version: number;
}

export interface BuildingQueueItem {
    id: string;
    buildingId: string;
    targetLevel: number;
    startedAt: Date;
    finishedAt: Date;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

export interface PlanetState {
    buildings: Record<string, number>;
    research: Record<string, number>;
    queue: BuildingQueueItem[];
}
