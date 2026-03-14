import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL);

async function check() {
  try {
    const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
    console.log("Tablas detectadas en la DB:");
    console.table(tables);
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}
check();
