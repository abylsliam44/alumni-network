import api from './axios';

export const connectionsApi = {
  async list() {
    const { data } = await api.get('/api/v1/connections/');
    return data;
  },
  async request(recipientId) {
    const { data } = await api.post('/api/v1/connections/request', { recipient_id: recipientId });
    return data;
  },
  async respond(connectionId, status) {
    const { data } = await api.post(`/api/v1/connections/${connectionId}/respond`, { status });
    return data;
  },
  async friends() {
    const { data } = await api.get('/api/v1/connections/friends');
    return data;
  },
};
