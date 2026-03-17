type DiagnosticPayload = Record<string, unknown>;

export const createTraceId = (prefix: string): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export const shortId = (value: string | null | undefined): string | null => {
  if (!value) return null;
  if (value.length <= 10) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
};

export const maskEmail = (email: string): string => {
  const [local, domain] = email.split('@');
  if (!local || !domain) return 'invalid-email';
  if (local.length <= 2) return `${local[0] || '*'}*@${domain}`;
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
};

export const normalizeError = (error: unknown): DiagnosticPayload => {
  if (error instanceof Error) {
    const maybeStatus = (error as Error & { status?: number }).status;
    const maybeCode = (error as Error & { code?: string }).code;
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      status: typeof maybeStatus === 'number' ? maybeStatus : undefined,
      code: typeof maybeCode === 'string' ? maybeCode : undefined,
    };
  }

  if (typeof error === 'object' && error !== null) {
    return { ...(error as Record<string, unknown>) };
  }

  return { message: String(error) };
};
