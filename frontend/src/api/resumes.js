import axios from 'axios';
import api from './axios';

export const resumesApi = {
  getPresignedUrl: async (filename, filetype) => {
    const response = await api.post(
      `/api/v1/resumes/presigned-url?filename=${encodeURIComponent(filename)}&filetype=${encodeURIComponent(filetype)}`
    );
    return response.data;
  },

  createImport: async (payload) => {
    const response = await api.post('/api/v1/resumes/imports', payload);
    return response.data;
  },

  listImports: async () => {
    const response = await api.get('/api/v1/resumes/imports');
    return response.data;
  },

  getImport: async (importId) => {
    const response = await api.get(`/api/v1/resumes/imports/${importId}`);
    return response.data;
  },

  getDraft: async (importId) => {
    const response = await api.get(`/api/v1/resumes/imports/${importId}/draft`);
    return response.data;
  },

  updateDraft: async (importId, payload) => {
    const response = await api.put(`/api/v1/resumes/imports/${importId}/draft`, payload);
    return response.data;
  },

  confirmImport: async (importId, payload) => {
    const response = await api.post(`/api/v1/resumes/imports/${importId}/confirm`, payload);
    return response.data;
  },

  reprocessImport: async (importId) => {
    const response = await api.post(`/api/v1/resumes/imports/${importId}/reprocess`);
    return response.data;
  },

  uploadToStorage: async (uploadUrl, file) => {
    return axios.put(uploadUrl, file, {
      headers: { 'Content-Type': file.type },
    });
  },
};
