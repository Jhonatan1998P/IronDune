/**
 * HARD RESET — Script local de reconstrucción total de la base de datos.
 * ⚠️ ADVERTENCIA: Este script depende de server/db/setup.sql.
 * Si cambias la estructura de las tablas, hazlo en setup.sql.
 *
 * Lee server/db/setup.sql y lo ejecuta contra Supabase vía DATABASE_URL.
 * Borra TODO y reconstruye desde cero: tablas, permisos, funciones, triggers.
 *
 * Uso (desde la raíz del proyecto):
 *   npm run db:reset --prefix server
 *
 * O directamente:
 *   node server/scripts/hardReset.js
 */

import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Cargar .env desde la raíz del servidor y también desde la raíz del proyecto
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL;
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!connectionString) {
  console.error('❌ Error: DATABASE_URL no definida en las variables de entorno.');
  process.exit(1);
}

const sql = postgres(connectionString);
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function hardReset() {
  try {
    console.log('');
    console.log('⚠️  IRON DUNE — HARD RESET DE BASE DE DATOS');
    console.log('   Esto borrará TODOS los datos y reconstruirá el esquema.');
    console.log('');

    // 1. Ejecutar SQL de reconstrucción
    const sqlPath = path.join(__dirname, '../db/setup.sql');
    if (!fs.existsSync(sqlPath)) {
      console.error(`❌ No se encontró el archivo SQL en: ${sqlPath}`);
      process.exit(1);
    }
    const query = fs.readFileSync(sqlPath, 'utf8');
    console.log('🔄 Ejecutando setup.sql...');
    await sql.unsafe(query);

    // 2. Borrar todos los usuarios de Auth (opcional pero recomendado para hard reset total)
    console.log('👥 Limpiando usuarios de Supabase Auth...');
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;

    if (users && users.length > 0) {
      console.log(`   Borrando ${users.length} usuarios...`);
      for (const user of users) {
        await supabase.auth.admin.deleteUser(user.id);
      }
    }

    console.log('✅ Hard reset completado. Base de datos y Auth limpios.');

    // 3. Sembrar Bots y Mercado
    console.log('🤖 Sembrando bots y mercado inicial...');
    
    // Bots (Uso SQL directo para rapidez)
    const PERSONALITIES = ['WARLORD', 'TURTLE', 'TYCOON', 'ROGUE'];
    const COUNTRIES = ['US', 'GB', 'DE', 'FR', 'ES', 'BR', 'CN', 'KR', 'JP', 'RU'];
    const BOT_NAME_PREFIXES = ['Night', 'Dark', 'Iron', 'Steel', 'Shadow', 'Ghost', 'Cyber', 'Neo'];
    const BOT_NAME_ROOTS = ['Wolf', 'Hawk', 'Fox', 'Viper', 'Cobra', 'Raven', 'Tiger', 'Lion'];
    
    const bots = [];
    for (let i = 0; i < 50; i++) {
      const dominionScore = 1000 * Math.pow(1.05, i);
      bots.push({
        name: `${BOT_NAME_PREFIXES[i % 8]}_${BOT_NAME_ROOTS[Math.floor(Math.random() * 8)]}_${i + 1}`,
        personality: PERSONALITIES[i % 4],
        score: Math.round(dominionScore),
        country: COUNTRIES[i % 10],
        units: JSON.stringify({ CYBER_MARINE: Math.floor(dominionScore / 10), SCOUT_TANK: Math.floor(dominionScore / 50) }),
        stats: JSON.stringify({ DOMINION: Math.round(dominionScore), MILITARY: Math.round(dominionScore * 0.6), ECONOMY: Math.round(dominionScore * 12) })
      });
    }
    await sql`INSERT INTO public.bots ${sql(bots, 'name', 'personality', 'score', 'country', 'units', 'stats')}`;

    // Mercado
    const INITIAL_MARKET = [
      { resource_type: 'OIL', base_price: 2.5, current_price: 2.5 },
      { resource_type: 'AMMO', base_price: 1.5, current_price: 1.5 },
      { resource_type: 'GOLD', base_price: 15.0, current_price: 15.0 },
      { resource_type: 'DIAMOND', base_price: 500.0, current_price: 500.0 }
    ];
    await supabase.from('global_market').upsert(INITIAL_MARKET);

    console.log('✅ Datos iniciales sembrados con éxito.');
    console.log('');

    console.log('   Próximos pasos opcionales:');
    console.log('   - npm run seed:bots --prefix server   → poblar bots globales');
    console.log('   - npm run db:seed-market --prefix server → poblar mercado global');
    console.log('');
  } catch (err) {
    console.error('');
    console.error('❌ Error durante el hard reset:');
    console.error('  ', err.message);
    if (err.detail) console.error('   Detail:', err.detail);
    if (err.hint)   console.error('   Hint:  ', err.hint);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

hardReset();
