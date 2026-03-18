import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { profileApi } from '../api/profile';
import { messagesApi } from '../api/messages';
import { connectionsApi } from '../api/connections';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/ui/Button';
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
  const [connection, setConnection] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [notice, setNotice] = useState(null);
  const [menuType, setMenuType] = useState(null);
  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const apiBase = import.meta.env.VITE_API_URL || '';

  const resolveUrl = (path) => {
    if (!path) return null;
    return path.startsWith('http') ? path : `${apiBase}${path}`;
  };

  const isOwnProfile = !userId || (currentUser && currentUser.id === userId);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  useEffect(() => {
    if (!profile?.user_id || !currentUser?.id || currentUser.id === profile.user_id) {
      setConnection(null);
      return;
    }

    const loadConnection = async () => {
      try {
        const items = await connectionsApi.list();
        const existing = (items || []).find(
          (item) =>
            (item.requester_id === currentUser.id && item.recipient_id === profile.user_id) ||
            (item.requester_id === profile.user_id && item.recipient_id === currentUser.id)
        );

        if (!existing) {
          setConnection({ status: 'NONE', direction: null, id: null });
          return;
        }

        setConnection({
          id: existing.id,
          status: existing.status,
          direction: existing.requester_id === currentUser.id ? 'out' : 'in',
        });
      } catch (err) {
        console.error('Failed to load connection status', err);
      }
    };

    loadConnection();
  }, [profile?.user_id, currentUser?.id]);

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

  const handleConnect = async () => {
    if (!profile?.user_id || connecting) return;

    setConnecting(true);
    setNotice(null);
    try {
      if (connection?.status === 'PENDING' && connection.direction === 'in' && connection.id) {
        const updated = await connectionsApi.respond(connection.id, 'ACCEPTED');
        setConnection({
          id: updated.id,
          status: updated.status,
          direction: 'in',
        });
        setNotice({ type: 'success', message: 'Connection request accepted.' });
        return;
      }

      const created = await connectionsApi.request(profile.user_id);
      setConnection({
        id: created.id,
        status: created.status,
        direction: 'out',
      });
      setNotice({ type: 'success', message: 'Connection request sent.' });
    } catch (err) {
      setNotice({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to update connection.',
      });
    } finally {
      setConnecting(false);
    }
  };

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

  // Format date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  // Calculate duration helper
  const calculateDuration = (start, end, current) => {
    if (!start) return '';
    const startDate = new Date(start);
    const endDate = current ? new Date() : new Date(end);
    const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    if (years > 0 && remainingMonths > 0) {
      return `${years} yr ${remainingMonths} mo`;
    } else if (years > 0) {
      return `${years} yr${years > 1 ? 's' : ''}`;
    } else {
      return `${remainingMonths} mo${remainingMonths > 1 ? 's' : ''}`;
    }
  };

  if (loading) return <div className="linkedin-profile-loading"><div className="loading-spinner-ring"></div><p>Loading profile...</p></div>;
  if (error) return <div className="linkedin-profile-error">{error}</div>;
  if (!profile) return <div className="linkedin-profile-error">No profile found</div>;

  const isConnected = connection?.status === 'ACCEPTED';
  const isPendingOutgoing = connection?.status === 'PENDING' && connection?.direction === 'out';
  const isPendingIncoming = connection?.status === 'PENDING' && connection?.direction === 'in';
  const careerFacts = [
    { label: 'University', values: profile.career_university ? [profile.career_university] : [] },
    { label: 'Faculty', values: profile.career_faculty ? [profile.career_faculty] : [] },
    { label: 'Skills', values: profile.skills || [] },
    { label: 'Companies', values: profile.career_companies || [] },
    { label: 'Roles', values: profile.career_roles || [] },
    { label: 'Projects', values: profile.career_projects || [] },
  ];
  const hasCareerTrajectory = careerFacts.some((section) => section.values.length > 0) || (profile.career_path || []).length > 0;
  const trajectoryStats = [
    { label: 'Stops', value: Math.max((profile.career_trajectory || []).length, (profile.career_path || []).length) },
    { label: 'Companies', value: (profile.career_companies || []).length },
    { label: 'Skills', value: (profile.skills || []).length },
  ];
  const connectLabel = isConnected
    ? 'Connected'
    : isPendingOutgoing
      ? 'Request Sent'
      : isPendingIncoming
        ? 'Accept Request'
        : connecting
          ? 'Connecting...'
          : 'Connect';
  const connectDisabled = connecting || isConnected || isPendingOutgoing;

  return (
    <div className="linkedin-profile-container">
      {notice && <Alert type={notice.type}>{notice.message}</Alert>}

      {/* Main Profile Card */}
      <div className="linkedin-profile-card">
        {/* Cover Image */}
        <div
          className="linkedin-cover"
          style={{
            backgroundImage: profile.cover_url
              ? `url(${resolveUrl(profile.cover_url)})`
              : undefined,
          }}
          onClick={() => openMenu('cover')}
        >
          {isOwnProfile && (
            <>
              <button className="linkedin-cover-edit-btn" onClick={(e) => { e.stopPropagation(); coverInputRef.current?.click(); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </button>
              <input type="file" accept="image/*" ref={coverInputRef} style={{ display: 'none' }} onChange={handleCoverUpload} />
            </>
          )}
        </div>

        {/* Profile Info Section */}
        <div className="linkedin-profile-info">
          {/* Avatar */}
          <div className="linkedin-avatar-wrapper" onClick={() => openMenu('avatar')}>
            <div className="linkedin-avatar-ring">
              <Avatar
                src={resolveUrl(profile.photo_url)}
                alt={profile.name}
                size="xl"
                className="linkedin-avatar"
              />
            </div>
            {isOwnProfile && (
              <button className="linkedin-avatar-edit-btn" onClick={(e) => { e.stopPropagation(); avatarInputRef.current?.click(); }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </button>
            )}
            <input type="file" accept="image/*" ref={avatarInputRef} style={{ display: 'none' }} onChange={handleAvatarUpload} />
          </div>

          {/* Name & Details */}
          <div className="linkedin-profile-header">
            <div className="linkedin-profile-main">
              <div className="linkedin-name-row">
                <h1 className="linkedin-name">{profile.name}</h1>
                {profile.is_verified && (
                  <span className="linkedin-verified-badge" title="Verified">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-[#0a66c2]">
                      <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" />
                    </svg>
                  </span>
                )}
              </div>
              <p className="linkedin-headline">{profile.headline || profile.role || 'Add a headline'}</p>
              <p className="linkedin-location">
                {profile.location && (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    {profile.location}
                  </>
                )}
                {profile.location && profile.graduation_year && <span className="linkedin-dot">•</span>}
                {profile.graduation_year && (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                      <path d="M6 12v5c3 3 9 3 12 0v-5" />
                    </svg>
                    Class of {profile.graduation_year}
                  </>
                )}
              </p>

              {/* Contact & Social Links */}
              <div className="linkedin-contact-row">
                {profile.linkedin_url && (
                  <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="linkedin-social-link">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                    LinkedIn
                  </a>
                )}
                {profile.email && (
                  <a href={`mailto:${profile.email}`} className="linkedin-social-link">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    Contact info
                  </a>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="linkedin-profile-actions">
              {isOwnProfile ? (
                <>
                  <Link to="/profile/edit">
                    <Button variant="primary" className="linkedin-btn-primary">Edit profile</Button>
                  </Link>
                  <Link to="/profile/resume-import">
                    <Button variant="secondary" className="linkedin-btn-secondary">Import Resume</Button>
                  </Link>
                </>
              ) : (
                <>
                  <Button
                    variant="primary"
                    className="linkedin-btn-primary"
                    onClick={handleConnect}
                    disabled={connectDisabled}
                  >
                    {connectLabel}
                  </Button>
                  <Button
                    variant="secondary"
                    className="linkedin-btn-secondary"
                    onClick={startConversation}
                    disabled={!isConnected}
                  >
                    Message
                  </Button>
                  {profile.is_mentor && (
                    <Button
                      variant="secondary"
                      className="linkedin-btn-more"
                      onClick={() => {
                        if (!mentorshipRequested) setShowMentorshipModal(true);
                      }}
                      disabled={mentorshipRequested}
                    >
                      {mentorshipRequested ? 'Mentorship Sent' : 'Request Mentorship'}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Card (own profile only) */}
      {isOwnProfile && (
        <div className="linkedin-section-card linkedin-analytics-card">
          <h2 className="linkedin-section-title">Analytics</h2>
          <p className="linkedin-analytics-subtitle">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Private to you
          </p>
          <div className="linkedin-analytics-grid">
            <div className="linkedin-analytics-item">
              <span className="linkedin-analytics-number">0</span>
              <span className="linkedin-analytics-label">Profile views</span>
              <span className="linkedin-analytics-desc">Discover who's viewed your profile</span>
            </div>
            <div className="linkedin-analytics-item">
              <span className="linkedin-analytics-number">0</span>
              <span className="linkedin-analytics-label">Post impressions</span>
              <span className="linkedin-analytics-desc">Check out who's engaging with your posts</span>
            </div>
            <div className="linkedin-analytics-item">
              <span className="linkedin-analytics-number">0</span>
              <span className="linkedin-analytics-label">Search appearances</span>
              <span className="linkedin-analytics-desc">See how often you appear in search results</span>
            </div>
          </div>
        </div>
      )}

      {/* About Section */}
      <div className="linkedin-section-card">
        <div className="linkedin-section-header">
          <h2 className="linkedin-section-title">About</h2>
          {isOwnProfile && (
            <Link to="/profile/edit" className="linkedin-edit-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </Link>
          )}
        </div>
        {profile.bio ? (
          <p className="linkedin-about-text">{profile.bio}</p>
        ) : (
          <p className="linkedin-empty-text">
            {isOwnProfile ? 'Add a summary to tell people about yourself' : 'No bio added yet'}
          </p>
        )}
      </div>

      {hasCareerTrajectory && (
        <div className="linkedin-section-card">
          <div className="linkedin-trajectory-shell">
            <div className="linkedin-trajectory-overview">
              <span className="linkedin-trajectory-kicker">Verified Alumni Route</span>
              <div className="linkedin-trajectory-heading-row">
                <div>
                  <h2 className="linkedin-section-title">Career Trajectory</h2>
                  <p className="linkedin-section-subtitle">A confirmed path built from structured career records, not raw resume text.</p>
                </div>
                <div className="linkedin-trajectory-stat-strip">
                  {trajectoryStats.map((item) => (
                    <div key={item.label} className="linkedin-trajectory-stat-pill">
                      <strong>{item.value}</strong>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {(profile.career_path || []).length > 0 && (
                <div className="linkedin-trajectory-ribbon">
                  {(profile.career_path || []).map((step, index) => (
                    <div key={`${step}-${index}`} className="linkedin-trajectory-ribbon-step">
                      <span>{step}</span>
                      {index < profile.career_path.length - 1 && <i aria-hidden="true">→</i>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="linkedin-trajectory-grid">
              <div className="linkedin-trajectory-facts">
                {careerFacts.map((section) => (
                  <div key={section.label} className="linkedin-trajectory-fact-card">
                    <div className="linkedin-trajectory-fact-header">
                      <h3>{section.label}</h3>
                      {section.values.length > 0 && <span>{section.values.length}</span>}
                    </div>
                    {section.values.length > 0 ? (
                      <div className="linkedin-trajectory-chip-list">
                        {section.values.map((value) => (
                          <span key={`${section.label}-${value}`} className="linkedin-trajectory-chip">{value}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="linkedin-trajectory-empty">No confirmed data yet</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="linkedin-trajectory-preview">
                <div className="linkedin-trajectory-preview-header">
                  <div>
                    <span className="linkedin-trajectory-preview-eyebrow">Path Preview</span>
                    <h3>{profile.name}</h3>
                    <p>{profile.headline || 'Structured career graph preview'}</p>
                  </div>
                </div>

                {profile.career_trajectory?.length > 0 && (
                  <div className="linkedin-trajectory-map">
                    {profile.career_trajectory.map((step, index) => (
                      <div
                        key={`${step.label}-${index}`}
                        className={`linkedin-trajectory-map-item ${step.type === 'UNIVERSITY' ? 'is-origin' : ''} ${step.current ? 'is-current' : ''}`}
                      >
                        <div className="linkedin-trajectory-node">
                          <span>{index + 1}</span>
                        </div>
                        <div className="linkedin-trajectory-node-card">
                          <div className="linkedin-trajectory-node-meta">
                            <em>{step.type === 'UNIVERSITY' ? 'Academic base' : (step.current ? 'Current role' : 'Career move')}</em>
                            {step.company && <small>{step.company}</small>}
                          </div>
                          <strong>{step.label}</strong>
                          {(step.start_date || step.end_date || step.current) && (
                            <span>
                              {step.start_date || 'Unknown'} - {step.current ? 'Present' : (step.end_date || 'Unknown')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Experience Section */}
      <div className="linkedin-section-card">
        <div className="linkedin-section-header">
          <h2 className="linkedin-section-title">Experience</h2>
          {isOwnProfile && (
            <Link to="/profile/edit" className="linkedin-edit-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </Link>
          )}
        </div>
        {profile.experience && profile.experience.length > 0 ? (
          <div className="linkedin-experience-list">
            {profile.experience.map((exp, index) => (
              <div key={index} className="linkedin-experience-item">
                <div className="linkedin-exp-logo">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </div>
                <div className="linkedin-exp-details">
                  <h3 className="linkedin-exp-title">{exp.position}</h3>
                  <p className="linkedin-exp-company">{exp.company}</p>
                  <p className="linkedin-exp-date">
                    {formatDate(exp.start_date)} - {exp.current ? 'Present' : formatDate(exp.end_date)}
                    {' · '}
                    {calculateDuration(exp.start_date, exp.end_date, exp.current)}
                  </p>
                  {exp.location && <p className="linkedin-exp-location">{exp.location}</p>}
                  {exp.description && <p className="linkedin-exp-description">{exp.description}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="linkedin-empty-text">
            {isOwnProfile ? 'Add your work experience to showcase your career journey' : 'No experience added yet'}
          </p>
        )}
      </div>

      {/* Education Section */}
      <div className="linkedin-section-card">
        <div className="linkedin-section-header">
          <h2 className="linkedin-section-title">Education</h2>
          {isOwnProfile && (
            <Link to="/profile/edit" className="linkedin-edit-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </Link>
          )}
        </div>
        {profile.education && profile.education.length > 0 ? (
          <div className="linkedin-education-list">
            {profile.education.map((edu, index) => (
              <div key={index} className="linkedin-education-item">
                <div className="linkedin-edu-logo">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c3 3 9 3 12 0v-5" />
                  </svg>
                </div>
                <div className="linkedin-edu-details">
                  <h3 className="linkedin-edu-school">{edu.school}</h3>
                  <p className="linkedin-edu-degree">{edu.degree}{edu.field_of_study && `, ${edu.field_of_study}`}</p>
                  <p className="linkedin-edu-date">
                    {edu.start_date && formatDate(edu.start_date)}
                    {edu.start_date && edu.end_date && ' - '}
                    {edu.end_date && formatDate(edu.end_date)}
                  </p>
                  {edu.grade && <p className="linkedin-edu-grade">Grade: {edu.grade}</p>}
                  {edu.activities && <p className="linkedin-edu-activities">Activities: {edu.activities}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="linkedin-empty-text">
            {isOwnProfile ? 'Add your educational background' : 'No education added yet'}
          </p>
        )}
      </div>

      {/* Skills Section */}
      <div className="linkedin-section-card">
        <div className="linkedin-section-header">
          <h2 className="linkedin-section-title">Skills</h2>
          {isOwnProfile && (
            <Link to="/profile/edit" className="linkedin-edit-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </Link>
          )}
        </div>
        {profile.skills && profile.skills.length > 0 ? (
          <div className="linkedin-skills-list">
            {profile.skills.map((skill, index) => (
              <div key={index} className="linkedin-skill-item">
                <span className="linkedin-skill-name">{skill}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="linkedin-empty-text">
            {isOwnProfile ? 'Add skills to show your expertise' : 'No skills added yet'}
          </p>
        )}
      </div>

      {/* Mentorship Modal */}
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

      {/* Image Menu Modal */}
      {menuType && (
        <div className="modal-overlay" onClick={closeMenu}>
          <div className="linkedin-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="linkedin-modal-header">
              <h3>{menuType === 'avatar' ? 'Profile photo' : 'Cover image'}</h3>
              <button className="linkedin-modal-close" onClick={closeMenu}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="linkedin-modal-body">
              <button
                className="linkedin-modal-action"
                onClick={() => {
                  openImage(menuType);
                  closeMenu();
                }}
                disabled={menuType === 'avatar' ? !profile.photo_url : !profile.cover_url}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                View image
              </button>
              {isOwnProfile && (
                <>
                  <button
                    className="linkedin-modal-action"
                    onClick={() => {
                      if (menuType === 'avatar') {
                        avatarInputRef.current?.click();
                      } else {
                        coverInputRef.current?.click();
                      }
                      closeMenu();
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    Change {menuType === 'avatar' ? 'photo' : 'cover'}
                  </button>
                  {((menuType === 'avatar' && profile.photo_url) || (menuType === 'cover' && profile.cover_url)) && (
                    <button
                      className="linkedin-modal-action linkedin-modal-action-danger"
                      onClick={() => {
                        if (menuType === 'avatar') handleDeletePhoto();
                        else handleDeleteCover();
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      Delete {menuType === 'avatar' ? 'photo' : 'cover'}
                    </button>
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
