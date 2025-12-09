import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { profileApi } from '../api/profile';
import { messagesApi } from '../api/messages';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Alert from '../components/ui/Alert';
import Avatar from '../components/ui/Avatar';
import SendRequestModal from '../components/mentorship/SendRequestModal';


const Profile = () => {
  const { userId } = useParams();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showMentorshipModal, setShowMentorshipModal] = useState(false);
  const [mentorshipRequested, setMentorshipRequested] = useState(false);
  const [notice, setNotice] = useState(null);
  const [menuType, setMenuType] = useState(null); // 'avatar' | 'cover'
  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const resolveUrl = (path) => {
    if (!path) return null;
    return path.startsWith('http') ? path : `${apiBase}${path}`;
  };

  const isOwnProfile = !userId || (currentUser && currentUser.id === userId);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    try {
      let data;
      if (userId) {
        data = await profileApi.getUserProfile(userId);
      } else {
        data = await profileApi.getMe();
      }
      setProfile(data);
    } catch (err) {
      setError('Failed to load profile');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const startConversation = async () => {
    if (!profile?.user_id) return;
    try {
      const convo = await messagesApi.startConversation(profile.user_id);
      navigate(`/messages?chat=${convo.conversation_id}`);
    } catch (err) {
      setNotice({
        type: 'error',
        message: err.response?.data?.detail || 'Unable to start conversation. You need to be friends first.',
      });
    }
  };

  if (loading) return <div className="loading-spinner">Loading profile...</div>;
  if (error) return <div className="error-message">{error}</div>;
  if (!profile) return <div>No profile found</div>;

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setNotice(null);
      const updated = await profileApi.uploadPhoto(file);
      setProfile(updated);
      setNotice({ type: 'success', message: 'Avatar updated' });
    } catch (err) {
      setNotice({ type: 'error', message: err.response?.data?.detail || 'Failed to upload avatar' });
    }
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setNotice(null);
      const updated = await profileApi.uploadCover(file);
      setProfile(updated);
      setNotice({ type: 'success', message: 'Cover updated' });
    } catch (err) {
      setNotice({ type: 'error', message: err.response?.data?.detail || 'Failed to upload cover' });
    }
  };

  const handleDeletePhoto = async () => {
    try {
      setNotice(null);
      const updated = await profileApi.deletePhoto();
      setProfile(updated);
      setNotice({ type: 'success', message: 'Avatar removed' });
      closeMenu();
    } catch (err) {
      setNotice({ type: 'error', message: err.response?.data?.detail || 'Failed to remove avatar' });
    }
  };

  const handleDeleteCover = async () => {
    try {
      setNotice(null);
      const updated = await profileApi.deleteCover();
      setProfile(updated);
      setNotice({ type: 'success', message: 'Cover removed' });
      closeMenu();
    } catch (err) {
      setNotice({ type: 'error', message: err.response?.data?.detail || 'Failed to remove cover' });
    }
  };

  const openImage = (type) => {
    const url =
      type === 'avatar'
        ? resolveUrl(profile.photo_url)
        : resolveUrl(profile.cover_url);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openMenu = (type) => setMenuType(type);
  const closeMenu = () => setMenuType(null);

  return (
    <div className="profile-container">
      {notice && <Alert type={notice.type}>{notice.message}</Alert>}
      <div className="profile-header-card">
        <div
          className="profile-cover"
          style={{
            backgroundImage: profile.cover_url
              ? `url(${resolveUrl(profile.cover_url)})`
              : 'linear-gradient(135deg, #1f2937, #0f172a)',
          }}
          onClick={() => openMenu('cover')}
        >
          {isOwnProfile && (
            <input
              type="file"
              accept="image/*"
              ref={coverInputRef}
              style={{ display: 'none' }}
              onChange={handleCoverUpload}
            />
          )}
        </div>
        <div className="profile-info-section">
          <div className="profile-avatar-container" onClick={() => openMenu('avatar')}>
            <Avatar
              src={resolveUrl(profile.photo_url)}
              alt={profile.name}
              size="xl"
              className="profile-avatar"
            />
            {isOwnProfile && (
              <input
                type="file"
                accept="image/*"
                ref={avatarInputRef}
                style={{ display: 'none' }}
                onChange={handleAvatarUpload}
              />
            )}
          </div>
          <div className="profile-details">
            <h1>{profile.name}</h1>
            <p className="profile-headline">{profile.headline || profile.role}</p>
            <p className="profile-location">{profile.location || 'Location not set'}</p>
            <div className="profile-actions">
              {isOwnProfile ? (
                <Link to="/profile/edit">
                  <Button variant="secondary">Edit Profile</Button>
                </Link>
              ) : (
                <>
                <Button
                  variant="primary"
                  onClick={() => {
                    if (!mentorshipRequested) setShowMentorshipModal(true);
                  }}
                  disabled={mentorshipRequested}
                >
                  {mentorshipRequested ? 'Request Sent' : 'Request Mentorship'}
                </Button>
                  <Button variant="secondary" onClick={startConversation} style={{ marginLeft: 8 }}>
                    Message
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="profile-grid">
        <div className="profile-main">
          <Card className="mb-4">
            <h3>About</h3>
            <p>{profile.bio || 'No bio yet.'}</p>
          </Card>

          <Card className="mb-4">
            <h3>Experience</h3>
            {profile.experience && profile.experience.length > 0 ? (
              <div className="experience-list">
                {profile.experience.map((exp, index) => (
                  <div key={index} className="experience-item">
                    <h4>{exp.position}</h4>
                    <p className="company">{exp.company}</p>
                    <p className="date">{exp.start_date} - {exp.current ? 'Present' : exp.end_date}</p>
                    <p>{exp.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted">No experience added.</p>
            )}
          </Card>

          <Card className="mb-4">
            <h3>Education</h3>
            {profile.education && profile.education.length > 0 ? (
              <div className="education-list">
                {profile.education.map((edu, index) => (
                  <div key={index} className="education-item">
                    <h4>{edu.school}</h4>
                    <p>{edu.degree}, {edu.field_of_study}</p>
                    <p className="date">{edu.start_date} - {edu.end_date}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted">No education added.</p>
            )}
          </Card>
        </div>

        <div className="profile-sidebar">
          <Card className="mb-4">
            <h3>Skills</h3>
            <div className="skills-list">
              {profile.skills && profile.skills.length > 0 ? (
                profile.skills.map((skill, index) => (
                  <span key={index} className="skill-tag">{skill}</span>
                ))
              ) : (
                <p className="text-muted">No skills added.</p>
              )}
            </div>
          </Card>

          <Card>
            <h3>Contact</h3>
            <div className="contact-links">
              {profile.linkedin_url && (
                <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer">LinkedIn</a>
              )}
              {profile.email && (
                <a href={`mailto:${profile.email}`}>Email</a>
              )}
            </div>
          </Card>
        </div>
      </div>

      {showMentorshipModal && (
        <SendRequestModal
          receiver={profile}
          onClose={() => setShowMentorshipModal(false)}
          onSuccess={() => {
            setNotice({ type: 'success', message: 'Request sent successfully!' });
            setMentorshipRequested(true);
            setShowMentorshipModal(false);
          }}
        />
      )}

      {menuType && (
        <div className="modal-overlay" onClick={closeMenu}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{menuType === 'avatar' ? 'Profile photo' : 'Cover image'}</h3>
              <button className="close-btn" onClick={closeMenu}>&times;</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Button
                variant="primary"
                onClick={() => {
                  openImage(menuType);
                  closeMenu();
                }}
                disabled={
                  menuType === 'avatar'
                    ? !profile.photo_url
                    : !profile.cover_url
                }
              >
                View image
              </Button>
              {isOwnProfile && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (menuType === 'avatar') {
                        avatarInputRef.current?.click();
                      } else {
                        coverInputRef.current?.click();
                      }
                      closeMenu();
                    }}
                  >
                    Change {menuType === 'avatar' ? 'avatar' : 'cover'}
                  </Button>
                  
                  {((menuType === 'avatar' && profile.photo_url) || (menuType === 'cover' && profile.cover_url)) && (
                     <Button
                       variant="secondary" 
                       style={{ borderColor: '#ef4444', color: '#ef4444' }}
                       onClick={() => {
                         if (menuType === 'avatar') handleDeletePhoto();
                         else handleDeleteCover();
                       }}
                     >
                       Delete {menuType === 'avatar' ? 'avatar' : 'cover'}
                     </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
