import api from './axios';

export const aiApi = {
  async chat(question) {
    const { data } = await api.post('/api/v1/ai/chat', { question });
    return data;
  },
  async history() {
    const { data } = await api.get('/api/v1/ai/chat/history');
    return data;
  },
};

