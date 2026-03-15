import { supabase } from './lib/supabase.js';

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
        game_state jsonb NOT NULL,
        updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
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
      ALTER TABLE public.logistic_loot ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.game_bots ENABLE ROW LEVEL SECURITY;

      -- 6. Políticas para 'profiles'
      CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
      CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
      CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
      CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE USING (auth.uid() = id);

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
      GRANT ALL ON TABLE public.logistic_loot TO postgres, service_role;
      GRANT ALL ON TABLE public.game_bots TO postgres, service_role;
      
      GRANT SELECT ON TABLE public.profiles TO anon, authenticated;
      GRANT SELECT ON TABLE public.logistic_loot TO anon, authenticated;
      GRANT SELECT ON TABLE public.game_bots TO anon, authenticated;
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
