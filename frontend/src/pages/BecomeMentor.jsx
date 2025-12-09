import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { mentorshipApi } from '../api/mentorship';

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
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update mentor status');
    } finally {
      setSubmitting(false);
    }
  };

  if (user && user.role !== 'ALUMNI') {
    return (
      <div className="page-container">
        <Card className="auth-card">
          <h2>Become a Mentor</h2>
          <p className="text-secondary">
            Only AITU alumni can enroll as mentors. Students can still browse mentors and send requests.
          </p>
        </Card>
      </div>
    );
  }

  if (user?.is_mentor) {
    return (
      <div className="page-container">
        <Card className="auth-card">
          <h2>You are already a mentor</h2>
          <p className="text-secondary mb-4">
            Head over to your mentor dashboard to manage requests and mentees.
          </p>
          <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Card className="auth-card">
        <h2>Become a Mentor</h2>
        <p className="text-secondary mb-6">
          As an AITU alumni you can support students with career guidance, interview prep, and more. This is optional and you can manage your availability anytime.
        </p>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">Mentor profile saved!</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Mentor headline"
            name="headline"
            value={formData.headline}
            onChange={handleChange}
            placeholder="Backend engineer, happy to mentor on careers & internships"
            required
          />
          <Input
            label="Areas of help (comma separated)"
            name="areas_of_help"
            value={formData.areas_of_help}
            onChange={handleChange}
            placeholder="CV review, Interview prep, Career guidance"
          />
          <Input
            label="Industries / Domains (comma separated)"
            name="industries"
            value={formData.industries}
            onChange={handleChange}
            placeholder="Fintech, AI, Backend"
          />
          <Input
            label="Max mentees (optional)"
            name="max_mentees"
            type="number"
            min="1"
            value={formData.max_mentees}
            onChange={handleChange}
            placeholder="e.g., 3"
          />
          <div className="form-group">
            <label className="form-label">Availability note</label>
            <textarea
              className="form-input"
              name="availability_note"
              rows="3"
              value={formData.availability_note}
              onChange={handleChange}
              placeholder="Evenings, weekends, online only..."
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="consent_mentor"
              checked={formData.consent_mentor}
              onChange={handleChange}
              required
            />
            <span className="text-sm">
              I confirm that I am willing to be contacted by students as a mentor.
            </span>
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Saving...' : 'Activate Mentor Profile'}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default BecomeMentor;
