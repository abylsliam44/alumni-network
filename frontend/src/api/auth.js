import api from './axios';

export const authApi = {
  login: async (email, password) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const response = await api.post('/api/v1/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  },

  register: async (userData) => {
    const response = await api.post('/api/v1/auth/register', userData);
    return response.data;
  },

  getCurrentUser: async (config = {}) => {
    const response = await api.get('/api/v1/auth/me', config);
    return response.data;
  },

  logout: async () => {
    const response = await api.post('/api/v1/auth/logout');
    return response.data;
  },
};
