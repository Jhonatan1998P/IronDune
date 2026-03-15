
import { ResourceType } from '../types';

type ResourceData = Record<ResourceType, number>;
type Listener = (data: ResourceData) => void;

class ResourceStore {
    private resources: ResourceData = {
        [ResourceType.MONEY]: 0,
        [ResourceType.OIL]: 0,
        [ResourceType.AMMO]: 0,
        [ResourceType.GOLD]: 0,
        [ResourceType.DIAMOND]: 0,
    };
    private rates: ResourceData = {
        [ResourceType.MONEY]: 0,
        [ResourceType.OIL]: 0,
        [ResourceType.AMMO]: 0,
        [ResourceType.GOLD]: 0,
        [ResourceType.DIAMOND]: 0,
    };
    private listeners: Set<Listener> = new Set();
    private lastServerTime: number = Date.now();
    private localTimeAtSync: number = Date.now();
    private serverResources: ResourceData = { ...this.resources };

    subscribe(listener: Listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    updateFromServer(resources: ResourceData, rates: ResourceData, serverTime: number) {
        this.serverResources = { ...resources };
        this.rates = { ...rates };
        this.lastServerTime = serverTime;
        this.localTimeAtSync = Date.now();
        this.interpolate();
    }

    getServerTime() {
        const localDelta = Date.now() - this.localTimeAtSync;
        return this.lastServerTime + localDelta;
    }

    interpolate() {
        const now = this.getServerTime();
        const deltaSeconds = (now - this.lastServerTime) / 1000;

        this.resources = {
            [ResourceType.MONEY]: this.serverResources[ResourceType.MONEY] + (this.rates[ResourceType.MONEY] * deltaSeconds),
            [ResourceType.OIL]: this.serverResources[ResourceType.OIL] + (this.rates[ResourceType.OIL] * deltaSeconds),
            [ResourceType.AMMO]: this.serverResources[ResourceType.AMMO] + (this.rates[ResourceType.AMMO] * deltaSeconds),
            [ResourceType.GOLD]: this.serverResources[ResourceType.GOLD] + (this.rates[ResourceType.GOLD] * deltaSeconds),
            [ResourceType.DIAMOND]: this.serverResources[ResourceType.DIAMOND] + (this.rates[ResourceType.DIAMOND] * deltaSeconds),
        };

        this.notify();
    }

    private notify() {
        this.listeners.forEach(listener => listener(this.resources));
    }

    getState() {
        return this.resources;
    }

    getRates() {
        return this.rates;
    }
}

export const resourceStore = new ResourceStore();
