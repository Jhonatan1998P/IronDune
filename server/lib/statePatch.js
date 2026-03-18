export const isNonNullObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const parseRevision = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.floor(numeric);
};

export const sanitizeStatePatch = (patch, allowList) => {
  if (!isNonNullObject(patch)) return {};
  const sanitized = {};

  Object.entries(patch).forEach(([key, value]) => {
    if (!allowList.has(key)) return;
    sanitized[key] = value;
  });

  return sanitized;
};

export const buildServerStatePatch = (previousState, nextState, allowList) => {
  const patch = {};
  const before = isNonNullObject(previousState) ? previousState : {};
  const after = isNonNullObject(nextState) ? nextState : {};

  allowList.forEach((key) => {
    if (JSON.stringify(before[key]) === JSON.stringify(after[key])) return;
    patch[key] = after[key];
  });

  return patch;
};
