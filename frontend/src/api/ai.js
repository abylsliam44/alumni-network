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

  // Knowledge Base methods
  async uploadKnowledgeBase(file) {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post('/api/v1/ai/knowledge-base/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  },

  async getKnowledgeBaseStats() {
    const { data } = await api.get('/api/v1/ai/knowledge-base/stats');
    return data;
  },

  async clearKnowledgeBase() {
    const { data } = await api.delete('/api/v1/ai/knowledge-base');
    return data;
  },
};
