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
    <div className="page job-create-page">
      <div className="create-header">
        <Button variant="ghost" className="back-btn" onClick={() => navigate('/jobs')}>
          ← Back to Jobs
        </Button>
        <h1>Post a Job</h1>
        <p>Share a great opportunity with the alumni network</p>
      </div>

      <Card className="create-form-card elevated">
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit} className="job-form">
          <div className="form-section">
            <h2 className="section-title">Basic Information</h2>

            <div className="form-group">
              <label>Job Title*</label>
              <input
                type="text"
                name="title"
                required
                placeholder="e.g. Senior Software Engineer"
                value={formData.title}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Company*</label>
              <input
                type="text"
                name="company"
                required
                placeholder="e.g. Google, Microsoft, StartupXYZ"
                value={formData.company}
                onChange={handleChange}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Work Format</label>
                <select
                  name="format"
                  value={formData.format}
                  onChange={handleChange}
                >
                  <option value="ONSITE">On-site</option>
                  <option value="REMOTE">Remote</option>
                  <option value="HYBRID">Hybrid</option>
                </select>
              </div>
              <div className="form-group">
                <label>Employment Type</label>
                <select
                  name="employment_type"
                  value={formData.employment_type}
                  onChange={handleChange}
                >
                  <option value="FULL_TIME">Full Time</option>
                  <option value="PART_TIME">Part Time</option>
                  <option value="INTERNSHIP">Internship</option>
                  <option value="CONTRACT">Contract</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Location</label>
              <input
                type="text"
                name="location"
                placeholder="City, Country or 'Remote'"
                value={formData.location}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-divider"></div>

          <div className="form-section">
            <h2 className="section-title">Job Details</h2>

            <div className="form-group">
              <label>Salary Range (Optional)</label>
              <input
                type="text"
                name="salary_range"
                placeholder="e.g. $50k - $80k"
                value={formData.salary_range}
                onChange={handleChange}
              />
              <small>Help candidates understand the compensation</small>
            </div>

            <div className="form-group">
              <label>Required Skills</label>
              <input
                type="text"
                name="required_skills"
                placeholder="React, Python, SQL"
                value={formData.required_skills}
                onChange={handleChange}
              />
              <small>Separate skills with commas</small>
            </div>

            <div className="form-group">
              <label>Description*</label>
              <textarea
                name="description"
                rows={8}
                required
                placeholder="Describe the role, responsibilities, requirements..."
                value={formData.description}
                onChange={handleChange}
              />
              <small>Provide detailed information about the position</small>
            </div>
          </div>

          <div className="form-actions">
            <Button type="button" variant="ghost" onClick={() => navigate('/jobs')}>
              Cancel
            </Button>
            <Button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Draft'}
            </Button>
          </div>
        </form>
      </Card>

      <style>{`
        .job-create-page {
          max-width: 800px;
          margin: 0 auto;
          padding-bottom: 4rem;
        }

        .create-header {
          margin-bottom: 2rem;
        }

        .back-btn {
          margin-bottom: 1rem;
          padding-left: 0;
          color: var(--text-secondary);
        }
        .back-btn:hover { color: var(--accent-primary); background: transparent; }

        .create-header h1 {
          font-size: 2rem;
          font-weight: 700;
          margin: 0 0 0.5rem;
          color: var(--text-primary);
        }

        .create-header p {
          font-size: 1rem;
          color: var(--text-secondary);
          margin: 0;
        }

        .create-form-card {
          padding: 2.5rem;
          background: var(--bg-elevated);
          border-radius: 16px;
        }

        .error-banner {
          background: #fee;
          color: #c33;
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 2rem;
          border: 1px solid #fcc;
        }

        .job-form {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .form-section {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .section-title {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0 0 0.5rem;
          color: var(--text-primary);
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-group label {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          padding: 0.75rem;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-size: 0.95rem;
          transition: all 0.2s;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: var(--accent-primary);
          background: var(--bg-primary);
          box-shadow: 0 0 0 3px var(--accent-light);
        }

        .form-group small {
          font-size: 0.8rem;
          color: var(--text-tertiary);
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .form-divider {
          height: 1px;
          background: var(--border-color);
          margin: 1rem 0;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border-color);
        }

        @media (max-width: 640px) {
          .create-form-card { padding: 1.5rem; }
          .form-row { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

export default JobCreate;
