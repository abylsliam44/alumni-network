import api from './axios';

export const jobsApi = {
  // --- Jobs ---
  async list(params = {}) {
    const { data } = await api.get('/api/v1/jobs', { params });
    return data;
  },
  async get(id) {
    const { data } = await api.get(`/api/v1/jobs/${id}`);
    return data;
  },
  async create(payload) {
    const { data } = await api.post('/api/v1/jobs', payload);
    return data;
  },
  async update(id, payload) {
    const { data } = await api.put(`/api/v1/jobs/${id}`, payload);
    return data;
  },
  async submit(id) {
    const { data } = await api.post(`/api/v1/jobs/${id}/submit`);
    return data;
  },
  async approve(id) {
    const { data } = await api.post(`/api/v1/jobs/${id}/approve`);
    return data;
  },
  async reject(id) {
    const { data } = await api.post(`/api/v1/jobs/${id}/reject`);
    return data;
  },
  async close(id) {
    const { data } = await api.post(`/api/v1/jobs/${id}/close`);
    return data;
  },

  // --- Applications ---
  async getPresignedUrl(filename, filetype) {
    const { data } = await api.post('/api/v1/jobs/presigned-url', { filename, filetype }, {
      params: { filename, filetype } // Backend expects query params? No, I defined query params in jobs.py: get_upload_url
      // Wait, endpoint definition: async def get_upload_url(filename: str, filetype: str ...)
      // These are query parameters by default in FastAPI if not Path or Body.
      // So passed in params
    });
    return data;
  },

  async apply(id, payload) {
    // payload: { resume_url, cover_letter }
    const { data } = await api.post(`/api/v1/jobs/${id}/apply`, payload);
    return data;
  },

  async getApplications(jobId) {
    const { data } = await api.get(`/api/v1/jobs/${jobId}/applications`);
    return data;
  },

  async myApplications() {
    const { data } = await api.get('/api/v1/jobs/applications/me');
    return data.items;
  },

  async updateApplicationStatus(applicationId, status) {
    const { data } = await api.patch(`/api/v1/jobs/applications/${applicationId}/status`, { status });
    return data;
  },

  // --- Chat ---
  async getChatHistory(applicationId) {
    const { data } = await api.get(`/api/v1/job-chat/${applicationId}/history`);
    return data;
  }
};
