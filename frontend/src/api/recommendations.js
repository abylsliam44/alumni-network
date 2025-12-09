import api from './axios';

export const recommendationsApi = {
  async getPeople() {
    const { data } = await api.get('/api/v1/recommendations/people');
    return data;
  },
};
