import api from './axios';

export const jobsApi = {
  async list(params = {}) {
    const { data } = await api.get('/api/v1/jobs', { params });
    return data;
  },
  async get(id) {
    const { data } = await api.get(`/api/v1/jobs/${id}`);
    return data;
  },
  async create(payload) {
    const { data } = await api.post('/api/v1/jobs', payload);
    return data;
  },
  async apply(id, payload) {
    const { data } = await api.post(`/api/v1/jobs/${id}/apply`, payload);
    return data;
  },
  async myApplications() {
    const { data } = await api.get('/api/v1/jobs/applications/me');
    return data.items;
  },
};

