import api from './axios';

export const projectsApi = {
  async list(params = {}) {
    const { data } = await api.get('/api/v1/projects', { params });
    return data;
  },
  async recommended(params = {}) {
    const { data } = await api.get('/api/v1/projects/recommended', { params });
    return data;
  },
  async byUser(userId) {
    const { data } = await api.get(`/api/v1/projects/user/${userId}`);
    return data;
  },
  async get(id) {
    const { data } = await api.get(`/api/v1/projects/${id}`);
    return data;
  },
  async create(payload) {
    const { data } = await api.post('/api/v1/projects', payload);
    return data;
  },
  async update(id, payload) {
    const { data } = await api.put(`/api/v1/projects/${id}`, payload);
    return data;
  },
  async remove(id) {
    await api.delete(`/api/v1/projects/${id}`);
  },
  async apply(id, payload) {
    const { data } = await api.post(`/api/v1/projects/${id}/apply`, payload);
    return data;
  },
  async applications(id) {
    const { data } = await api.get(`/api/v1/projects/${id}/applications`);
    return data;
  },
  async candidates(id) {
    const { data } = await api.get(`/api/v1/projects/${id}/candidates`);
    return data;
  },
};

export const PROJECT_CATEGORIES = {
  STARTUP: 'Startup',
  PET_PROJECT: 'Pet Project',
  AI_ML: 'AI/ML',
  MOBILE_APP: 'Mobile App',
  WEB_PLATFORM: 'Web Platform',
  SAAS: 'SaaS',
  UNIVERSITY_PROJECT: 'University Project',
  HACKATHON: 'Hackathon',
  RESEARCH: 'Research',
  OPEN_SOURCE: 'Open Source',
};

export const PROJECT_ROLES = {
  FRONTEND_DEVELOPER: 'Frontend Developer',
  BACKEND_DEVELOPER: 'Backend Developer',
  FULLSTACK_DEVELOPER: 'Fullstack Developer',
  UI_UX_DESIGNER: 'UI/UX Designer',
  PRODUCT_MANAGER: 'Product Manager',
  ML_ENGINEER: 'ML Engineer',
  MOBILE_DEVELOPER: 'Mobile Developer',
  DEVOPS_ENGINEER: 'DevOps Engineer',
  MARKETING: 'Marketing',
  CO_FOUNDER: 'Co-Founder',
};

export const PROJECT_STAGES = {
  IDEA: 'Idea',
  VALIDATION: 'Validation',
  MVP: 'MVP',
  IN_PROGRESS: 'In Progress',
  SCALING: 'Scaling',
};
