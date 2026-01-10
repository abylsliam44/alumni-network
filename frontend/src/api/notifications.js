import api from './axios';

export const notificationsApi = {
  async list(limit = 50, unreadOnly = false) {
    const { data } = await api.get('/api/v1/notifications/', {
      params: { limit, unread_only: unreadOnly }
    });
    return data;
  },

  async getUnreadCount() {
    const { data } = await api.get('/api/v1/notifications/unread-count');
    return data.unread_count;
  },

  async markAsRead(notificationIds) {
    const { data } = await api.post('/api/v1/notifications/mark-read', {
      notification_ids: notificationIds
    });
    return data;
  },

  async markAllAsRead() {
    const { data } = await api.post('/api/v1/notifications/mark-all-read');
    return data;
  }
};
