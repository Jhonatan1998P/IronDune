import { supabase } from '../lib/supabase.js';
import { ResourceType } from './enums.js';

const RESOURCE_COLUMN_MAP = {
  [ResourceType.MONEY]: 'money',
  [ResourceType.OIL]: 'oil',
  [ResourceType.AMMO]: 'ammo',
  [ResourceType.GOLD]: 'gold',
  [ResourceType.DIAMOND]: 'diamond',
};

const normalizeAmountMap = (input = {}) => {
  const normalized = {};
  Object.entries(input).forEach(([resource, rawValue]) => {
    const value = Number(rawValue);
    if (!Number.isFinite(value) || value <= 0) return;
    if (!RESOURCE_COLUMN_MAP[resource]) return;
    normalized[resource] = value;
  });
  return normalized;
};

const createDefaultRow = (playerId) => ({
  player_id: playerId,
  money: 5000,
  oil: 2500,
  ammo: 1500,
  gold: 500,
  diamond: 5,
  money_rate: 0,
  oil_rate: 0,
  ammo_rate: 0,
  gold_rate: 0,
  diamond_rate: 0,
  money_max: 999999999999999,
  oil_max: 999999999999999,
  ammo_max: 999999999999999,
  gold_max: 999999999999999,
  diamond_max: 10,
  bank_balance: 0,
  interest_rate: 0.15,
  next_rate_change: Date.now() + (24 * 60 * 60 * 1000),
  last_tick_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

export async function getOrCreatePlayerResources(playerId) {
  const { data, error } = await supabase
    .from('player_resources')
    .select('*')
    .eq('player_id', playerId)
    .single();

  if (!error && data) {
    return data;
  }

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('player_resources')
    .upsert(createDefaultRow(playerId), { onConflict: 'player_id' })
    .select('*')
    .single();

  if (insertError) throw insertError;
  return inserted;
}

export async function validateResourceDeduction(playerId, costs = {}) {
  const normalizedCosts = normalizeAmountMap(costs);
  if (Object.keys(normalizedCosts).length === 0) {
    return { ok: true, reason: 'no_cost', resources: await getOrCreatePlayerResources(playerId) };
  }

  const row = await getOrCreatePlayerResources(playerId);
  const updatePayload = {};

  for (const [resource, cost] of Object.entries(normalizedCosts)) {
    const column = RESOURCE_COLUMN_MAP[resource];
    const current = Number(row[column] || 0);
    if (current < cost) {
      return { ok: false, reason: 'insufficient_funds', resource, available: current, required: cost };
    }
    updatePayload[column] = current - cost;
  }

  updatePayload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('player_resources')
    .update(updatePayload)
    .eq('player_id', playerId)
    .select('*')
    .single();

  if (error) throw error;
  return { ok: true, resources: data };
}

export async function addResources(playerId, gains = {}) {
  const normalizedGains = normalizeAmountMap(gains);
  if (Object.keys(normalizedGains).length === 0) {
    return { ok: true, reason: 'no_gain', resources: await getOrCreatePlayerResources(playerId) };
  }

  const row = await getOrCreatePlayerResources(playerId);
  const updatePayload = {};

  Object.entries(normalizedGains).forEach(([resource, gain]) => {
    const column = RESOURCE_COLUMN_MAP[resource];
    const maxColumn = `${column}_max`;
    const current = Number(row[column] || 0);
    const max = Number(row[maxColumn] || Number.MAX_SAFE_INTEGER);
    updatePayload[column] = Math.min(max, current + gain);
  });

  updatePayload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('player_resources')
    .update(updatePayload)
    .eq('player_id', playerId)
    .select('*')
    .single();

  if (error) throw error;
  return { ok: true, resources: data };
}
