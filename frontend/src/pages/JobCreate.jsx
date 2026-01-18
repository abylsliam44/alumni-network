import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jobsApi } from '../api/jobs';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const JobCreate = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    location: '',
    format: 'ONSITE', // ONSITE, REMOTE, HYBRID
    employment_type: 'FULL_TIME',
    description: '',
    required_skills: '',
    salary_range: ''
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {
        ...formData,
        required_skills: formData.required_skills.split(',').map(s => s.trim()).filter(Boolean)
      };
      const job = await jobsApi.create(payload);
      navigate(`/jobs/${job.id}`);
    } catch (err) {
      console.error(err);
      setError('Failed to create job. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container" style={{ padding: '2rem' }}>
      <h1>Post a Job</h1>
      <Card className="p-6 max-w-2xl mx-auto">
        {error && <div className="bg-red-100 text-red-700 p-3 mb-4 rounded">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Job Title*</label>
            <input
              type="text"
              name="title"
              required
              className="w-full p-2 border rounded"
              value={formData.title}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Company*</label>
            <input
              type="text"
              name="company"
              required
              className="w-full p-2 border rounded"
              value={formData.company}
              onChange={handleChange}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Format</label>
              <select
                name="format"
                value={formData.format}
                onChange={handleChange}
                className="w-full p-2 border rounded"
              >
                <option value="ONSITE">On-site</option>
                <option value="REMOTE">Remote</option>
                <option value="HYBRID">Hybrid</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Employment Type</label>
              <select
                name="employment_type"
                value={formData.employment_type}
                onChange={handleChange}
                className="w-full p-2 border rounded"
              >
                <option value="FULL_TIME">Full Time</option>
                <option value="PART_TIME">Part Time</option>
                <option value="INTERNSHIP">Internship</option>
                <option value="CONTRACT">Contract</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Location (City, Country)</label>
            <input
              type="text"
              name="location"
              className="w-full p-2 border rounded"
              value={formData.location}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Salary Range (Optional)</label>
            <input
              type="text"
              name="salary_range"
              placeholder="e.g. $50k - $80k"
              className="w-full p-2 border rounded"
              value={formData.salary_range}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Required Skills (Comma separated)</label>
            <input
              type="text"
              name="required_skills"
              placeholder="React, Python, SQL"
              className="w-full p-2 border rounded"
              value={formData.required_skills}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              name="description"
              rows={5}
              className="w-full p-2 border rounded"
              value={formData.description}
              onChange={handleChange}
            />
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="ghost" onClick={() => navigate('/jobs')}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Draft'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default JobCreate;
