import { supabase } from '../lib/supabase.js';
import { processServerEconomyTick } from './economyTick.js';
import { getOrCreatePlayerResources } from './resourceValidator.js';

const TICK_INTERVAL_MS = 15000;
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;
const PROFILE_SYNC_INTERVAL_MS = 60 * 1000;

let syncCounter = 0;

const toIso = (timestamp) => new Date(timestamp).toISOString();

export function startProductionLoop() {
  console.log('[ProductionLoop] Starting server economy engine (15s interval)...');
  setInterval(processAllActivePlayers, TICK_INTERVAL_MS);
}

async function processAllActivePlayers() {
  const now = Date.now();
  const staleIso = toIso(now - ACTIVE_WINDOW_MS);

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, game_state, updated_at')
    .gte('updated_at', staleIso)
    .limit(200);

  if (error) {
    console.error('[ProductionLoop] Failed to fetch active profiles:', error.message);
    return;
  }

  if (!profiles || profiles.length === 0) return;

  const ids = profiles.map((profile) => profile.id);
  const { data: resourceRows, error: resourceError } = await supabase
    .from('player_resources')
    .select('*')
    .in('player_id', ids);

  if (resourceError) {
    console.error('[ProductionLoop] Failed to fetch player_resources:', resourceError.message);
    return;
  }

  const resourceMap = new Map((resourceRows || []).map((row) => [row.player_id, row]));
  const upserts = [];
  const profileUpdates = [];

  for (const profile of profiles) {
    try {
      const gameState = profile.game_state || {};
      const resourceRow = resourceMap.get(profile.id) || await getOrCreatePlayerResources(profile.id);
      const lastTickAt = resourceRow?.last_tick_at ? Date.parse(resourceRow.last_tick_at) : now;
      const deltaTimeMs = Math.max(0, now - (Number.isFinite(lastTickAt) ? lastTickAt : now));

      const result = processServerEconomyTick(gameState, resourceRow, deltaTimeMs, now);

      upserts.push({
        player_id: profile.id,
        money: result.resources.MONEY,
        oil: result.resources.OIL,
        ammo: result.resources.AMMO,
        gold: result.resources.GOLD,
        diamond: result.resources.DIAMOND,
        money_rate: result.rates.money_rate,
        oil_rate: result.rates.oil_rate,
        ammo_rate: result.rates.ammo_rate,
        gold_rate: result.rates.gold_rate,
        diamond_rate: result.rates.diamond_rate,
        money_max: result.maxStorage.money_max,
        oil_max: result.maxStorage.oil_max,
        ammo_max: result.maxStorage.ammo_max,
        gold_max: result.maxStorage.gold_max,
        diamond_max: result.maxStorage.diamond_max,
        bank_balance: result.bankBalance,
        interest_rate: result.interestRate,
        next_rate_change: result.nextRateChange,
        last_tick_at: new Date(now).toISOString(),
        updated_at: new Date().toISOString(),
      });

      const shouldSyncProfile = (syncCounter % (PROFILE_SYNC_INTERVAL_MS / TICK_INTERVAL_MS)) === 0;
      if (shouldSyncProfile) {
        profileUpdates.push({
          id: profile.id,
          game_state: {
            ...gameState,
            resources: result.resources,
            maxResources: {
              MONEY: result.maxStorage.money_max,
              OIL: result.maxStorage.oil_max,
              AMMO: result.maxStorage.ammo_max,
              GOLD: result.maxStorage.gold_max,
              DIAMOND: result.maxStorage.diamond_max,
            },
            bankBalance: result.bankBalance,
            currentInterestRate: result.interestRate,
            nextRateChangeTime: result.nextRateChange,
            marketOffers: result.marketOffers,
            activeMarketEvent: result.activeMarketEvent,
            marketNextRefreshTime: result.marketNextRefreshTime,
            lifetimeStats: {
              ...(gameState.lifetimeStats || {}),
              resourcesMined: result.lifetimeResourcesMined,
            },
          },
          updated_at: new Date().toISOString(),
        });
      }
    } catch (profileError) {
      console.error(`[ProductionLoop] Failed to process profile ${profile.id}:`, profileError.message || profileError);
    }
  }

  if (upserts.length > 0) {
    const { error: upsertError } = await supabase
      .from('player_resources')
      .upsert(upserts, { onConflict: 'player_id' });

    if (upsertError) {
      console.error('[ProductionLoop] Failed to upsert player_resources:', upsertError.message);
    }
  }

  if (profileUpdates.length > 0) {
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .upsert(profileUpdates, { onConflict: 'id' });
    if (profileUpdateError) {
      console.error('[ProductionLoop] Failed to sync resources to profiles:', profileUpdateError.message);
    }
  }

  syncCounter += 1;
}
