import { supabase } from '../lib/supabase.js';

const limit = Number(process.env.NORMALIZED_CHECK_LIMIT || 500);
const failOnMismatch = process.env.NORMALIZED_FAIL_ON_MISMATCH === 'true';

const run = async () => {
  console.log('[NormalizedCheck] Starting backfill + consistency check', {
    limit,
    failOnMismatch,
  });

  const { data: backfillCount, error: backfillError } = await supabase.rpc('backfill_player_domain_from_profiles');
  if (backfillError) {
    throw new Error(`Backfill failed: ${backfillError.message}`);
  }

  const { data: reportRows, error: reportError } = await supabase.rpc('normalized_consistency_report', {
    p_limit: limit,
  });

  if (reportError) {
    throw new Error(`Consistency report failed: ${reportError.message}`);
  }

  const rows = Array.isArray(reportRows) ? reportRows : [];
  const inconsistent = rows.filter((row) => !row.consistent);

  console.log('[NormalizedCheck] Completed', {
    backfillCount: Number(backfillCount || 0),
    checked: rows.length,
    inconsistent: inconsistent.length,
  });

  if (inconsistent.length > 0) {
    console.log('[NormalizedCheck] Inconsistent players sample', inconsistent.slice(0, 10));
    if (failOnMismatch) {
      process.exitCode = 1;
    }
  }
};

run().catch((error) => {
  console.error('[NormalizedCheck] Fatal error', error);
  process.exitCode = 1;
});
