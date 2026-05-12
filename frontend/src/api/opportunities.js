import api from './axios';

export const opportunitiesApi = {
  async getMe(direction, scope, graduationYear, interest) {
    const params = {};
    if (direction) params.direction = direction;
    if (scope) params.scope = scope;
    if (graduationYear) params.graduation_year = graduationYear;
    if (interest) params.interest = interest;
    const { data } = await api.get('/api/v1/opportunities/me', {
      params: Object.keys(params).length > 0 ? params : undefined,
    });
    return data;
  },

  async generateInterest(interest) {
    const { data } = await api.post('/api/v1/opportunities/interest', { interest });
    return data;
  },

  async clearInterest() {
    const { data } = await api.delete('/api/v1/opportunities/interest');
    return data;
  },
};
