export const makeTraceId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const shortId = (value) => {
  if (!value || typeof value !== 'string') return null;
  if (value.length <= 10) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
};

export const normalizeServerError = (error) => {
  if (!error) return { message: 'Unknown error' };
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      status: error.status,
    };
  }
  if (typeof error === 'object') return error;
  return { message: String(error) };
};
