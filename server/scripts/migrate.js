import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ Error: DATABASE_URL no definida en las variables de entorno.");
  console.log("Obtenla en: Supabase Dashboard -> Settings -> Database -> Connection String (URI)");
  process.exit(1);
}

const sql = postgres(connectionString);

async function migrate() {
  try {
    console.log("🚀 Iniciando sincronización de base de datos...");
    const sqlPath = path.join(__dirname, '../db/setup.sql');
    const query = fs.readFileSync(sqlPath, 'utf8');

    // Ejecutar todo el bloque SQL
    await sql.unsafe(query);
    
    console.log("✅ Base de datos sincronizada correctamente (Tablas, Roles y RLS).");
  } catch (err) {
    console.error("❌ Error durante la migración:", err.message);
  } finally {
    await sql.end();
  }
}

migrate();
