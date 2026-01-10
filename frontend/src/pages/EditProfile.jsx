import { useState, useEffect, useRef } from 'react';
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
    github_url: '',
    website_url: '',
    graduation_year: '',
    availability: '',
    skills: '',
    education: [],
    experience: [],
    // Mentor fields
    mentor_consent: false,
    mentor_headline: '',
    mentor_areas_of_help: [], // Array
    mentor_industries: [], // Array
    mentor_max_mentees: '',
    mentor_availability_note: ''
  });

  // Photo previews
  const [photoPreview, setPhotoPreview] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);

  const [notice, setNotice] = useState(null);

  // Modal states
  const [showEduModal, setShowEduModal] = useState(false);
  const [showExpModal, setShowExpModal] = useState(false);
  const [currentEdu, setCurrentEdu] = useState({});
  const [currentExp, setCurrentExp] = useState({});
  const [editIndex, setEditIndex] = useState(-1);

  // Image error states
  const [avatarError, setAvatarError] = useState(false);
  const [coverError, setCoverError] = useState(false);

  // Profile completion calculation
  const calculateCompletion = () => {
    const checks = [
      { label: 'Name', done: Boolean(formData.name?.trim()) },
      { label: 'Headline', done: Boolean(formData.headline?.trim()) },
      { label: 'Bio', done: Boolean(formData.bio?.trim()) },
      { label: 'Location', done: Boolean(formData.location?.trim()) },
      { label: 'Skills', done: Boolean(formData.skills?.trim?.() || formData.skills?.length) },
      { label: 'Experience', done: formData.experience?.length > 0 },
      { label: 'Education', done: formData.education?.length > 0 },
      { label: 'Photo', done: Boolean(photoPreview) },
      { label: 'Graduation Year', done: Boolean(formData.graduation_year) },
    ];
    const completed = checks.filter(c => c.done).length;
    const percent = Math.round((completed / checks.length) * 100);
    const missing = checks.filter(c => !c.done).map(c => c.label);
    return { percent, completed, total: checks.length, missing };
  };

  const completion = calculateCompletion();

  useEffect(() => {
    loadProfile();
  }, []);

  const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const baseUrl = import.meta.env.VITE_API_URL || '';
    return `${baseUrl}${url}`;
  };

  const loadProfile = async () => {
    try {
      const data = await profileApi.getMe();
      setFormData({
        ...data,
        skills: data.skills ? data.skills.join(', ') : '',
        mentor_areas_of_help: data.mentor_areas_of_help || [],
        mentor_industries: data.mentor_industries || [],
        education: data.education || [],
        experience: data.experience || [],
        // Ensure strings for inputs
        graduation_year: data.graduation_year || '',
        mentor_max_mentees: data.mentor_max_mentees || '',
        github_url: data.github_url || '',
        website_url: data.website_url || '',
        headline: data.headline || '',
        availability: data.availability || ''
      });
      setPhotoPreview(getImageUrl(data.photo_url));
      setCoverPreview(getImageUrl(data.cover_url));
      // Reset error states on load
      setAvatarError(false);
      setCoverError(false);
    } catch (err) {
      console.error('Failed to load profile', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handlePhotoUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      let res;
      if (type === 'avatar') {
        res = await profileApi.uploadPhoto(file);
        setPhotoPreview(getImageUrl(res.photo_url));
        setAvatarError(false);
      } else {
        res = await profileApi.uploadCover(file);
        setCoverPreview(getImageUrl(res.cover_url));
        setCoverError(false);
      }
      // Update form data to match new profile state if needed
    } catch (err) {
      console.error('Upload failed', err);
      setNotice({ type: 'error', message: `Failed to upload ${type}` });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setNotice(null);
    try {
      const payload = {
        ...formData,
        skills: typeof formData.skills === 'string'
          ? formData.skills.split(',').map(s => s.trim()).filter(s => s)
          : formData.skills,
        graduation_year: formData.graduation_year ? parseInt(formData.graduation_year) : null,
        mentor_max_mentees: formData.mentor_max_mentees ? parseInt(formData.mentor_max_mentees) : null,
        // Arrays are already arrays if we processed them, or strings? 
        // Let's ensure they are arrays.
        mentor_areas_of_help: Array.isArray(formData.mentor_areas_of_help) ? formData.mentor_areas_of_help : [],
        mentor_industries: Array.isArray(formData.mentor_industries) ? formData.mentor_industries : [],
      };

      await profileApi.updateMe(payload);
      navigate('/profile');
    } catch (err) {
      console.error('Failed to update profile', err);
      setNotice({ type: 'error', message: 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  // Education Handlers
  const openEduModal = (edu = null, index = -1) => {
    setCurrentEdu(edu || { school: '', degree: '', field_of_study: '', start_date: '', end_date: '', description: '', current: false });
    setEditIndex(index);
    setShowEduModal(true);
  };

  const saveEducation = () => {
    const newEduList = [...formData.education];
    if (editIndex >= 0) newEduList[editIndex] = currentEdu;
    else newEduList.push(currentEdu);
    setFormData({ ...formData, education: newEduList });
    setShowEduModal(false);
  };

  const removeEducation = (index) => {
    setFormData({ ...formData, education: formData.education.filter((_, i) => i !== index) });
  };

  // Experience Handlers
  const openExpModal = (exp = null, index = -1) => {
    setCurrentExp(exp || { company: '', position: '', location: '', start_date: '', end_date: '', description: '', current: false });
    setEditIndex(index);
    setShowExpModal(true);
  };

  const saveExperience = () => {
    const newExpList = [...formData.experience];
    if (editIndex >= 0) newExpList[editIndex] = currentExp;
    else newExpList.push(currentExp);
    setFormData({ ...formData, experience: newExpList });
    setShowExpModal(false);
  };

  const removeExperience = (index) => {
    setFormData({ ...formData, experience: formData.experience.filter((_, i) => i !== index) });
  };

  if (loading) return <div className="dash-loading"><div className="dash-loader"></div></div>;

  return (
    <div className="profile-edit-body">
      <div className="profile-edit-container">
        <div className="profile-edit-header">
          <h1>Edit Profile</h1>
          <p>Customize your profile to stand out to recruiters and peers.</p>

          {/* Profile Completion Progress */}
          <div className="profile-completion-card">
            <div className="completion-header">
              <span className="completion-label">Profile Completion</span>
              <span className="completion-percent">{completion.percent}%</span>
            </div>
            <div className="completion-bar-track">
              <div
                className="completion-bar-fill"
                style={{
                  width: `${completion.percent}%`,
                  backgroundColor: completion.percent === 100 ? '#22c55e' :
                    completion.percent >= 70 ? '#3b82f6' :
                      completion.percent >= 40 ? '#f59e0b' : '#ef4444'
                }}
              />
            </div>
            {completion.missing.length > 0 && (
              <div className="completion-missing">
                <span className="missing-label">Add to improve:</span>
                <div className="missing-tags">
                  {completion.missing.slice(0, 4).map(field => (
                    <span key={field} className="missing-tag">{field}</span>
                  ))}
                  {completion.missing.length > 4 && (
                    <span className="missing-tag more">+{completion.missing.length - 4} more</span>
                  )}
                </div>
              </div>
            )}
            {completion.percent === 100 && (
              <div className="completion-success">
                ✓ Your profile is complete! You're all set.
              </div>
            )}
          </div>
        </div>

        {notice && <Alert type={notice.type}>{notice.message}</Alert>}

        <form onSubmit={handleSubmit} id="edit-profile-form">
          <div className="profile-edit-grid">

            {/* Left Column: Photos & Basic Info */}
            <div className="left-col">
              <div className="edit-card photo-card">
                <h3>Profile Images</h3>

                {/* Cover Photo */}
                <div className="cover-photo-wrapper">
                  {coverPreview && !coverError ? (
                    <img
                      src={coverPreview}
                      alt="Cover"
                      onError={() => setCoverError(true)}
                    />
                  ) : (
                    <div className="cover-placeholder-art">
                      <div className="art-pattern"></div>
                    </div>
                  )}

                  <label className="cover-upload-btn">
                    <input type="file" hidden accept="image/*" onChange={(e) => handlePhotoUpload(e, 'cover')} />
                    📷 Edit Cover
                  </label>
                </div>

                {/* Avatar */}
                <div className="avatar-wrapper">
                  <div className="avatar-circle">
                    {photoPreview && !avatarError ? (
                      <img
                        src={photoPreview}
                        alt="Avatar"
                        onError={() => setAvatarError(true)}
                      />
                    ) : (
                      <div className="avatar-fallback">
                        {formData.name ? formData.name.charAt(0).toUpperCase() : '?'}
                      </div>
                    )}
                    <label className="avatar-upload-icon">
                      <input type="file" hidden accept="image/*" onChange={(e) => handlePhotoUpload(e, 'avatar')} />
                      ✏️
                    </label>
                  </div>
                </div>
              </div>

              <div className="edit-card">
                <h3>Basic Information</h3>
                <div className="form-stack">
                  <Input label="Full Name" name="name" value={formData.name || ''} onChange={handleChange} />
                  <Input label="Headline" name="headline" value={formData.headline || ''} onChange={handleChange} placeholder="e.g. Senior Software Engineer" />
                  <Input label="Location" name="location" value={formData.location || ''} onChange={handleChange} placeholder="e.g. San Francisco, CA" />
                  <div className="form-row-2">
                    <Input label="Graduation Year" type="number" name="graduation_year" value={formData.graduation_year || ''} onChange={handleChange} />
                    <div className="form-group">
                      <label className="form-label">Availability</label>
                      <select className="form-select" name="availability" value={formData.availability || ''} onChange={handleChange}>
                        <option value="">Select status...</option>
                        <option value="JOB_SEEKING">Job Seeking</option>
                        <option value="HIRING">Hiring</option>
                        <option value="MENTORING">Mentoring</option>
                        <option value="OPEN_TO_CONNECT">Open to Connect</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="edit-card">
                <h3>Social Links</h3>
                <div className="form-stack">
                  <Input label="LinkedIn" name="linkedin_url" value={formData.linkedin_url || ''} onChange={handleChange} placeholder="https://linkedin.com/in/..." />
                  <Input label="GitHub" name="github_url" value={formData.github_url || ''} onChange={handleChange} placeholder="https://github.com/..." />
                  <Input label="Website" name="website_url" value={formData.website_url || ''} onChange={handleChange} placeholder="https://..." />
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="right-col">

              <div className="edit-card">
                <h3>About You</h3>
                <div className="form-group">
                  <label className="form-label">Bio</label>
                  <textarea
                    className="form-textarea"
                    name="bio"
                    value={formData.bio || ''}
                    onChange={handleChange}
                    rows="6"
                    placeholder="Write a short biography..."
                  />
                </div>
              </div>

              <div className="edit-card">
                <h3>Skills</h3>
                <Input
                  label="Skills (comma separated)"
                  name="skills"
                  value={formData.skills}
                  onChange={handleChange}
                  placeholder="React, Node.js, Design..."
                />
              </div>

              {/* Mentorship Section */}
              <div className="edit-card">
                <div className="card-header-row mb-4">
                  <h3>Mentorship</h3>
                  <label className="switch-toggle">
                    <input type="checkbox" name="mentor_consent" checked={formData.mentor_consent} onChange={handleChange} />
                    <span className="slider"></span>
                    <span className="label-text">Available as Mentor</span>
                  </label>
                </div>

                {formData.mentor_consent && (
                  <div className="mentor-fields fade-in">
                    <Input label="Mentor Headline" name="mentor_headline" value={formData.mentor_headline || ''} onChange={handleChange} placeholder="How can you help?" />
                    <Input label="Areas of Help (comma separated)" value={formData.mentor_areas_of_help.join(', ')} onChange={(e) => setFormData({ ...formData, mentor_areas_of_help: e.target.value.split(',').map(s => s.trim()) })} />
                    <Input label="Industries (comma separated)" value={formData.mentor_industries.join(', ')} onChange={(e) => setFormData({ ...formData, mentor_industries: e.target.value.split(',').map(s => s.trim()) })} />
                    <Input label="Max Mentees" type="number" name="mentor_max_mentees" value={formData.mentor_max_mentees || ''} onChange={handleChange} />
                  </div>
                )}
              </div>

              {/* Education Section */}
              <div className="edit-card">
                <div className="card-header-row mb-4">
                  <h3>Education</h3>
                  <button type="button" onClick={() => openEduModal()} className="btn-icon-add">+</button>
                </div>

                <div className="list-items-container">
                  {formData.education.map((edu, idx) => (
                    <div key={idx} className="list-item">
                      <div className="list-item-main">
                        <h4>{edu.school}</h4>
                        <p>{edu.degree} {edu.field_of_study && `• ${edu.field_of_study}`}</p>
                        <span className="list-meta">{edu.start_date} - {edu.current ? 'Present' : edu.end_date}</span>
                      </div>
                      <div className="list-actions">
                        <button type="button" className="btn-icon" onClick={() => openEduModal(edu, idx)}>✎</button>
                        <button type="button" className="btn-icon danger" onClick={() => removeEducation(idx)}>✕</button>
                      </div>
                    </div>
                  ))}
                  {formData.education.length === 0 && <div className="empty-list">No education added</div>}
                </div>
              </div>

              {/* Experience Section */}
              <div className="edit-card">
                <div className="card-header-row mb-4">
                  <h3>Experience</h3>
                  <button type="button" onClick={() => openExpModal()} className="btn-icon-add">+</button>
                </div>

                <div className="list-items-container">
                  {formData.experience.map((exp, idx) => (
                    <div key={idx} className="list-item">
                      <div className="list-item-main">
                        <h4>{exp.position}</h4>
                        <p>{exp.company} {exp.location && `• ${exp.location}`}</p>
                        <span className="list-meta">{exp.start_date} - {exp.current ? 'Present' : exp.end_date}</span>
                      </div>
                      <div className="list-actions">
                        <button type="button" className="btn-icon" onClick={() => openExpModal(exp, idx)}>✎</button>
                        <button type="button" className="btn-icon danger" onClick={() => removeExperience(idx)}>✕</button>
                      </div>
                    </div>
                  ))}
                  {formData.experience.length === 0 && <div className="empty-list">No experience added</div>}
                </div>
              </div>

            </div>
          </div>
        </form>

        {/* Sticky Form Actions Footer */}
        <div className="sticky-form-footer">
          <div className="footer-content">
            <Button type="button" variant="secondary" onClick={() => navigate('/profile')}>Cancel</Button>
            <Button type="submit" form="edit-profile-form">Save Changes</Button>
          </div>
        </div>
      </div>

      {/* Reused Modal Logic */}
      {showEduModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editIndex >= 0 ? 'Edit' : 'Add'} Education</h3>
              <button onClick={() => setShowEduModal(false)} className="modal-close-btn">✕</button>
            </div>
            <div className="modal-body">
              <Input label="School" value={currentEdu.school} onChange={(e) => setCurrentEdu({ ...currentEdu, school: e.target.value })} />
              <Input label="Degree" value={currentEdu.degree} onChange={(e) => setCurrentEdu({ ...currentEdu, degree: e.target.value })} />
              <Input label="Field of Study" value={currentEdu.field_of_study} onChange={(e) => setCurrentEdu({ ...currentEdu, field_of_study: e.target.value })} />
              <div className="form-row-2">
                <Input label="Start Date" value={currentEdu.start_date} onChange={(e) => setCurrentEdu({ ...currentEdu, start_date: e.target.value })} placeholder="YYYY" />
                <Input label="End Date" value={currentEdu.end_date} onChange={(e) => setCurrentEdu({ ...currentEdu, end_date: e.target.value })} placeholder="YYYY" disabled={currentEdu.current} />
              </div>
              <label className="checkbox-wrap">
                <input type="checkbox" checked={currentEdu.current || false} onChange={(e) => setCurrentEdu({ ...currentEdu, current: e.target.checked })} />
                <span>I currently study here</span>
              </label>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" rows="3" value={currentEdu.description || ''} onChange={(e) => setCurrentEdu({ ...currentEdu, description: e.target.value })}></textarea>
              </div>
            </div>
            <div className="modal-footer">
              <Button type="button" variant="secondary" onClick={() => setShowEduModal(false)}>Cancel</Button>
              <Button type="button" onClick={saveEducation}>Save Education</Button>
            </div>
          </div>
        </div>
      )}

      {showExpModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editIndex >= 0 ? 'Edit' : 'Add'} Experience</h3>
              <button onClick={() => setShowExpModal(false)} className="modal-close-btn">✕</button>
            </div>
            <div className="modal-body">
              <Input label="Company" value={currentExp.company} onChange={(e) => setCurrentExp({ ...currentExp, company: e.target.value })} />
              <Input label="Position" value={currentExp.position} onChange={(e) => setCurrentExp({ ...currentExp, position: e.target.value })} />
              <Input label="Location" value={currentExp.location} onChange={(e) => setCurrentExp({ ...currentExp, location: e.target.value })} />
              <div className="form-row-2">
                <Input label="Start Date" value={currentExp.start_date} onChange={(e) => setCurrentExp({ ...currentExp, start_date: e.target.value })} placeholder="Jan 2022" />
                <Input label="End Date" value={currentExp.end_date} onChange={(e) => setCurrentExp({ ...currentExp, end_date: e.target.value })} placeholder="Present" disabled={currentExp.current} />
              </div>
              <label className="checkbox-wrap">
                <input type="checkbox" checked={currentExp.current || false} onChange={(e) => setCurrentExp({ ...currentExp, current: e.target.checked })} />
                <span>I currently work here</span>
              </label>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" rows="3" value={currentExp.description || ''} onChange={(e) => setCurrentExp({ ...currentExp, description: e.target.value })}></textarea>
              </div>
            </div>
            <div className="modal-footer">
              <Button type="button" variant="secondary" onClick={() => setShowExpModal(false)}>Cancel</Button>
              <Button type="button" onClick={saveExperience}>Save Experience</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditProfile;
