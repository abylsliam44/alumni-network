import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { mentorshipApi } from '../api/mentorship';
import './BecomeMentor.css';

const SparklesIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L14.4 7.2L19 9L14.4 10.8L12 16L9.6 10.8L5 9L9.6 7.2L12 2Z" fill="url(#grad1)" stroke="none" />
    <path d="M18 16L19 18L21 19L19 20L18 22L17 20L15 19L17 18L18 16Z" fill="url(#grad1)" stroke="none" />
    <defs>
      <linearGradient id="grad1" x1="5" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#6366f1" />
        <stop offset="1" stopColor="#ec4899" />
      </linearGradient>
    </defs>
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
      // Wait a bit to show success message before redirecting
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update mentor status');
      setSubmitting(false);
    }
  };

  if (user && user.role !== 'ALUMNI') {
    return (
      <div className="mentor-page">
        <div className="mentor-card">
          <div className="mentor-header">
            <h2 className="mentor-title">Become a Mentor</h2>
            <p className="mentor-description">
              Only AITU alumni can enroll as mentors. Students can browse mentors and send requests.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (user?.is_mentor) {
    return (
      <div className="mentor-page">
        <div className="mentor-card">
          <div className="mentor-header">
            <h2 className="mentor-title">You are a Mentor! 🎉</h2>
            <p className="mentor-description">
              Thank you for contributing to the community. Head over to your dashboard to manage your mentorship requests.
            </p>
          </div>
          <Button className="w-full" onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mentor-page">
      <div className="mentor-card">
        <div className="mentor-header">
          <div className="flex justify-center mb-4">
            <SparklesIcon />
          </div>
          <h2 className="mentor-title">Become a Mentor</h2>
          <p className="mentor-description">
            Share your expertise with the next generation. Support students with career guidance, interview prep, and industry insights.
          </p>
        </div>

        {error && (
          <div className="status-message status-error">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {success && (
          <div className="status-message status-success">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Mentor profile activated successfully! Redirecting...
          </div>
        )}

        <form onSubmit={handleSubmit} className="mentor-form">
          <Input
            label="Your Headline"
            name="headline"
            value={formData.headline}
            onChange={handleChange}
            placeholder="e.g. Senior Backend Engineer at Google"
            required
            className="form-input-premium"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Using grid here assuming Tailwind is available or layout works fine in flex col. 
                 Since custom CSS didn't define grid classes, I'll stick to full width logic or add grid to CSS.
                 Wait, I didn't add grid utilities. I'll stick to full width for now 
                 or relies on `gap-4` if `App.css` has it. `App.css` usually doesn't have Tailwind utilities unless using Tailwind.
                 I'll remove grid classes and keep it simple vertical stack as per CSS file.
             */}
          </div>

          <Input
            label="Areas of Help"
            name="areas_of_help"
            value={formData.areas_of_help}
            onChange={handleChange}
            placeholder="e.g. CV Review, Mock Interview, System Design"
          />

          <Input
            label="Industries / Domains"
            name="industries"
            value={formData.industries}
            onChange={handleChange}
            placeholder="e.g. Fintech, EdTech, Artificial Intelligence"
          />

          <Input
            label="Max Concurrent Mentees"
            name="max_mentees"
            type="number"
            min="1"
            max="50"
            value={formData.max_mentees}
            onChange={handleChange}
            placeholder="e.g. 3"
          />

          <div className="form-group">
            <label className="form-label">Availability & BIO</label>
            <textarea
              className="form-textarea"
              name="availability_note"
              rows="4"
              value={formData.availability_note}
              onChange={handleChange}
              placeholder="Tell us a bit about yourself and when you are usually available (e.g. Weekends, Evenings EST)..."
            />
          </div>

          <label className="checkbox-wrapper">
            <input
              type="checkbox"
              name="consent_mentor"
              checked={formData.consent_mentor}
              onChange={handleChange}
              required
              className="custom-checkbox"
            />
            <span className="checkbox-label">
              I confirm that I am willing to be contacted by students and listed in the mentor directory.
            </span>
          </label>

          <div className="submit-btn-wrapper">
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Activating Profile...' : 'Activate Mentor Profile'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BecomeMentor;
