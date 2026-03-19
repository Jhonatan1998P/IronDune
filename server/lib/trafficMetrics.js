const METRICS_RETENTION_MS = Number(process.env.TRAFFIC_METRICS_RETENTION_MS || 15 * 60_000);

const metricsState = {
  startedAt: Date.now(),
  server: {
    totalRequests: 0,
    failedRequests: 0,
    byRoute: new Map(),
    byUser: new Map(),
    recent: [],
  },
  supabase: {
    totalCalls: 0,
    failedCalls: 0,
    byService: new Map(),
    byMethod: new Map(),
    recent: [],
  },
};

const minuteBucket = (timestampMs) => Math.floor(timestampMs / 60_000) * 60_000;

const maskUserId = (userId) => {
  if (typeof userId !== 'string' || userId.length < 8) return userId;
  return `${userId.slice(0, 4)}...${userId.slice(-4)}`;
};

const classifySupabaseService = (urlLike) => {
  try {
    const parsed = new URL(urlLike);
    const path = parsed.pathname || '';
    if (path.startsWith('/rest/v1/rpc')) return 'rpc';
    if (path.startsWith('/rest/v1')) return 'rest';
    if (path.startsWith('/auth/v1')) return 'auth';
    if (path.startsWith('/storage/v1')) return 'storage';
    if (path.startsWith('/realtime/v1')) return 'realtime';
    return 'other';
  } catch {
    return 'other';
  }
};

const observeLatency = (entries) => {
  if (!entries.length) {
    return { count: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
  }

  const values = entries.map((entry) => Number(entry.durationMs || 0)).filter((value) => Number.isFinite(value) && value >= 0);
  if (values.length === 0) {
    return { count: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
  }

  values.sort((a, b) => a - b);
  const percentile = (p) => values[Math.min(values.length - 1, Math.floor((p / 100) * values.length))] || 0;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return {
    count: values.length,
    min: Math.round(values[0]),
    max: Math.round(values[values.length - 1]),
    avg: Math.round(sum / values.length),
    p50: Math.round(percentile(50)),
    p95: Math.round(percentile(95)),
    p99: Math.round(percentile(99)),
  };
};

const prune = (nowMs) => {
  const cutoff = nowMs - METRICS_RETENTION_MS;
  metricsState.server.recent = metricsState.server.recent.filter((entry) => entry.at >= cutoff);
  metricsState.supabase.recent = metricsState.supabase.recent.filter((entry) => entry.at >= cutoff);

  metricsState.server.byRoute.forEach((value, key) => {
    if (value.lastSeenAt < cutoff) metricsState.server.byRoute.delete(key);
  });

  metricsState.server.byUser.forEach((value, key) => {
    if (value.lastSeenAt < cutoff) metricsState.server.byUser.delete(key);
  });

  metricsState.supabase.byMethod.forEach((value, key) => {
    if (value.lastSeenAt < cutoff) metricsState.supabase.byMethod.delete(key);
  });

  metricsState.supabase.byService.forEach((value, key) => {
    if (value.lastSeenAt < cutoff) metricsState.supabase.byService.delete(key);
  });
};

export const observeServerHttpRequest = ({ method, path, statusCode, durationMs, userId }) => {
  const now = Date.now();
  const safeMethod = String(method || 'GET').toUpperCase();
  const safePath = String(path || '/unknown');
  const safeStatus = Number(statusCode || 0);
  const routeKey = `${safeMethod} ${safePath}`;

  metricsState.server.totalRequests += 1;
  if (safeStatus >= 500) {
    metricsState.server.failedRequests += 1;
  }

  const currentRoute = metricsState.server.byRoute.get(routeKey) || { count: 0, failed: 0, lastSeenAt: now };
  currentRoute.count += 1;
  if (safeStatus >= 500) currentRoute.failed += 1;
  currentRoute.lastSeenAt = now;
  metricsState.server.byRoute.set(routeKey, currentRoute);

  if (typeof userId === 'string' && userId) {
    const currentUser = metricsState.server.byUser.get(userId) || { count: 0, lastSeenAt: now };
    currentUser.count += 1;
    currentUser.lastSeenAt = now;
    metricsState.server.byUser.set(userId, currentUser);
  }

  metricsState.server.recent.push({
    at: now,
    minute: minuteBucket(now),
    durationMs: Number.isFinite(durationMs) ? Math.max(0, Number(durationMs)) : 0,
    statusCode: safeStatus,
    userId: typeof userId === 'string' ? userId : null,
  });

  prune(now);
};

export const observeSupabaseHttpCall = ({ method, url, statusCode, durationMs, failed = false }) => {
  const now = Date.now();
  const safeMethod = String(method || 'GET').toUpperCase();
  const safeStatus = Number(statusCode || 0);
  const service = classifySupabaseService(String(url || ''));

  metricsState.supabase.totalCalls += 1;
  if (failed || safeStatus >= 500 || safeStatus === 0) {
    metricsState.supabase.failedCalls += 1;
  }

  const byService = metricsState.supabase.byService.get(service) || { count: 0, failed: 0, lastSeenAt: now };
  byService.count += 1;
  if (failed || safeStatus >= 500 || safeStatus === 0) byService.failed += 1;
  byService.lastSeenAt = now;
  metricsState.supabase.byService.set(service, byService);

  const byMethod = metricsState.supabase.byMethod.get(safeMethod) || { count: 0, failed: 0, lastSeenAt: now };
  byMethod.count += 1;
  if (failed || safeStatus >= 500 || safeStatus === 0) byMethod.failed += 1;
  byMethod.lastSeenAt = now;
  metricsState.supabase.byMethod.set(safeMethod, byMethod);

  metricsState.supabase.recent.push({
    at: now,
    minute: minuteBucket(now),
    durationMs: Number.isFinite(durationMs) ? Math.max(0, Number(durationMs)) : 0,
    statusCode: safeStatus,
  });

  prune(now);
};

const aggregateLastMinute = (entries) => {
  const now = Date.now();
  const cutoff = now - 60_000;
  return entries.filter((entry) => entry.at >= cutoff);
};

export const getTrafficMetricsSnapshot = () => {
  const now = Date.now();
  prune(now);

  const recentServer = aggregateLastMinute(metricsState.server.recent);
  const recentSupabase = aggregateLastMinute(metricsState.supabase.recent);

  const uniqueUsersLastMinute = new Set(recentServer.map((entry) => entry.userId).filter(Boolean));

  const topRoutes = [...metricsState.server.byRoute.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 12)
    .map(([route, stats]) => ({ route, count: stats.count, failed: stats.failed }));

  const topUsersLastMinute = [...recentServer
    .filter((entry) => typeof entry.userId === 'string' && entry.userId)
    .reduce((acc, entry) => {
      const key = entry.userId;
      acc.set(key, (acc.get(key) || 0) + 1);
      return acc;
    }, new Map())
    .entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([userId, count]) => ({ userId: maskUserId(userId), count }));

  return {
    uptimeMs: now - metricsState.startedAt,
    windowMs: METRICS_RETENTION_MS,
    server: {
      totalRequests: metricsState.server.totalRequests,
      failedRequests: metricsState.server.failedRequests,
      requestsLastMinute: recentServer.length,
      uniqueUsersLastMinute: uniqueUsersLastMinute.size,
      latencyMs: observeLatency(metricsState.server.recent),
      topRoutes,
      topUsersLastMinute,
    },
    supabase: {
      totalCalls: metricsState.supabase.totalCalls,
      failedCalls: metricsState.supabase.failedCalls,
      callsLastMinute: recentSupabase.length,
      latencyMs: observeLatency(metricsState.supabase.recent),
      byService: Object.fromEntries([...metricsState.supabase.byService.entries()].map(([key, value]) => [key, { count: value.count, failed: value.failed }])),
      byMethod: Object.fromEntries([...metricsState.supabase.byMethod.entries()].map(([key, value]) => [key, { count: value.count, failed: value.failed }])),
    },
  };
};
