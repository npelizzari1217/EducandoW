import axios from 'axios';
import { getToken, setToken } from './token';
import { sessionManager } from './session-manager';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // needed so the httpOnly refresh-token cookie travels
});

// Shared refresh promise so multiple concurrent 401s only trigger ONE refresh call
let refreshPromise: Promise<string> | null = null;

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401) {
      const isAuthRequest = originalRequest?.url?.includes('/auth/');

      if (!isAuthRequest && !originalRequest?._retry) {
        originalRequest._retry = true;

        // 1. Try silent refresh (single concurrent refresh, others await same promise)
        try {
          if (!refreshPromise) {
            const base = (import.meta.env.VITE_API_URL as string) || '/v1';
            refreshPromise = axios
              .post(`${base}/auth/refresh`, {}, { withCredentials: true })
              .then((res) => res.data.data.accessToken as string)
              .finally(() => { refreshPromise = null; });
          }

          const newToken = await refreshPromise;
          setToken(newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        } catch {
          // Refresh failed → need re-login
        }

        // 2. Need manual re-login
        try {
          await sessionManager.requireRelogin();
          const token = getToken();
          if (token) originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        } catch {
          // User cancelled — propagate original error
        }
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
