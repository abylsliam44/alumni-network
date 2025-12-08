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
  declineRequest: async (requestId) => {
    const response = await api.put(`/api/v1/mentorship/requests/${requestId}/decline`);
    return response.data;
  },
  getRelationships: async () => {
    const response = await api.get('/api/v1/mentorship/relationships');
    return response.data;
  },
};
