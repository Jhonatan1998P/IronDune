import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  console.error('[SecurityAudit] Missing SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const anonClient = createClient(supabaseUrl, supabaseAnonKey);
const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

const expectDenied = async (label, operation) => {
  const { error } = await operation();
  if (!error) {
    throw new Error(`${label} unexpectedly succeeded`);
  }
  console.log('[SecurityAudit] OK denied', { label, code: error.code || null, message: error.message || null });
};

const run = async () => {
  const email = `security-audit-${Date.now()}-${randomUUID().slice(0, 8)}@example.com`;
  const password = `S3curity!${randomUUID().slice(0, 8)}`;

  const signUp = await anonClient.auth.signUp({ email, password });
  if (signUp.error || !signUp.data.user?.id) {
    throw new Error(`Failed to create audit user: ${signUp.error?.message || 'unknown_error'}`);
  }

  const userId = signUp.data.user.id;
  await adminClient.auth.admin.updateUserById(userId, { email_confirm: true });

  const signIn = await anonClient.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.session?.access_token) {
    throw new Error(`Failed to sign in audit user: ${signIn.error?.message || 'unknown_error'}`);
  }

  const authedClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${signIn.data.session.access_token}`,
      },
    },
  });

  try {
    await expectDenied('direct profile write', () => authedClient.from('profiles').upsert({
      id: userId,
      game_state: { insecure: true },
      updated_at: new Date().toISOString(),
    }));

    await expectDenied('direct player_buildings write', () => authedClient.from('player_buildings').upsert({
      player_id: userId,
      building_type: 'HOUSE',
      level: 99,
      is_damaged: false,
    }));

    await expectDenied('direct player_units write', () => authedClient.from('player_units').upsert({
      player_id: userId,
      unit_type: 'CYBER_MARINE',
      count: 999,
    }));

    await expectDenied('direct player_tech write', () => authedClient.from('player_tech').upsert({
      player_id: userId,
      tech_type: 'BASIC_TRAINING',
      level: 10,
    }));

    await expectDenied('direct player_progress write', () => authedClient.from('player_progress').upsert({
      player_id: userId,
      campaign_progress: 99,
      empire_points: 999999,
      last_save_time: Date.now(),
    }));

    await expectDenied('direct player_commands write', () => authedClient.from('player_commands').insert({
      player_id: userId,
      command_id: randomUUID(),
      command_type: 'BANK_WITHDRAW',
      expected_revision: 0,
      payload: { gains: { MONEY: 10 } },
      response_payload: {},
    }));

    console.log('[SecurityAudit] PASS - RLS and service-role boundaries validated for normalized domain');
  } finally {
    await adminClient.auth.admin.deleteUser(userId);
  }
};

run().catch((error) => {
  console.error('[SecurityAudit] FAIL', error);
  process.exitCode = 1;
});
