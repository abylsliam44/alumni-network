import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { profileApi } from '../api/profile';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Alert from '../components/ui/Alert';

const EditProfile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    headline: '',
    bio: '',
    location: '',
    linkedin_url: '',
    skills: '', // Comma separated
    education: [],
    experience: []
  });
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await profileApi.getMe();
      setFormData({
        ...data,
        skills: data.skills ? data.skills.join(', ') : '',
        education: data.education || [],
        experience: data.experience || []
      });
    } catch (err) {
      console.error('Failed to load profile', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setNotice(null);
    try {
      // Update profile
      const profileData = {
        ...formData,
        skills: formData.skills.split(',').map(s => s.trim()).filter(s => s)
      };

      await profileApi.updateMe(profileData);
      navigate('/profile');
    } catch (err) {
      console.error('Failed to update profile', err);
      setNotice({ type: 'error', message: 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  // Simplified Education/Experience handling for MVP
  // In a real app, these would be separate components with their own forms
  const addEducation = () => {
    const newEdu = {
      school: prompt('School Name'),
      degree: prompt('Degree'),
      field_of_study: prompt('Field of Study'),
      start_date: prompt('Start Year'),
      end_date: prompt('End Year')
    };
    if (newEdu.school) {
      setFormData({ ...formData, education: [...formData.education, newEdu] });
    }
  };

  const addExperience = () => {
    const newExp = {
      company: prompt('Company Name'),
      position: prompt('Position'),
      start_date: prompt('Start Date'),
      end_date: prompt('End Date'),
      description: prompt('Description')
    };
    if (newExp.company) {
      setFormData({ ...formData, experience: [...formData.experience, newExp] });
    }
  };

  if (loading) return <div className="loading-spinner">Loading...</div>;

  return (
    <div className="profile-container">
      <Card className="edit-profile-card">
        <h2>Edit Profile</h2>
        {notice && <Alert type={notice.type}>{notice.message}</Alert>}
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h3>Basic Info</h3>
            <Input label="Full Name" name="name" value={formData.name} onChange={handleChange} />
            <Input label="Headline" name="headline" value={formData.headline} onChange={handleChange} placeholder="Software Engineer at Tech Co" />
            <div className="form-group">
              <label className="form-label">Bio</label>
              <textarea
                className="form-input"
                name="bio"
                value={formData.bio || ''}
                onChange={handleChange}
                rows="4"
              />
            </div>
            <Input label="Location" name="location" value={formData.location || ''} onChange={handleChange} />
            <Input label="LinkedIn URL" name="linkedin_url" value={formData.linkedin_url || ''} onChange={handleChange} />
          </div>

          <div className="form-section">
            <h3>Skills</h3>
            <Input
              label="Skills (comma separated)"
              name="skills"
              value={formData.skills}
              onChange={handleChange}
              placeholder="React, Python, Docker"
            />
          </div>

          <div className="form-section">
            <div className="flex justify-between items-center">
              <h3>Education</h3>
              <Button type="button" onClick={addEducation} variant="secondary" size="sm">Add Education</Button>
            </div>
            <div className="items-list">
              {formData.education.map((edu, idx) => (
                <div key={idx} className="item-preview">
                  <strong>{edu.school}</strong> - {edu.degree}
                </div>
              ))}
            </div>
          </div>

          <div className="form-section">
            <div className="flex justify-between items-center">
              <h3>Experience</h3>
              <Button type="button" onClick={addExperience} variant="secondary" size="sm">Add Experience</Button>
            </div>
            <div className="items-list">
              {formData.experience.map((exp, idx) => (
                <div key={idx} className="item-preview">
                  <strong>{exp.position}</strong> at {exp.company}
                </div>
              ))}
            </div>
          </div>

          <div className="form-actions">
            <Button type="submit">Save Changes</Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/profile')}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default EditProfile;
