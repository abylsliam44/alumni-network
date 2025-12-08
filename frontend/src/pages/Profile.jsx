import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { profileApi } from '../api/profile';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

// import SendRequestModal from '../components/mentorship/SendRequestModal';

const Profile = () => {
  const { userId } = useParams();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showMentorshipModal, setShowMentorshipModal] = useState(false);

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

  if (loading) return <div className="loading-spinner">Loading profile...</div>;
  if (error) return <div className="error-message">{error}</div>;
  if (!profile) return <div>No profile found</div>;

  return (
    <div className="profile-container">
      <div className="profile-header-card">
        <div className="profile-cover"></div>
        <div className="profile-info-section">
          <div className="profile-avatar-container">
            <img
              src={profile.photo_url ? `http://localhost:8000${profile.photo_url}` : 'https://via.placeholder.com/150'}
              alt={profile.name}
              className="profile-avatar"
            />
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
                <Button variant="primary" onClick={() => setShowMentorshipModal(true)}>
                  Request Mentorship
                </Button>
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
            alert('Request sent successfully!');
          }}
        />
      )}
    </div>
  );
};

export default Profile;
