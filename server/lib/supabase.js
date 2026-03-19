import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { observeSupabaseHttpCall } from './trafficMetrics.js';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[Server] SUPABASE_SERVICE_ROLE_KEY missing. Auth reset will be disabled.');
}

const defaultFetch = globalThis.fetch?.bind(globalThis);

const instrumentedFetch = async (input, init = {}) => {
  if (!defaultFetch) {
    throw new Error('Global fetch is not available in this runtime');
  }

  const startedAt = Date.now();
  const method = typeof init?.method === 'string' ? init.method : 'GET';
  const url = typeof input === 'string' ? input : (input?.url || String(input || ''));

  try {
    const response = await defaultFetch(input, init);
    observeSupabaseHttpCall({
      method,
      url,
      statusCode: response?.status || 0,
      durationMs: Date.now() - startedAt,
      failed: !response?.ok,
    });
    return response;
  } catch (error) {
    observeSupabaseHttpCall({
      method,
      url,
      statusCode: 0,
      durationMs: Date.now() - startedAt,
      failed: true,
    });
    throw error;
  }
};

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  global: {
    fetch: instrumentedFetch,
  },
});
