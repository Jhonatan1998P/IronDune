import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { supabase } from '../lib/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationPath = path.resolve(__dirname, '../migrations/006_fix_normalized_queue_timestamps.sql');

const run = async () => {
  const sql = await fs.readFile(migrationPath, 'utf8');
  console.log('[NormalizedQueueFix] Applying migration', { migrationPath });

  const { error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    throw new Error(`Failed to apply migration: ${error.message}`);
  }

  const { data: reportRows, error: reportError } = await supabase.rpc('normalized_consistency_report', {
    p_limit: Number(process.env.NORMALIZED_CHECK_LIMIT || 200),
  });
  if (reportError) {
    throw new Error(`Failed to run consistency report: ${reportError.message}`);
  }

  const rows = Array.isArray(reportRows) ? reportRows : [];
  const inconsistent = rows.filter((row) => !row.consistent);

  console.log('[NormalizedQueueFix] Completed', {
    checked: rows.length,
    inconsistent: inconsistent.length,
    sample: inconsistent.slice(0, 5),
  });
};

run().catch((error) => {
  console.error('[NormalizedQueueFix] Fatal error', error);
  process.exitCode = 1;
});
