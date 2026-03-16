import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { INITIAL_GAME_STATE } from '../data/initialState';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const missingEnv = [
  !supabaseUrl ? 'SUPABASE_URL or VITE_SUPABASE_URL' : null,
  !supabaseAnonKey ? 'SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY' : null,
  !supabaseServiceRoleKey ? 'SUPABASE_SERVICE_ROLE_KEY' : null
].filter(Boolean);

const hasEnv = missingEnv.length === 0;

const describeIf = hasEnv ? describe : describe.skip;

const cloneGameState = () => {
  if (typeof structuredClone === 'function') {
    return structuredClone(INITIAL_GAME_STATE);
  }
  return JSON.parse(JSON.stringify(INITIAL_GAME_STATE));
};

const waitForHealth = async (baseUrl: string) => {
  const maxAttempts = 30;
  const delayMs = 500;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch (error) {
      // ignore and retry
    }
    await delay(delayMs);
  }

  throw new Error('Server did not become healthy in time');
};

describeIf.sequential('Supabase auth and save integration', () => {
  const port = Number(process.env.TEST_SERVER_PORT || 10001);
  const baseUrl = process.env.TEST_SERVER_URL || `http://127.0.0.1:${port}`;
  const shouldSpawnServer = !process.env.TEST_SERVER_URL;

  let supabaseAnon: ReturnType<typeof createClient> | null = null;
  let supabaseAdmin: ReturnType<typeof createClient> | null = null;

  let serverProcess: ReturnType<typeof spawn> | null = null;
  let testEmail = '';
  let testPassword = '';
  let testUserId: string | null = null;
  let accessToken: string | null = null;

  beforeAll(async () => {
    if (!hasEnv) {
      if (missingEnv.length > 0) {
        console.warn(`[IntegrationTest] Missing env: ${missingEnv.join(', ')}`);
      }
      return;
    }

    supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    if (shouldSpawnServer) {
      serverProcess = spawn('node', ['server/index.js'], {
        env: {
          ...process.env,
          PORT: String(port),
          DISABLE_SCHEDULER: 'true'
        },
        stdio: 'pipe'
      });

      const output = { stdout: '', stderr: '' };
      serverProcess.stdout?.on('data', (data) => {
        output.stdout += data.toString();
      });
      serverProcess.stderr?.on('data', (data) => {
        output.stderr += data.toString();
      });

      try {
        await waitForHealth(baseUrl);
      } catch (error) {
        const logSnippet = [
          output.stdout ? `STDOUT:\n${output.stdout}` : null,
          output.stderr ? `STDERR:\n${output.stderr}` : null
        ].filter(Boolean).join('\n');

        throw new Error(`${error.message}\n${logSnippet}`.trim());
      }
    }
  }, 30000);

  afterAll(async () => {
    if (testUserId && supabaseAdmin) {
      await supabaseAdmin.auth.admin.deleteUser(testUserId);
    }

    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
  });

  it('registers user and signs in', async () => {
    testEmail = `integration_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`;
    testPassword = `TestPass${Math.floor(Math.random() * 10000)}1!A`;

    if (!supabaseAnon || !supabaseAdmin) {
      throw new Error('Supabase clients not initialized');
    }

    const { data: signUpData, error: signUpError } = await supabaseAnon.auth.signUp({
      email: testEmail,
      password: testPassword
    });

    expect(signUpError).toBeNull();
    expect(signUpData.user?.id).toBeTruthy();

    if (!signUpData.user?.id) {
      throw new Error('No user id returned from signUp');
    }

    testUserId = signUpData.user.id;

    await supabaseAdmin.auth.admin.updateUserById(testUserId, { email_confirm: true });

    const { data: signInData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    expect(signInError).toBeNull();
    expect(signInData.session?.access_token).toBeTruthy();

    accessToken = signInData.session?.access_token || null;
  });

  it('blocks direct client writes to profiles (RLS)', async () => {
    if (!testUserId) {
      throw new Error('Missing test user id');
    }

    if (!supabaseAnon) {
      throw new Error('Supabase client not initialized');
    }

    const { error } = await supabaseAnon
      .from('profiles')
      .upsert({
        id: testUserId,
        game_state: { test: true },
        updated_at: new Date().toISOString()
      });

    expect(error).toBeTruthy();
  });

  it('saves and loads profile through server API', async () => {
    if (!accessToken) {
      throw new Error('Missing access token');
    }

    const stateToSave = cloneGameState();
    stateToSave.playerName = 'Integration Commander';
    stateToSave.lastSaveTime = Date.now();

    const saveResponse = await fetch(`${baseUrl}/api/profile/save`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ game_state: stateToSave })
    });

    expect(saveResponse.ok).toBe(true);

    const loadResponse = await fetch(`${baseUrl}/api/profile`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    expect(loadResponse.ok).toBe(true);

    const payload = await loadResponse.json();
    expect(payload.game_state?.playerName).toBe('Integration Commander');
  });
});
