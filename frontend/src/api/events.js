import api from './axios';

export const eventsApi = {
  // List events with filters
  async list(params = {}) {
    const { data } = await api.get('/api/v1/events', { params });
    return data;
  },
  
  // Get single event details
  async get(id) {
    const { data } = await api.get(`/api/v1/events/${id}`);
    return data;
  },
  
  // Create new event (returns draft)
  async create(payload) {
    const { data } = await api.post('/api/v1/events', payload);
    return data;
  },
  
  // Update event
  async update(id, payload) {
    const { data } = await api.put(`/api/v1/events/${id}`, payload);
    return data;
  },
  
  // Delete event
  async delete(id) {
    await api.delete(`/api/v1/events/${id}`);
  },
  
  // Submit event for admin approval
  async submitForApproval(id) {
    const { data } = await api.post(`/api/v1/events/${id}/submit`);
    return data;
  },
  
  // Admin: Approve event
  async approve(id) {
    const { data } = await api.post(`/api/v1/events/${id}/approve`);
    return data;
  },
  
  // Admin: Reject event
  async reject(id, reason = null) {
    const { data } = await api.post(`/api/v1/events/${id}/reject`, { approved: false, reason });
    return data;
  },
  
  // Cancel event
  async cancel(id) {
    const { data } = await api.post(`/api/v1/events/${id}/cancel`);
    return data;
  },
  
  // Register for event
  async register(id) {
    const { data } = await api.post(`/api/v1/events/${id}/register`);
    return data;
  },
  
  // Unregister from event
  async unregister(id) {
    await api.post(`/api/v1/events/${id}/unregister`);
  },
  
  // Get attendees list (organizer/admin only)
  async getAttendees(id) {
    const { data } = await api.get(`/api/v1/events/${id}/attendees`);
    return data;
  },
  
  // Get my registrations
  async myRegistrations() {
    const { data } = await api.get('/api/v1/events/registrations/me');
    return data;
  },
  
  // Admin: Get pending events
  async getPending(params = {}) {
    const { data } = await api.get('/api/v1/events/admin/pending', { params });
    return data;
  },
  
  // === Speakers ===
  async addSpeaker(eventId, speaker) {
    const { data } = await api.post(`/api/v1/events/${eventId}/speakers`, speaker);
    return data;
  },
  
  async removeSpeaker(eventId, speakerId) {
    await api.delete(`/api/v1/events/${eventId}/speakers/${speakerId}`);
  },
  
  // === Materials ===
  async addMaterial(eventId, material) {
    const { data } = await api.post(`/api/v1/events/${eventId}/materials`, material);
    return data;
  },
  
  async removeMaterial(eventId, materialId) {
    await api.delete(`/api/v1/events/${eventId}/materials/${materialId}`);
  },
  
  // === Reviews ===
  async getReviews(eventId, params = {}) {
    const { data } = await api.get(`/api/v1/events/${eventId}/reviews`, { params });
    return data;
  },
  
  async createReview(eventId, review) {
    const { data } = await api.post(`/api/v1/events/${eventId}/reviews`, review);
    return data;
  },
  
  // === Messages (Chat) ===
  async getMessages(eventId, params = {}) {
    const { data } = await api.get(`/api/v1/events/${eventId}/messages`, { params });
    return data;
  },
  
  async sendMessage(eventId, content) {
    const { data } = await api.post(`/api/v1/events/${eventId}/messages`, { content });
    return data;
  },
};
