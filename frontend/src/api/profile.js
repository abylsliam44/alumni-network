import api from './axios';

export const profileApi = {
  getMe: async () => {
    const response = await api.get('/api/v1/profile/me');
    return response.data;
  },

  updateMe: async (profileData) => {
    const response = await api.put('/api/v1/profile/me', profileData);
    return response.data;
  },

  uploadPhoto: async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.patch('/api/v1/profile/me/photo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  uploadCover: async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.patch('/api/v1/profile/me/cover', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  deletePhoto: async () => {
    const response = await api.delete('/api/v1/profile/me/photo');
    return response.data;
  },

  deleteCover: async () => {
    const response = await api.delete('/api/v1/profile/me/cover');
    return response.data;
  },

  getUserProfile: async (userId) => {
    const response = await api.get(`/api/v1/profile/${userId}`);
    return response.data;
  },
};
