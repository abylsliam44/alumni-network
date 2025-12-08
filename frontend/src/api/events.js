import api from './axios';

export const eventsApi = {
  async list(params = {}) {
    const { data } = await api.get('/api/v1/events', { params });
    return data;
  },
  async get(id) {
    const { data } = await api.get(`/api/v1/events/${id}`);
    return data;
  },
  async create(payload) {
    const { data } = await api.post('/api/v1/events', payload);
    return data;
  },
  async register(id) {
    const { data } = await api.post(`/api/v1/events/${id}/register`);
    return data;
  },
  async myRegistrations() {
    const { data } = await api.get('/api/v1/events/registrations/me');
    return data.items;
  },
};

