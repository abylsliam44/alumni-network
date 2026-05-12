<<<<<<< HEAD
import api from './axios';

export const directoryApi = {
  getUsers: async (params) => {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
    );
    const response = await api.get('/api/v1/directory/', { params: cleanParams });
    return response.data;
  },
};
=======
import api from './axios';

export const directoryApi = {
  getUsers: async (params) => {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
    );
    const response = await api.get('/api/v1/directory/', { params: cleanParams });
    return response.data;
  },
};
>>>>>>> origin/main
