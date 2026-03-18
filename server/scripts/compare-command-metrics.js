import fs from 'node:fs/promises';

const [prePath, postPath] = process.argv.slice(2);

if (!prePath || !postPath) {
  console.error('Usage: node server/scripts/compare-command-metrics.js <pre.json> <post.json>');
  process.exit(1);
}

const maxRegression = {
  failedPerMin: Number(process.env.METRICS_MAX_FAILED_PER_MIN_DELTA || 0),
  errorRate: Number(process.env.METRICS_MAX_ERROR_RATE_DELTA || 0.01),
  revisionMismatchesPerMin: Number(process.env.METRICS_MAX_REVISION_MISMATCH_DELTA || 0.5),
  p95LatencyMs: Number(process.env.METRICS_MAX_P95_LATENCY_DELTA_MS || 100),
};

const readJson = async (path) => JSON.parse(await fs.readFile(path, 'utf8'));

const run = async () => {
  const pre = await readJson(prePath);
  const post = await readJson(postPath);

  const deltas = {
    failedPerMin: Number(post?.rates?.failedPerMin || 0) - Number(pre?.rates?.failedPerMin || 0),
    errorRate: Number(post?.rates?.errorRate || 0) - Number(pre?.rates?.errorRate || 0),
    revisionMismatchesPerMin: Number(post?.rates?.revisionMismatchesPerMin || 0) - Number(pre?.rates?.revisionMismatchesPerMin || 0),
    p95LatencyMs: Number(post?.latencyMs?.p95 || 0) - Number(pre?.latencyMs?.p95 || 0),
  };

  const regressions = Object.entries(deltas).filter(([key, delta]) => delta > maxRegression[key]);

  console.log('[MetricsCompare] Delta report', {
    deltas,
    thresholds: maxRegression,
    regressions,
  });

  if (regressions.length > 0) {
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error('[MetricsCompare] Failed', error);
  process.exitCode = 1;
});
