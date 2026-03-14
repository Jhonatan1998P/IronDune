import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ Error: DATABASE_URL no definida.");
  process.exit(1);
}

const sql = postgres(connectionString);

async function clearDatabase() {
  try {
    console.log("⚠️  ADVERTENCIA: Iniciando limpieza de tablas...");
    
    // Lista explícita de tablas antiguas y nuevas para asegurar limpieza total
    const tablesToDrop = [
      'game_bots', 'logistic_loot', 'profiles', 'player_economy', 
      'player_buildings', 'player_research', 'player_units', 
      'bots', 'salvage_fields', 'movements', 'reports', 'inbox'
    ];

    for (const table of tablesToDrop) {
      console.log(`Borrando tabla: ${table}...`);
      await sql.unsafe(`DROP TABLE IF EXISTS public.${table} CASCADE`);
    }
      
    // Borrar tipos personalizados
    await sql`DROP TYPE IF EXISTS user_role CASCADE`;
    await sql`DROP TYPE IF EXISTS movement_type CASCADE`;
    await sql`DROP TYPE IF EXISTS report_type CASCADE`;
      
    console.log("✅ Todas las tablas antiguas y nuevas han sido eliminadas.");
    console.log("👉 Ahora ejecuta 'npm run db:migrate --prefix server' para reconstruir.");
  } catch (err) {
    console.error("❌ Error durante la limpieza:", err.message);
  } finally {
    await sql.end();
  }
}

clearDatabase();
