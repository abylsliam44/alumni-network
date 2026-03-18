import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import PageIntro from '../components/PageIntro';
import { useAuth } from '../hooks/useAuth';
import { mentorshipApi } from '../api/mentorship';
import './BecomeMentor.css';

const SparklesIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3 1.9 4.1L18 9l-4.1 1.9L12 15l-1.9-4.1L6 9l4.1-1.9L12 3Z" />
    <path d="m19 15 .95 2.05L22 18l-2.05.95L19 21l-.95-2.05L16 18l2.05-.95L19 15Z" />
  </svg>
);

const CompassIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12Z" />
  </svg>
);

const UsersIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 13 4 4L19 7" />
  </svg>
);

const AlertIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4" />
    <path d="M12 16h.01" />
  </svg>
);

const BecomeMentor = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    headline: '',
    areas_of_help: '',
    industries: '',
    max_mentees: '',
    availability_note: '',
    consent_mentor: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      headline: formData.headline,
      areas_of_help: formData.areas_of_help
        ? formData.areas_of_help.split(',').map((item) => item.trim()).filter(Boolean)
        : [],
      industries: formData.industries
        ? formData.industries.split(',').map((item) => item.trim()).filter(Boolean)
        : [],
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

  const introSide = (
    <div className="page-intro-side-stack">
      <div className="page-intro-metrics">
        <div className="page-intro-metric">
          <span className="page-intro-metric-value">Alumni</span>
          <span className="page-intro-metric-label">Only mentors</span>
        </div>
        <div className="page-intro-metric">
          <span className="page-intro-metric-value">1 profile</span>
          <span className="page-intro-metric-label">Visible to students</span>
        </div>
        <div className="page-intro-metric highlight">
          <span className="page-intro-metric-value">Direct</span>
          <span className="page-intro-metric-label">Mentorship requests</span>
        </div>
      </div>
    </div>
  );

  if (user && user.role !== 'ALUMNI') {
    return (
      <div className="mentor-page">
        <PageIntro
          eyebrow="Mentorship & Community"
          title="Become a Mentor"
          subtitle="Mentor profiles are available only for AITU alumni. Students can still browse mentors and send mentorship requests."
          side={introSide}
        />

        <section className="mentor-state-card mentor-state-card-locked">
          <div className="mentor-state-icon">
            <ShieldIcon />
          </div>
          <div className="mentor-state-copy">
            <h2>Mentor activation is limited to alumni accounts</h2>
            <p>
              This page is reserved for alumni who want to open mentorship availability and receive direct requests from students.
            </p>
          </div>
        </section>
      </div>
    );
  }

  if (user?.is_mentor) {
    return (
      <div className="mentor-page">
        <PageIntro
          eyebrow="Mentorship & Community"
          title="Become a Mentor"
          subtitle="Your mentor profile is already active and visible to students who are looking for guidance."
          side={introSide}
        />

        <section className="mentor-state-card mentor-state-card-success">
          <div className="mentor-state-icon">
            <CheckIcon />
          </div>
          <div className="mentor-state-copy">
            <h2>You are already listed as a mentor</h2>
            <p>
              Students can discover your profile, review your help areas, and send mentorship requests directly from the platform.
            </p>
          </div>
          <div className="mentor-state-actions">
            <Button className="page-intro-button" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
            <Button
              variant="secondary"
              className="page-intro-button page-intro-button-secondary"
              onClick={() => navigate('/profile/edit')}
            >
              Edit Mentor Details
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mentor-page">
      <PageIntro
        eyebrow="Mentorship & Community"
        title="Become a Mentor"
        subtitle="Open your mentor profile for students and share the experience, advice, and career perspective they cannot get from a job post."
        side={introSide}
      />

      <section className="mentor-shell">
        <div className="mentor-overview-card">
          <div className="mentor-overview-hero">
            <span className="mentor-kicker">
              <SparklesIcon />
              Mentor activation
            </span>
            <h2>Turn your alumni experience into practical guidance</h2>
            <p>
              Add a clear headline, define how you can help, and tell students what kind of conversations they can expect from you.
            </p>
          </div>

          <div className="mentor-benefits-grid">
            <div className="mentor-benefit-card">
              <div className="mentor-benefit-icon">
                <CompassIcon />
              </div>
              <h3>Clear positioning</h3>
              <p>Students instantly see your focus, industries, and the kinds of questions you are comfortable handling.</p>
            </div>

            <div className="mentor-benefit-card">
              <div className="mentor-benefit-icon">
                <UsersIcon />
              </div>
              <h3>Qualified requests</h3>
              <p>Your mentor profile attracts people who are specifically looking for the expertise you choose to expose.</p>
            </div>

            <div className="mentor-benefit-card">
              <div className="mentor-benefit-icon">
                <ShieldIcon />
              </div>
              <h3>Controlled capacity</h3>
              <p>Set your own mentee limit and availability note so expectations stay realistic from the start.</p>
            </div>
          </div>

          <div className="mentor-guidelines-card">
            <span className="mentor-guidelines-kicker">What works best</span>
            <ul className="mentor-guidelines-list">
              <li>Use a headline that explains your level, role, and company or domain.</li>
              <li>List concrete help areas such as CV review, interview prep, backend growth, or ML portfolio advice.</li>
              <li>Keep your availability note practical so students know when and how you usually respond.</li>
            </ul>
          </div>
        </div>

        <div className="mentor-form-card">
          <div className="mentor-form-header">
            <h2>Activate your mentor profile</h2>
            <p>Your information will be shown in the mentor directory and used when students decide whom to contact.</p>
          </div>

          {error && (
            <div className="mentor-status-message mentor-status-error">
              <AlertIcon />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mentor-status-message mentor-status-success">
              <CheckIcon />
              <span>Mentor profile activated successfully. Redirecting to your dashboard...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mentor-form">
            <div className="mentor-field">
              <label htmlFor="mentor-headline" className="mentor-label">Mentor headline</label>
              <input
                id="mentor-headline"
                className="mentor-input"
                name="headline"
                value={formData.headline}
                onChange={handleChange}
                placeholder="Senior Backend Engineer at Google"
                required
              />
            </div>

            <div className="mentor-field-grid">
              <div className="mentor-field">
                <label htmlFor="mentor-help" className="mentor-label">Areas of help</label>
                <input
                  id="mentor-help"
                  className="mentor-input"
                  name="areas_of_help"
                  value={formData.areas_of_help}
                  onChange={handleChange}
                  placeholder="CV review, mock interview, system design"
                />
              </div>

              <div className="mentor-field">
                <label htmlFor="mentor-industries" className="mentor-label">Industries or domains</label>
                <input
                  id="mentor-industries"
                  className="mentor-input"
                  name="industries"
                  value={formData.industries}
                  onChange={handleChange}
                  placeholder="Fintech, edtech, AI products"
                />
              </div>
            </div>

            <div className="mentor-field-grid mentor-field-grid-tight">
              <div className="mentor-field">
                <label htmlFor="mentor-max-mentees" className="mentor-label">Max concurrent mentees</label>
                <input
                  id="mentor-max-mentees"
                  className="mentor-input"
                  name="max_mentees"
                  type="number"
                  min="1"
                  max="50"
                  value={formData.max_mentees}
                  onChange={handleChange}
                  placeholder="3"
                />
              </div>
            </div>

            <div className="mentor-field">
              <label htmlFor="mentor-availability" className="mentor-label">Availability and short bio</label>
              <textarea
                id="mentor-availability"
                className="mentor-textarea"
                name="availability_note"
                rows="6"
                value={formData.availability_note}
                onChange={handleChange}
                placeholder="Share what students can approach you for, your mentoring style, and when you are usually available."
              />
            </div>

            <label className="mentor-consent-card">
              <input
                type="checkbox"
                name="consent_mentor"
                checked={formData.consent_mentor}
                onChange={handleChange}
                required
              />
              <div>
                <span className="mentor-consent-title">I agree to be listed as a mentor</span>
                <span className="mentor-consent-copy">
                  I am willing to receive mentorship requests from students and share my mentor profile in the directory.
                </span>
              </div>
            </label>

            <div className="mentor-form-actions">
              <Button type="submit" className="page-intro-button mentor-submit-button" disabled={submitting}>
                {submitting ? 'Activating Profile...' : 'Activate Mentor Profile'}
              </Button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
};

export default BecomeMentor;
