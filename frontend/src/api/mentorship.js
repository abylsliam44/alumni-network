<<<<<<< HEAD
import api from './axios';

export const mentorshipApi = {
  sendRequest: async (data) => {
    const response = await api.post('/api/v1/mentorship/request', data);
    return response.data;
  },
  getIncomingRequests: async () => {
    const response = await api.get('/api/v1/mentorship/requests/incoming');
    return response.data;
  },
  getOutgoingRequests: async () => {
    const response = await api.get('/api/v1/mentorship/requests/outgoing');
    return response.data;
  },
  acceptRequest: async (requestId) => {
    const response = await api.put(`/api/v1/mentorship/requests/${requestId}/accept`);
    return response.data;
  },
=======
import api from './axios';

export const mentorshipApi = {
  sendRequest: async (data) => {
    const response = await api.post('/api/v1/mentorship/request', data);
    return response.data;
  },
  getIncomingRequests: async () => {
    const response = await api.get('/api/v1/mentorship/requests/incoming');
    return response.data;
  },
  getOutgoingRequests: async () => {
    const response = await api.get('/api/v1/mentorship/requests/outgoing');
    return response.data;
  },
  acceptRequest: async (requestId) => {
    const response = await api.put(`/api/v1/mentorship/requests/${requestId}/accept`);
    return response.data;
  },
>>>>>>> origin/main
  declineRequest: async (requestId) => {
    const response = await api.put(`/api/v1/mentorship/requests/${requestId}/decline`);
    return response.data;
  },
<<<<<<< HEAD
  getRelationships: async () => {
    const response = await api.get('/api/v1/mentorship/relationships');
    return response.data;
  },
  becomeMentor: async (data) => {
    const response = await api.post('/api/v1/mentorship/become', data);
    return response.data;
  },
  cancelRequest: async (requestId) => {
    const response = await api.put(`/api/v1/mentorship/requests/${requestId}/cancel`);
    return response.data;
  },
  submitFeedback: async (relationshipId, data) => {
    const response = await api.post(`/api/v1/mentorship/relationships/${relationshipId}/feedback`, data);
    return response.data;
  },
=======
  getRelationships: async () => {
    const response = await api.get('/api/v1/mentorship/relationships');
    return response.data;
  },
  becomeMentor: async (data) => {
    const response = await api.post('/api/v1/mentorship/become', data);
    return response.data;
  },
  cancelRequest: async (requestId) => {
    const response = await api.put(`/api/v1/mentorship/requests/${requestId}/cancel`);
    return response.data;
  },
  submitFeedback: async (relationshipId, data) => {
    const response = await api.post(`/api/v1/mentorship/relationships/${relationshipId}/feedback`, data);
    return response.data;
  },
>>>>>>> origin/main
  getFeedback: async (relationshipId) => {
    const response = await api.get(`/api/v1/mentorship/relationships/${relationshipId}/feedback`);
    return response.data;
  },
  updateRelationshipStatus: async (relationshipId, status) => {
    const response = await api.patch(`/api/v1/mentorship/relationships/${relationshipId}/status`, { status });
    return response.data;
  },
  updatePlan: async (relationshipId, data) => {
    const response = await api.put(`/api/v1/mentorship/relationships/${relationshipId}/plan`, data);
    return response.data;
  },
  createSession: async (relationshipId, data) => {
    const response = await api.post(`/api/v1/mentorship/relationships/${relationshipId}/sessions`, data);
    return response.data;
  },
  updateSession: async (sessionId, data) => {
    const response = await api.patch(`/api/v1/mentorship/sessions/${sessionId}`, data);
    return response.data;
  },
  getReceivedFeedback: async () => {
<<<<<<< HEAD
    const response = await api.get('/api/v1/mentorship/feedback/received');
    return response.data;
  },
};
=======
    const response = await api.get('/api/v1/mentorship/feedback/received');
    return response.data;
  },
};
>>>>>>> origin/main
