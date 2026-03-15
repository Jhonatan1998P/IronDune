import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runHardReset() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL is required for DB_HARD_RESET');
    return;
  }

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false } // Requerido por Supabase/Render
  });

  try {
    console.log('🚀 Iniciando DB_HARD_RESET total...');
    await client.connect();

    // 1. Borrar tablas existentes en orden inverso de dependencias
    console.log('🗑️  Limpiando base de datos...');
    const dropTablesSql = `
      DROP TABLE IF EXISTS audit_logs CASCADE;
      DROP TABLE IF EXISTS idempotency_keys CASCADE;
      DROP TABLE IF EXISTS leaderboard_snapshots CASCADE;
      DROP TABLE IF EXISTS player_points CASCADE;
      DROP TABLE IF EXISTS event_outbox CASCADE;
      DROP TABLE IF EXISTS game_events CASCADE;
      DROP TABLE IF EXISTS fleet_movements CASCADE;
      DROP TABLE IF EXISTS shipyard_queue CASCADE;
      DROP TABLE IF EXISTS building_queue CASCADE;
      DROP TABLE IF EXISTS player_research CASCADE;
      DROP TABLE IF EXISTS planet_buildings CASCADE;
      DROP TABLE IF EXISTS planet_snapshots CASCADE;
      DROP TABLE IF EXISTS planets CASCADE;
      DROP TABLE IF EXISTS player_profiles CASCADE;
      DROP TABLE IF EXISTS players CASCADE;
      DROP TABLE IF EXISTS worlds CASCADE;
      
      -- Resetear esquema AUTH (¡PELIGRO: Esto borra todos los usuarios!)
      -- TRUNCATE auth.users CASCADE; -- Menos destructivo que borrar el esquema
    `;
    await client.query(dropTablesSql);

    // 2. Cargar y ejecutar migraciones en orden
    const migrationFiles = [
      '20260315_initial_schema.sql',
      '20260315_atomic_functions.sql',
      '20260315_worker_functions.sql',
      '20260315_ranking_functions.sql'
    ];

    const migrationsDir = path.resolve(__dirname, '../../migrations');

    for (const file of migrationFiles) {
      console.log(`📜 Ejecutando migración: ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(sql);
    }

    console.log('✅ DB_HARD_RESET completado con éxito.');
  } catch (error) {
    console.error('❌ Error durante el Hard Reset:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Permitir ejecución directa si se llama con tsx
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runHardReset();
}
