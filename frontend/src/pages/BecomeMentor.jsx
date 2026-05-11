import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { mentorshipApi } from '../api/mentorship';
import Icon from '../components/ui/Icon';
import Pill from '../components/ui/Pill';
import Alert from '../components/ui/Alert';

const BecomeMentor = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    headline: '', areas_of_help: '', industries: '',
    max_mentees: '', availability_note: '', consent_mentor: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSubmitting(true); setError(null);
    const payload = {
      headline: formData.headline,
      areas_of_help: formData.areas_of_help.split(',').map((s) => s.trim()).filter(Boolean),
      industries: formData.industries.split(',').map((s) => s.trim()).filter(Boolean),
      max_mentees: formData.max_mentees ? Number(formData.max_mentees) : null,
      availability_note: formData.availability_note,
      consent_mentor: formData.consent_mentor,
    };
    try {
      await mentorshipApi.becomeMentor(payload);
      await refreshUser();
      setSuccess(true);
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update mentor status');
      setSubmitting(false);
    }
  };

  if (user && user.role !== 'ALUMNI') {
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>BECOME A MENTOR</div>
            <h1 className="h1">Mentor profiles are <i>alumni-only</i>.</h1>
          </div>
        </div>
        <div className="empty-block">
          <Icon name="award" size={28} />
          <h3>Mentor activation is limited to alumni accounts</h3>
          <p>This page is reserved for alumni who want to open mentorship availability. Students can browse mentors and send requests directly.</p>
        </div>
      </div>
    );
  }

  if (user?.is_mentor) {
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>MENTOR · ACTIVE</div>
            <h1 className="h1">You're already a <i>mentor</i>.</h1>
          </div>
        </div>
        <div className="panel activation-status-grid" style={{ padding: 24, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 16, alignItems: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: 10, background: 'var(--ok-soft)', border: '1px solid rgba(109,179,140,0.3)', color: 'var(--ok)', display: 'grid', placeItems: 'center' }}>
            <Icon name="check" size={20} />
          </div>
          <div>
            <h3 className="h3">Listed in the directory</h3>
            <p className="mute" style={{ marginTop: 4, fontSize: 13 }}>Students can discover your profile, see your help areas, and send requests directly.</p>
          </div>
          <div className="mobile-row-actions" style={{ display: 'flex', gap: 6 }}>
            <button className="btn" onClick={() => navigate('/profile/edit')}>Edit details</button>
            <button className="btn primary" onClick={() => navigate('/dashboard')}>Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>MENTORSHIP · ACTIVATION</div>
          <h1 className="h1">Become a <i>mentor</i>,<br />on your terms.</h1>
        </div>
      </div>

      <div className="responsive-two-col balanced">
        <div>
          <div className="panel" style={{ padding: 24 }}>
            <Pill tone="blue" dot><Icon name="spark" size={11} /> ACTIVATION</Pill>
            <h2 className="h2" style={{ margin: '12px 0 8px' }}>Turn your alumni experience into <i>practical guidance</i>.</h2>
            <p className="dim" style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
              Add a clear headline, define how you can help, and tell students what kind of conversations they can expect.
            </p>
          </div>

          <div className="eyebrow" style={{ margin: '20px 0 12px' }}>WHY ACTIVATE</div>
          {[
            { icon: 'graph', title: 'Clear positioning', body: 'Students instantly see your focus, industries, and the kinds of questions you handle.' },
            { icon: 'users', title: 'Qualified requests', body: 'Your mentor profile attracts people who actually need your expertise.' },
            { icon: 'award', title: 'Controlled capacity', body: 'Set your own mentee limit and availability note so expectations stay realistic.' },
          ].map((b) => (
            <div key={b.title} className="panel" style={{ padding: 14, marginBottom: 10, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: 7, background: 'var(--blue-soft)', border: '1px solid var(--blue-line)', color: 'var(--blue)', display: 'grid', placeItems: 'center' }}>
                <Icon name={b.icon} size={14} />
              </div>
              <div>
                <div className="h3">{b.title}</div>
                <div className="mute" style={{ fontSize: 12.5, marginTop: 4 }}>{b.body}</div>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="form-card">
          <div className="form-card-head">
            <h3>Activate your mentor profile</h3>
            <p>Shown in the mentor directory and used for matching.</p>
          </div>

          {error && <Alert type="error">{error}</Alert>}
          {success && <Alert type="success">Mentor profile activated. Redirecting…</Alert>}

          <div className="form-group">
            <label>Mentor headline</label>
            <input name="headline" value={formData.headline} onChange={handleChange} placeholder="Senior Backend Engineer at Google" required />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Areas of help</label>
              <input name="areas_of_help" value={formData.areas_of_help} onChange={handleChange} placeholder="CV review, system design, mock interview" />
              <div className="help">Comma-separated.</div>
            </div>
            <div className="form-group">
              <label>Industries</label>
              <input name="industries" value={formData.industries} onChange={handleChange} placeholder="Fintech, edtech, AI products" />
              <div className="help">Comma-separated.</div>
            </div>
          </div>

          <div className="form-group">
            <label>Max concurrent mentees</label>
            <input type="number" min="1" max="50" name="max_mentees" value={formData.max_mentees} onChange={handleChange} placeholder="3" style={{ maxWidth: 120 }} />
          </div>

          <div className="form-group">
            <label>Availability and short bio</label>
            <textarea
              name="availability_note" rows="5" value={formData.availability_note} onChange={handleChange}
              placeholder="Share what students can approach you for, your mentoring style, and when you are usually available."
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 14, background: 'var(--bg-2)', border: '1px solid var(--line-soft)', borderRadius: 8, fontFamily: 'var(--sans)', textTransform: 'none', letterSpacing: 0, fontSize: 12.5 }}>
            <input type="checkbox" name="consent_mentor" checked={formData.consent_mentor} onChange={handleChange} required style={{ marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 500, color: 'var(--ink)' }}>I agree to be listed as a mentor.</div>
              <div className="mute" style={{ marginTop: 2 }}>I'm willing to receive mentorship requests and have my profile shown in the directory.</div>
            </div>
          </label>

          <div className="form-actions">
            <button type="submit" className="btn primary" disabled={submitting}>
              {submitting ? 'Activating…' : 'Activate mentor profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BecomeMentor;
