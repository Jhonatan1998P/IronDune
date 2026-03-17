const ENV = (import.meta as any).env || {};

const DEFAULT_REMOTE_BACKEND_ORIGIN = 'https://irondune.onrender.com';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const getConfiguredOrigin = (): string => {
  const fromEnv = ENV.VITE_API_BASE_URL || ENV.VITE_SOCKET_SERVER_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    return trimTrailingSlash(fromEnv.trim());
  }

  if (typeof window === 'undefined') return '';

  const { hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:10000';
  }

  return DEFAULT_REMOTE_BACKEND_ORIGIN;
};

export const BACKEND_ORIGIN = getConfiguredOrigin();

export const buildBackendUrl = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return BACKEND_ORIGIN ? `${BACKEND_ORIGIN}${normalizedPath}` : normalizedPath;
};

export const SOCKET_IO_PATH = '/socket.io';
