import axios from 'axios';

const api = axios.create({
  // Use VITE_API_URL when set (direct backend connection).
  // Otherwise use empty baseURL - works with Vite proxy (dev) and nginx proxy (prod).
  // API paths already include '/api/v1/' prefix.
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to add the auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle 401 errors (token expiration)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if 401 and not already retried
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');

      if (refreshToken) {
        try {
          // Manual axios call to avoid circular dependency loop if refresh itself fails
          const response = await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/v1/auth/refresh?refresh_token=${refreshToken}`);

          if (response.data && response.data.access_token) {
            const { access_token, refresh_token } = response.data;
            localStorage.setItem('token', access_token);
            if (refresh_token) localStorage.setItem('refreshToken', refresh_token);

            // Retry original request with new token
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
            return api(originalRequest);
          }
        } catch (refreshError) {
          console.error("Token refresh failed:", refreshError);
          // If refresh fails, fall through to logout cleanup
        }
      }

      // If no refresh token or refresh failed
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      // Let the app redirect via AuthContext state change or window.location
      window.location.href = '/login';
      return Promise.reject(error);
    }
    return Promise.reject(error);
  }
);

export default api;
