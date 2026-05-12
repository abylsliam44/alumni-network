import api from './axios';

export const messagesApi = {
  async listConversations() {
    const { data } = await api.get('/api/v1/messages/conversations');
    return data;
  },
  async getConversationMessages(id) {
    const { data } = await api.get(`/api/v1/messages/conversations/${id}`);
    return data;
  },
  async startConversation(userId) {
    const { data } = await api.post('/api/v1/messages/conversations/start', {
      user_id: userId,
    });
    return data;
  },
  async markRead(id, lastMessageId) {
    await api.post(`/api/v1/messages/conversations/${id}/read`, {
      last_read_message_id: lastMessageId,
    });
  },
  async sendMessage(id, payload) {
    const { data } = await api.post(`/api/v1/messages/conversations/${id}/messages`, payload);
    return data;
  },
  async getAttachmentUploadUrl(filename, filetype, filesize) {
    const { data } = await api.post('/api/v1/messages/attachments/presigned-url', null, {
      params: { filename, filetype, filesize },
    });
    return data;
  },
  async uploadAttachment(file) {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post('/api/v1/messages/attachments/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  },
};
