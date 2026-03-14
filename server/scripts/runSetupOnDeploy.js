/**
 * RUN SETUP ON DEPLOY — Ejecuta el hard reset SOLO si DB_HARD_RESET=true.
 *
 * Se llama desde index.js al arrancar el servidor en Render.
 * La condición estricta es: la variable de entorno DB_HARD_RESET debe ser
 * exactamente el string "true". Después del deploy, elimina esa variable
 * en Render para que NO se ejecute en el próximo deploy.
 *
 * Flujo de uso en Render:
 *   1. Ve a Environment Variables en el servicio de Render.
 *   2. Agrega: DB_HARD_RESET = true
 *   3. Haz deploy manual (o push).
 *   4. Cuando arranque, el server ejecutará setup.sql automáticamente.
 *   5. Elimina DB_HARD_RESET de las variables de Render para futuros deploys.
 */

import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runSetupOnDeploy() {
  // Condición estricta: solo si DB_HARD_RESET es exactamente "true"
  if (process.env.DB_HARD_RESET !== 'true') {
    return; // deploy normal, no hacer nada
  }

  const connectionString = process.env.DATABASE_URL;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!connectionString || !supabaseUrl || !supabaseServiceKey) {
    console.error('[Deploy] ❌ DB_HARD_RESET=true pero faltan variables de entorno (DATABASE_URL, SUPABASE_URL o SERVICE_KEY). Abortando reset.');
    return;
  }

  console.log('[Deploy] ⚠️  DB_HARD_RESET=true detectado — iniciando hard reset total...');

  const sql = postgres(connectionString);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const sqlPath = path.join(__dirname, '../db/setup.sql');

    if (!fs.existsSync(sqlPath)) {
      console.error(`[Deploy] ❌ No se encontró setup.sql en: ${sqlPath}`);
      return;
    }

    const query = fs.readFileSync(sqlPath, 'utf8');

    // 1. Reset SQL
    console.log('[Deploy] 🔄 Ejecutando setup.sql...');
    await sql.unsafe(query);

    // 2. Limpiar Auth (Usuarios)
    console.log('[Deploy] 👥 Limpiando usuarios de Supabase Auth...');
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (!listError && users && users.length > 0) {
      console.log(`[Deploy]    Borrando ${users.length} usuarios...`);
      for (const user of users) {
        await supabase.auth.admin.deleteUser(user.id);
      }
    }

    console.log('[Deploy] ✅ Hard reset completado. Base de datos y Auth limpios.');
    console.log('[Deploy]    Elimina DB_HARD_RESET de las variables de Render para evitar resets en futuros deploys.');
  } catch (err) {
    // Usamos try/catch con log pero NO detenemos el servidor.
    // El servidor debe seguir levantando aunque el reset falle.
    console.error('[Deploy] ❌ Error durante el hard reset en deploy:');
    console.error('[Deploy]   ', err.message);
    if (err.detail) console.error('[Deploy]    Detail:', err.detail);
    if (err.hint)   console.error('[Deploy]    Hint:  ', err.hint);
  } finally {
    await sql.end();
  }
}
