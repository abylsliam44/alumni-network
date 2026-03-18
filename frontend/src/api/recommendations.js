import api from './axios';

export const normalizePeopleRecommendations = (payload) => {
  const items = Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload?.recommendations)
      ? payload.recommendations
      : [];

  return {
    ...payload,
    items,
    recommendations: items,
  };
};

export const recommendationsApi = {
  async getPeople() {
    const { data } = await api.get('/api/v1/recommendations/people');
    return normalizePeopleRecommendations(data);
  },
};
