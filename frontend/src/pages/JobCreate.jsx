import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { jobsApi } from '../api/jobs';

const JobCreate = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    location: '',
    format: 'ONSITE',
    employment_type: 'FULL_TIME',
    description: '',
    required_skills: '',
    salary_range: ''
  });
  const [error, setError] = useState('');
  const [skills, setSkills] = useState([]);
  const [skillInput, setSkillInput] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const addSkill = () => {
    const skill = skillInput.trim();
    if (skill && !skills.includes(skill)) {
      setSkills([...skills, skill]);
      setSkillInput('');
    }
  };

  const removeSkill = (skillToRemove) => {
    setSkills(skills.filter(s => s !== skillToRemove));
  };

  const handleSkillKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkill();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {
        ...formData,
        required_skills: skills
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
    <div className="job-create-container">
      {/* Breadcrumb */}
      <nav className="create-breadcrumb">
        <Link to="/jobs" className="breadcrumb-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Jobs
        </Link>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 5l7 7-7 7" />
        </svg>
        <span className="breadcrumb-current">Create Job</span>
      </nav>

      {/* Header */}
      <header className="create-header">
        <div className="header-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <div className="header-text">
          <h1>Post a New Job</h1>
          <p>Share an opportunity with the AITU alumni network</p>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="create-form">
        {/* Basic Info Section */}
        <section className="form-section">
          <div className="section-header">
            <div className="section-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
              </svg>
            </div>
            <div>
              <h2>Basic Information</h2>
              <p>Essential details about the position</p>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group full-width">
              <label>Job Title <span className="required">*</span></label>
              <input
                type="text"
                name="title"
                required
                placeholder="e.g. Senior Software Engineer"
                value={formData.title}
                onChange={handleChange}
              />
            </div>

            <div className="form-group full-width">
              <label>Company <span className="required">*</span></label>
              <input
                type="text"
                name="company"
                required
                placeholder="e.g. Google, Microsoft, Kaspi"
                value={formData.company}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Work Format</label>
              <div className="radio-group">
                {['ONSITE', 'REMOTE', 'HYBRID'].map(format => (
                  <label key={format} className={`radio-option ${formData.format === format ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="format"
                      value={format}
                      checked={formData.format === format}
                      onChange={handleChange}
                    />
                    <span className="radio-icon">
                      {format === 'ONSITE' && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                        </svg>
                      )}
                      {format === 'REMOTE' && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                        </svg>
                      )}
                      {format === 'HYBRID' && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      )}
                    </span>
                    <span className="radio-label">
                      {format === 'ONSITE' ? 'On-site' : format === 'HYBRID' ? 'Hybrid' : 'Remote'}
                    </span>
                  </label>
                ))}
              </div>
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

            <div className="form-group full-width">
              <label>Location</label>
              <input
                type="text"
                name="location"
                placeholder="City, Country (or 'Remote')"
                value={formData.location}
                onChange={handleChange}
              />
              <span className="input-hint">Where the candidate will be working</span>
            </div>
          </div>
        </section>

        {/* Details Section */}
        <section className="form-section">
          <div className="section-header">
            <div className="section-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14,2 14,8 20,8" />
              </svg>
            </div>
            <div>
              <h2>Job Details</h2>
              <p>Additional information about the role</p>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group full-width">
              <label>Salary Range</label>
              <div className="input-with-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <input
                  type="text"
                  name="salary_range"
                  placeholder="e.g. $60,000 - $80,000 or 500,000 - 800,000 KZT"
                  value={formData.salary_range}
                  onChange={handleChange}
                />
              </div>
              <span className="input-hint">Optional but helps attract the right candidates</span>
            </div>

            <div className="form-group full-width">
              <label>Required Skills</label>
              <div className="skills-input-container">
                <div className="skills-input-wrapper">
                  <input
                    type="text"
                    placeholder="Type a skill and press Enter"
                    value={skillInput}
                    onChange={e => setSkillInput(e.target.value)}
                    onKeyDown={handleSkillKeyDown}
                  />
                  <button type="button" className="add-skill-btn" onClick={addSkill}>
                    Add
                  </button>
                </div>
                {skills.length > 0 && (
                  <div className="skills-tags">
                    {skills.map((skill, idx) => (
                      <span key={idx} className="skill-tag">
                        {skill}
                        <button type="button" onClick={() => removeSkill(skill)}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span className="input-hint">Add skills one by one</span>
            </div>

            <div className="form-group full-width">
              <label>Job Description <span className="required">*</span></label>
              <textarea
                name="description"
                rows={10}
                required
                placeholder={`Describe the role, responsibilities, and requirements...

Example:
We are looking for a talented Software Engineer to join our team.

Responsibilities:
• Design and develop high-quality software
• Collaborate with cross-functional teams
• Participate in code reviews

Requirements:
• 3+ years of experience in software development
• Strong knowledge of React and TypeScript
• Excellent communication skills`}
                value={formData.description}
                onChange={handleChange}
              />
              <span className="input-hint">Be specific about the role to attract qualified candidates</span>
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="form-actions">
          <div className="action-hint">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <span>Your job will be saved as a draft and require approval before publishing</span>
          </div>
          <div className="action-buttons">
            <button type="button" className="btn-secondary" onClick={() => navigate('/jobs')}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <span className="btn-spinner" />
                  Creating...
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 4v16m8-8H4" />
                  </svg>
                  Create Job Draft
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      <style>{`
        .job-create-container {
          max-width: 800px;
          margin: 0 auto;
          padding-bottom: 4rem;
        }

        /* Breadcrumb */
        .create-breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 24px;
          font-size: 14px;
          color: var(--text-secondary);
        }

        .breadcrumb-link {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--text-secondary);
          text-decoration: none;
          transition: color 0.2s;
        }

        .breadcrumb-link:hover {
          color: var(--text-primary);
        }

        .breadcrumb-current {
          color: var(--text-primary);
          font-weight: 500;
        }

        /* Header */
        .create-header {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 32px;
        }

        .header-icon {
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--text-primary);
          color: var(--bg-primary);
          border-radius: 14px;
        }

        .header-text h1 {
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 4px;
        }

        .header-text p {
          font-size: 15px;
          color: var(--text-secondary);
          margin: 0;
        }

        /* Error Banner */
        .error-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          color: var(--text-primary);
          margin-bottom: 24px;
        }

        /* Form */
        .create-form {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .form-section {
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 28px;
        }

        .section-header {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 28px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--border-subtle);
        }

        .section-icon {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          color: var(--text-primary);
          flex-shrink: 0;
        }

        .section-header h2 {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 4px;
        }

        .section-header p {
          font-size: 14px;
          color: var(--text-secondary);
          margin: 0;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group.full-width {
          grid-column: 1 / -1;
        }

        .form-group label {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary);
        }

        .required {
          color: var(--text-secondary);
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          padding: 14px 16px;
          border: 1px solid var(--border-color);
          border-radius: 10px;
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-size: 15px;
          transition: all 0.2s;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: var(--text-primary);
          background: var(--bg-primary);
        }

        .form-group textarea {
          resize: vertical;
          min-height: 200px;
        }

        .input-hint {
          font-size: 13px;
          color: var(--text-tertiary);
        }

        .input-with-icon {
          position: relative;
        }

        .input-with-icon svg {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-tertiary);
        }

        .input-with-icon input {
          padding-left: 46px;
        }

        /* Radio Group */
        .radio-group {
          display: flex;
          gap: 10px;
        }

        .radio-option {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 16px 12px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .radio-option input {
          display: none;
        }

        .radio-option.selected {
          background: var(--bg-primary);
          border-color: var(--text-primary);
        }

        .radio-icon {
          color: var(--text-secondary);
        }

        .radio-option.selected .radio-icon {
          color: var(--text-primary);
        }

        .radio-label {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
        }

        .radio-option.selected .radio-label {
          color: var(--text-primary);
        }

        /* Skills Input */
        .skills-input-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .skills-input-wrapper {
          display: flex;
          gap: 8px;
        }

        .skills-input-wrapper input {
          flex: 1;
        }

        .add-skill-btn {
          padding: 14px 20px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.2s;
        }

        .add-skill-btn:hover {
          border-color: var(--text-primary);
        }

        .skills-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .skill-tag {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          font-size: 14px;
          color: var(--text-primary);
        }

        .skill-tag button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          padding: 0;
          background: transparent;
          border: none;
          color: var(--text-tertiary);
          font-size: 16px;
          cursor: pointer;
        }

        .skill-tag button:hover {
          color: var(--text-primary);
        }

        /* Actions */
        .form-actions {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .action-hint {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 14px 16px;
          background: var(--bg-secondary);
          border-radius: 10px;
          font-size: 14px;
          color: var(--text-secondary);
        }

        .action-hint svg {
          flex-shrink: 0;
          color: var(--text-tertiary);
        }

        .action-buttons {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .btn-secondary,
        .btn-primary {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 14px 24px;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-secondary {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
        }

        .btn-secondary:hover {
          border-color: var(--text-primary);
        }

        .btn-primary {
          background: var(--text-primary);
          border: none;
          color: var(--bg-primary);
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .btn-primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .btn-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid currentColor;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Responsive */
        @media (max-width: 640px) {
          .form-section {
            padding: 20px;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .radio-group {
            flex-direction: column;
          }

          .create-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }

          .action-buttons {
            flex-direction: column;
          }

          .btn-secondary,
          .btn-primary {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};

export default JobCreate;
