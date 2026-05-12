import axios from 'axios';

// Fires when the server is unreachable / 5xx — lets App.jsx show ErrorScreen.
export const emitNetworkError = () =>
  window.dispatchEvent(new CustomEvent('app:network-error'));

const api = axios.create({
  // Use VITE_API_URL when set (direct backend connection).
  // Otherwise use empty baseURL - works with Vite proxy (dev) and nginx proxy (prod).
  // API paths already include '/api/v1/' prefix.
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Refresh expired sessions through HttpOnly cookies.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url || '';

    if (
      error.response &&
      error.response.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !requestUrl.includes('/api/v1/auth/login') &&
      !requestUrl.includes('/api/v1/auth/register') &&
      !requestUrl.includes('/api/v1/auth/refresh')
    ) {
      originalRequest._retry = true;

      try {
        await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/v1/auth/refresh`, null, {
          withCredentials: true,
        });
        return api(originalRequest);
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
      }

      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      if (!originalRequest.skipAuthRedirect) {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
    return Promise.reject(error);
  }
);

// Network-level and server errors (no response, 502/503/504).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const isNetworkDown = !error.response && error.message !== 'canceled';
    const isServerError = status >= 502 && status <= 504;
    if (isNetworkDown || isServerError) {
      emitNetworkError();
    }
    return Promise.reject(error);
  }
);

export default api;
