import postgres from 'postgres';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ Error: DATABASE_URL no definida.");
  process.exit(1);
}

const sql = postgres(connectionString);

const PERSONALITIES = ['WARLORD', 'TURTLE', 'TYCOON', 'ROGUE'];
const COUNTRIES = ['US', 'GB', 'DE', 'FR', 'ES', 'BR', 'CN', 'KR', 'JP', 'RU'];

const BOT_NAME_PREFIXES = ['Night', 'Dark', 'Iron', 'Steel', 'Shadow', 'Ghost', 'Cyber', 'Neo'];
const BOT_NAME_ROOTS = ['Wolf', 'Hawk', 'Fox', 'Viper', 'Cobra', 'Raven', 'Tiger', 'Lion'];

async function seed() {
  try {
    console.log("🤖 Inicializando base de datos de BOTS globales...");
    
    const bots = [];
    for (let i = 0; i < 50; i++) {
      const name = `${BOT_NAME_PREFIXES[i % 8]}_${BOT_NAME_ROOTS[Math.floor(Math.random() * 8)]}_${i + 1}`;
      const personality = PERSONALITIES[i % 4];
      const dominionScore = 1000 * Math.pow(1.05, i);
      
      bots.push({
        name,
        personality,
        score: Math.round(dominionScore),
        country: COUNTRIES[i % 10],
        units: JSON.stringify({
            CYBER_MARINE: Math.floor(dominionScore / 10),
            SCOUT_TANK: Math.floor(dominionScore / 50)
        }),
        stats: JSON.stringify({
            DOMINION: Math.round(dominionScore),
            MILITARY: Math.round(dominionScore * 0.6),
            ECONOMY: Math.round(dominionScore * 12)
        })
      });
    }

    await sql`DELETE FROM public.bots`;
    await sql`INSERT INTO public.bots ${sql(bots, 'name', 'personality', 'score', 'units', 'stats')}`;
    
    console.log("✅ 50 Bots globales creados exitosamente.");
  } catch (err) {
    console.error("❌ Error seedeando bots:", err);
  } finally {
    await sql.end();
  }
}

seed();
