import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { jobsApi } from '../api/jobs';
import Icon from '../components/ui/Icon';
import Alert from '../components/ui/Alert';

const JobCreate = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    title: '', company: '', location: '', format: 'ONSITE',
    employment_type: 'FULL_TIME', description: '', salary_range: '',
  });
  const [skills, setSkills] = useState([]);
  const [skillInput, setSkillInput] = useState('');

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !skills.includes(s)) { setSkills([...skills, s]); setSkillInput(''); }
  };

  const handleSkillKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addSkill(); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const job = await jobsApi.create({ ...formData, required_skills: skills });
      navigate(`/jobs/${job.id}`);
    } catch (err) {
      console.error(err);
      setError('Failed to create job. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
        <Link to="/jobs" style={{ color: 'var(--ink-3)' }}>JOBS</Link>
        <span>/</span>
        <span style={{ color: 'var(--ink-2)' }}>NEW POSTING</span>
      </div>

      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>JOBS · NEW POSTING</div>
          <h1 className="h1">Post a <i>job</i>.</h1>
        </div>
        <div className="page-head-actions">
          <button className="btn ghost" onClick={() => navigate('/jobs')}>Cancel</button>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <form onSubmit={handleSubmit} className="form-stack">
        <div className="form-card">
          <div className="form-card-head"><h3>Basic information</h3><p>Essential details about the position.</p></div>
          <div className="form-row">
            <div className="form-group"><label>Job title</label><input name="title" value={formData.title} onChange={handleChange} placeholder="e.g. Senior Backend Engineer" required /></div>
            <div className="form-group"><label>Company</label><input name="company" value={formData.company} onChange={handleChange} placeholder="e.g. Kaspi.kz" required /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Location</label><input name="location" value={formData.location} onChange={handleChange} placeholder="Almaty, Kazakhstan" /></div>
            <div className="form-group"><label>Salary range</label><input name="salary_range" value={formData.salary_range} onChange={handleChange} placeholder="₸ 800k–1.2M / mo" /></div>
          </div>
        </div>

        <div className="form-card">
          <div className="form-card-head"><h3>Type & format</h3></div>
          <div className="form-row">
            <div className="form-group">
              <label>Employment type</label>
              <select name="employment_type" value={formData.employment_type} onChange={handleChange}>
                <option value="FULL_TIME">Full-time</option>
                <option value="PART_TIME">Part-time</option>
                <option value="INTERNSHIP">Internship</option>
                <option value="CONTRACT">Contract</option>
              </select>
            </div>
            <div className="form-group">
              <label>Work format</label>
              <select name="format" value={formData.format} onChange={handleChange}>
                <option value="ONSITE">On-site</option>
                <option value="HYBRID">Hybrid</option>
                <option value="REMOTE">Remote</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-card">
          <div className="form-card-head"><h3>Required skills</h3><p>Press Enter to add each skill.</p></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text" value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={handleSkillKey}
              placeholder="e.g. Kotlin"
            />
            <button type="button" className="btn" onClick={addSkill}><Icon name="plus" size={12} /> Add</button>
          </div>
          {skills.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {skills.map((s) => (
                <span key={s} className="chip skill" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {s}
                  <button type="button" onClick={() => setSkills(skills.filter((k) => k !== s))} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', padding: 0 }}>
                    <Icon name="close" size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="form-card">
          <div className="form-card-head"><h3>Description</h3><p>Be specific about responsibilities, the team, and what success looks like.</p></div>
          <div className="form-group">
            <textarea
              name="description" rows="10" value={formData.description} onChange={handleChange}
              placeholder="Describe the role, what the team does, what the candidate will own…" required
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={() => navigate('/jobs')}>Cancel</button>
          <button type="submit" className="btn primary" disabled={loading}>
            {loading ? 'Creating…' : 'Create job posting'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default JobCreate;
