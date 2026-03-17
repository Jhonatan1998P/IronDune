import { supabase } from './lib/supabase.js';

const ADMIN_USERNAME = 'Admin';
const ADMIN_EMAIL = 'Admin@gmail.com';
const ADMIN_PASSWORD = '26335828JP';
const ADMIN_ROLE = 'Admin';
const DEFAULT_ROLE = 'Usuario';
const PGRST_RELOAD_SQL = "NOTIFY pgrst, 'reload';";

/**
 * Realiza un reinicio total de la base de datos:
 * 1. Borra todos los usuarios de Auth
 * 2. Borra (DROP) todas las tablas públicas
 * 3. Recrea las tablas con su esquema preciso
 * 4. Configura funciones, RLS y permisos
 */
export async function hardResetDatabase() {
  if (process.env.DB_HARD_RESET !== 'true') {
    return;
  }

  console.warn('⚠️ [DB Reset] DB_HARD_RESET=true detectado. Iniciando reinicio TOTAL...');

  try {
    // 1. Primero borramos los usuarios de la autenticación de Supabase
    await deleteAllAuthUsers();

    // 2. Ejecutamos el SQL para limpiar y recrear todo
    // Nota: Necesitamos una función RPC 'exec_sql' en Supabase para ejecutar SQL arbitrario
    const sqlScript = `
      -- 1. Limpieza de tablas existentes
      DROP TABLE IF EXISTS public.logistic_loot CASCADE;
      DROP TABLE IF EXISTS public.game_bots CASCADE;
      DROP TABLE IF EXISTS public.player_resources CASCADE;
      DROP TABLE IF EXISTS public.profiles CASCADE;
      DROP TABLE IF EXISTS public.server_metadata CASCADE;

      -- 1.5 Tabla de metadatos (para control de resets)
      CREATE TABLE public.server_metadata (
        key text PRIMARY KEY,
        value text,
        updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
      );

      -- Insertar el ID del nuevo reset
      INSERT INTO public.server_metadata (key, value) VALUES ('last_reset_id', '${Date.now()}');

      -- 2. Recreación de tabla: profiles
      CREATE TABLE public.profiles (
        id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
        role text NOT NULL DEFAULT '${DEFAULT_ROLE}',
        game_state jsonb NOT NULL,
        updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
      );

      -- 2.2 Recursos autoritativos por jugador
      CREATE TABLE public.player_resources (
        player_id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
        money double precision NOT NULL DEFAULT 5000,
        oil double precision NOT NULL DEFAULT 2500,
        ammo double precision NOT NULL DEFAULT 1500,
        gold double precision NOT NULL DEFAULT 500,
        diamond double precision NOT NULL DEFAULT 5,
        money_rate double precision NOT NULL DEFAULT 0,
        oil_rate double precision NOT NULL DEFAULT 0,
        ammo_rate double precision NOT NULL DEFAULT 0,
        gold_rate double precision NOT NULL DEFAULT 0,
        diamond_rate double precision NOT NULL DEFAULT 0,
        money_max double precision NOT NULL DEFAULT 999999999999999,
        oil_max double precision NOT NULL DEFAULT 999999999999999,
        ammo_max double precision NOT NULL DEFAULT 999999999999999,
        gold_max double precision NOT NULL DEFAULT 999999999999999,
        diamond_max double precision NOT NULL DEFAULT 10,
        bank_balance double precision NOT NULL DEFAULT 0,
        interest_rate double precision NOT NULL DEFAULT 0.15,
        next_rate_change bigint NOT NULL DEFAULT 0,
        last_tick_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      -- 2.5 Habilitar RLS en metadata
      ALTER TABLE public.server_metadata ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Public read access for metadata" ON public.server_metadata FOR SELECT USING (true);
      GRANT SELECT ON TABLE public.server_metadata TO anon, authenticated;
      GRANT ALL ON TABLE public.server_metadata TO postgres, service_role;

      -- 3. Recreación de tabla: logistic_loot
      CREATE TABLE public.logistic_loot (
        id text PRIMARY KEY,
        battle_id text,
        origin text,
        resources jsonb,
        initial_resources jsonb,
        attacker_id text,
        attacker_name text,
        defender_id text,
        defender_name text,
        is_partially_harvested boolean DEFAULT false,
        harvest_count integer DEFAULT 0,
        total_value integer DEFAULT 0,
        expires_at timestamp with time zone,
        war_id text,
        wave_number integer,
        created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
      );

      -- 4. Recreación de tabla: game_bots
      CREATE TABLE public.game_bots (
        id text PRIMARY KEY,
        name text NOT NULL,
        avatar_id integer,
        country text,
        stats jsonb,
        personality text,
        last_rank integer,
        created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
      );

      -- 5. Configuración de RLS (Row Level Security)
      ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.player_resources ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.logistic_loot ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.game_bots ENABLE ROW LEVEL SECURITY;

      -- 6. Políticas para 'profiles' (solo lectura desde cliente)
      CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
      CREATE POLICY "Users read own resources" ON public.player_resources FOR SELECT USING (auth.uid() = player_id);

      -- 7. Políticas para 'logistic_loot' (Acceso público de lectura, escritura protegida si fuera necesario)
      CREATE POLICY "Public read access for logistic_loot" ON public.logistic_loot FOR SELECT USING (true);
      CREATE POLICY "Authenticated insert for logistic_loot" ON public.logistic_loot FOR INSERT WITH CHECK (auth.role() = 'authenticated');
      CREATE POLICY "Authenticated update for logistic_loot" ON public.logistic_loot FOR UPDATE USING (auth.role() = 'authenticated');
      CREATE POLICY "Authenticated delete for logistic_loot" ON public.logistic_loot FOR DELETE USING (auth.role() = 'authenticated');

      -- 8. Políticas para 'game_bots'
      CREATE POLICY "Public read access for game_bots" ON public.game_bots FOR SELECT USING (true);
      CREATE POLICY "Service role full access for game_bots" ON public.game_bots FOR ALL USING (true);

       -- 9. Permisos adicionales
       GRANT ALL ON TABLE public.profiles TO postgres, service_role;
       GRANT ALL ON TABLE public.player_resources TO postgres, service_role;
       GRANT ALL ON TABLE public.logistic_loot TO postgres, service_role;
       GRANT ALL ON TABLE public.game_bots TO postgres, service_role;
      
      GRANT SELECT ON TABLE public.profiles TO authenticated;
      GRANT SELECT ON TABLE public.player_resources TO authenticated;
      GRANT SELECT ON TABLE public.logistic_loot TO anon, authenticated;
       GRANT SELECT ON TABLE public.game_bots TO anon, authenticated;

      ALTER PUBLICATION supabase_realtime ADD TABLE public.player_resources;

       -- 10. Refresh PostgREST schema cache
       ${PGRST_RELOAD_SQL}
     `;

    console.log('[DB Reset] Ejecutando script SQL de recreación...');
    const { error: sqlError } = await supabase.rpc('exec_sql', { sql: sqlScript });

    if (sqlError) {
      if (sqlError.message.includes('function "exec_sql" does not exist')) {
        console.error('❌ [DB Reset] La función RPC "exec_sql" no existe en Supabase.');
        console.info('Para habilitarla, ejecuta este SQL manualmente en el panel de Supabase una vez:');
        console.info(`
          CREATE OR REPLACE FUNCTION exec_sql(sql text)
          RETURNS void
          LANGUAGE plpgsql
          SECURITY DEFINER
          AS $$
          BEGIN
            EXECUTE sql;
          END;
          $$;
        `);
        throw new Error('RPC exec_sql missing');
      }
      throw sqlError;
    }

    await createAdminUserAndProfile();

    console.log('✅ [DB Reset] Reinicio de base de datos completado con éxito.');
  } catch (error) {
    console.error('❌ [DB Reset] Error crítico durante el hard reset:', error.message);
  }
}

async function deleteAllAuthUsers() {
  console.log('[DB Reset] Eliminando todos los usuarios de Auth...');
  
  let allUsers = [];
  let page = 1;
  let hasMore = true;

  try {
    while (hasMore) {
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({
        page: page,
        perPage: 1000
      });

      if (listError) throw listError;

      if (!users || users.length === 0) {
        hasMore = false;
      } else {
        allUsers = allUsers.concat(users);
        page++;
      }
    }

    console.log(`[DB Reset] Encontrados ${allUsers.length} usuarios para eliminar.`);

    for (const user of allUsers) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
      if (deleteError) {
        console.error(`[DB Reset] Error eliminando usuario ${user.id}:`, deleteError.message);
      }
    }
  } catch (error) {
    console.error('[DB Reset] Error al listar/eliminar usuarios:', error.message);
    // No lanzamos error para intentar continuar con la recreación de tablas
  }
}

async function createAdminUserAndProfile() {
  console.log('[DB Reset] Creando cuenta admin...');

  try {
    const { data: adminData, error: adminError } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: {
        username: ADMIN_USERNAME
      },
      app_metadata: {
        role: ADMIN_ROLE
      }
    });

    if (adminError) {
      console.error('[DB Reset] Error creando usuario admin:', adminError.message);
      return;
    }

    const adminUserId = adminData?.user?.id;
    if (!adminUserId) {
      console.error('[DB Reset] No se pudo obtener el ID del usuario admin.');
      return;
    }

    const { data: metaData, error: metaError } = await supabase
      .from('server_metadata')
      .select('value')
      .eq('key', 'last_reset_id')
      .single();

    if (metaError) {
      console.warn('[DB Reset] No se pudo obtener last_reset_id:', metaError.message);
    }

    const adminGameState = {
      playerName: ADMIN_USERNAME,
      lastResetId: metaData?.value,
      lastSaveTime: Date.now()
    };

    const adminGameStateJson = JSON.stringify(adminGameState).replace(/'/g, "''");
    const adminUpdatedAt = new Date().toISOString();
    const profileSql = `
      INSERT INTO public.profiles (id, role, game_state, updated_at)
      VALUES ('${adminUserId}', '${ADMIN_ROLE}', '${adminGameStateJson}'::jsonb, '${adminUpdatedAt}')
      ON CONFLICT (id)
      DO UPDATE SET role = EXCLUDED.role, game_state = EXCLUDED.game_state, updated_at = EXCLUDED.updated_at;
    `;

    const resourcesSql = `
      INSERT INTO public.player_resources (
        player_id, money, oil, ammo, gold, diamond,
        bank_balance, interest_rate, next_rate_change, last_tick_at, updated_at
      )
      VALUES (
        '${adminUserId}', 5000, 2500, 1500, 500, 5,
        0, 0.15, ${Date.now() + (24 * 60 * 60 * 1000)}, now(), now()
      )
      ON CONFLICT (player_id) DO NOTHING;
    `;

    const { error: profileSqlError } = await supabase.rpc('exec_sql', { sql: profileSql });

    if (profileSqlError) {
      console.error('[DB Reset] Error creando perfil admin:', profileSqlError.message);
      return;
    }

    const { error: resourcesSqlError } = await supabase.rpc('exec_sql', { sql: resourcesSql });
    if (resourcesSqlError) {
      console.error('[DB Reset] Error creando recursos admin:', resourcesSqlError.message);
      return;
    }

    console.log('[DB Reset] Cuenta admin creada con perfil de juego.');
  } catch (error) {
    console.error('[DB Reset] Error inesperado creando cuenta admin:', error.message);
  }
}
