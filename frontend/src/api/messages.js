import api from './axios';

export const messagesApi = {
  async listConversations() {
    const { data } = await api.get('/api/v1/messages/conversations');
    return data;
  },
  async getConversationMessages(id) {
    const { data } = await api.get(`/api/v1/messages/conversations/${id}`);
    return data.messages;
  },
  async sendMessage(payload) {
    const { data } = await api.post('/api/v1/messages/messages', payload);
    return data;
  },
  async markRead(id) {
    await api.post(`/api/v1/messages/conversations/${id}/read`);
  },
};

