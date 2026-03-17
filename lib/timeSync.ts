
import { buildBackendUrl } from './backend';

let timeOffset = 0;
let isSynced = false;
let lastPerformanceTime = performance.now();
let lastDateNow = Date.now();

const CLOCK_JUMP_THRESHOLD_MS = 2000; // 2 seconds

export const TimeSyncService = {
    async sync() {
        try {
            const startFetch = performance.now();
            const response = await fetch(buildBackendUrl('/api/time'));
            if (!response.ok) throw new Error('Failed to fetch server time');
            const { serverTime } = await response.json();
            const endFetch = performance.now();
            
            // Adjust for network latency (assume symmetric latency)
            const latency = (endFetch - startFetch) / 2;
            const localTimeAtFetch = Date.now() - latency;
            
            timeOffset = serverTime - localTimeAtFetch;
            isSynced = true;
            // lastSyncTime = Date.now(); // Removed unused
            lastPerformanceTime = performance.now();
            lastDateNow = Date.now();
            
            console.log(`[TimeSync] Synced. Offset: \${timeOffset}ms, Latency: \${latency}ms`);
        } catch (error) {
            console.warn('[TimeSync] Sync failed, using local time:', error);
            timeOffset = 0;
            isSynced = false;
        }
    },

    getServerTime(): number {
        this.detectClockJump();
        return Date.now() + timeOffset;
    },

    detectClockJump(): boolean {
        const currentPerformanceTime = performance.now();
        const currentDateNow = Date.now();
        
        const perfDelta = currentPerformanceTime - lastPerformanceTime;
        const dateDelta = currentDateNow - lastDateNow;
        
        const drift = Math.abs(dateDelta - perfDelta);
        
        if (drift > CLOCK_JUMP_THRESHOLD_MS) {
            console.warn(`[TimeSync] Clock jump detected! Drift: \${drift}ms`);
            // Update last values to prevent continuous triggers
            lastPerformanceTime = currentPerformanceTime;
            lastDateNow = currentDateNow;
            
            // Trigger re-sync in background
            this.sync();
            return true;
        }
        
        lastPerformanceTime = currentPerformanceTime;
        lastDateNow = currentDateNow;
        return false;
    },

    isSynced() {
        return isSynced;
    }
};
