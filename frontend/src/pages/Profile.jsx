import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { profileApi } from '../api/profile';
import { messagesApi } from '../api/messages';
import { connectionsApi } from '../api/connections';
import { mentorshipApi } from '../api/mentorship';
import { useAuth } from '../hooks/useAuth';
import Avatar from '../components/ui/Avatar';
import Pill from '../components/ui/Pill';
import Icon from '../components/ui/Icon';
import Alert from '../components/ui/Alert';
import SendRequestModal from '../components/mentorship/SendRequestModal';
import { resolveUrl } from '../utils/image';

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const calculateDuration = (start, end, current) => {
  if (!start) return '';
  const startDate = new Date(start);
  const endDate = current ? new Date() : new Date(end);
  const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years > 0 && remainingMonths > 0) return `${years} yr ${remainingMonths} mo`;
  if (years > 0) return `${years} yr${years > 1 ? 's' : ''}`;
  return `${remainingMonths} mo${remainingMonths > 1 ? 's' : ''}`;
};

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
  const [activeTab, setActiveTab] = useState('about');
  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);

  const isOwnProfile = !userId || (currentUser && currentUser.id === userId);

  useEffect(() => { loadProfile(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [userId]);

  useEffect(() => {
    if (!profile?.user_id || !currentUser?.id || currentUser.id === profile.user_id) {
      setConnection(null); return;
    }
    (async () => {
      try {
        const items = await connectionsApi.list();
        const existing = (items || []).find(
          (item) =>
            (item.requester_id === currentUser.id && item.recipient_id === profile.user_id) ||
            (item.requester_id === profile.user_id && item.recipient_id === currentUser.id),
        );
        if (!existing) {
          setConnection({ status: 'NONE', direction: null, id: null });
          return;
        }
        setConnection({
          id: existing.id, status: existing.status,
          direction: existing.requester_id === currentUser.id ? 'out' : 'in',
        });
      } catch (err) { console.error(err); }
    })();
  }, [profile?.user_id, currentUser?.id]);

  useEffect(() => {
    if (!profile?.user_id || !currentUser?.id || currentUser.id === profile.user_id) {
      setMentorshipRequested(false); return;
    }
    (async () => {
      try {
        const requests = await mentorshipApi.getOutgoingRequests();
        const has = (requests || []).some(
          (item) => item.receiver_id === profile.user_id && ['PENDING', 'ACCEPTED'].includes(item.status),
        );
        setMentorshipRequested(has);
      } catch (err) { console.error(err); }
    })();
  }, [profile?.user_id, currentUser?.id]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = userId ? await profileApi.getUserProfile(userId) : await profileApi.getMe();
      setProfile(data);
    } catch (err) {
      setError('Failed to load profile');
      console.error(err);
    } finally { setLoading(false); }
  };

  const startConversation = async () => {
    if (!profile?.user_id) return;
    try {
      const convo = await messagesApi.startConversation(profile.user_id);
      navigate(`/messages?chat=${convo.conversation_id}`);
    } catch (err) {
      setNotice({ type: 'error', message: err.response?.data?.detail || 'Connect first to start a conversation.' });
    }
  };

  const handleConnect = async () => {
    if (!profile?.user_id || connecting) return;
    setConnecting(true); setNotice(null);
    try {
      if (connection?.status === 'PENDING' && connection.direction === 'in' && connection.id) {
        const updated = await connectionsApi.respond(connection.id, 'ACCEPTED');
        setConnection({ id: updated.id, status: updated.status, direction: 'in' });
        setNotice({ type: 'success', message: 'Connection request accepted.' });
        return;
      }
      const created = await connectionsApi.request(profile.user_id);
      setConnection({ id: created.id, status: created.status, direction: 'out' });
      setNotice({ type: 'success', message: 'Connection request sent.' });
    } catch (err) {
      setNotice({ type: 'error', message: err.response?.data?.detail || 'Failed to update connection.' });
    } finally { setConnecting(false); }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const updated = await profileApi.uploadPhoto(file); setProfile(updated);
      setNotice({ type: 'success', message: 'Avatar updated' });
    } catch (err) { setNotice({ type: 'error', message: err.response?.data?.detail || 'Failed to upload avatar' }); }
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const updated = await profileApi.uploadCover(file); setProfile(updated);
      setNotice({ type: 'success', message: 'Cover updated' });
    } catch (err) { setNotice({ type: 'error', message: err.response?.data?.detail || 'Failed to upload cover' }); }
  };

  if (loading) return <div className="page"><div className="loading-block">Loading profile…</div></div>;
  if (error) return <div className="page"><Alert type="error">{error}</Alert></div>;
  if (!profile) return <div className="page"><div className="empty-block"><h3>No profile found</h3></div></div>;

  const isConnected = connection?.status === 'ACCEPTED';
  const isPendingOutgoing = connection?.status === 'PENDING' && connection?.direction === 'out';
  const isPendingIncoming = connection?.status === 'PENDING' && connection?.direction === 'in';
  const mentorIsFull = profile?.mentor_capacity_status === 'FULL';
  const mentorshipDisabled = mentorshipRequested || mentorIsFull;
  const mentorshipLabel = mentorIsFull ? 'Mentor full' : mentorshipRequested ? 'Request sent' : 'Request mentorship';
  const connectLabel = isConnected ? 'Connected' : isPendingOutgoing ? 'Request sent' : isPendingIncoming ? 'Accept request' : connecting ? 'Connecting…' : 'Connect';

  const skills = profile.skills || [];
  const experience = profile.experience || [];
  const education = profile.education || [];
  const careerCompanies = profile.career_companies || [];
  const careerRoles = profile.career_roles || [];
  const careerProjects = profile.career_projects || [];
  const careerPath = profile.career_path || [];

  const tabsList = [
    { k: 'about', label: 'About' },
    { k: 'experience', label: 'Experience', count: experience.length || null },
    { k: 'education', label: 'Education', count: education.length || null },
    { k: 'trajectory', label: 'Trajectory', count: careerPath.length || null },
  ];

  return (
    <div>
      {notice && (
        <div style={{ padding: '14px 36px 0' }}>
          <Alert type={notice.type === 'success' ? 'success' : 'error'}>{notice.message}</Alert>
        </div>
      )}

      <div
        className={`profile-cover ${profile.cover_url ? 'has-img' : ''}`}
        style={profile.cover_url ? { backgroundImage: `url(${resolveUrl(profile.cover_url)})` } : undefined}
      >
        {isOwnProfile && (
          <div className="profile-cover-actions">
            <button className="btn sm ghost" onClick={() => coverInputRef.current?.click()}>
              <Icon name="edit" size={12} /> Edit cover
            </button>
            <input type="file" accept="image/*" ref={coverInputRef} style={{ display: 'none' }} onChange={handleCoverUpload} />
          </div>
        )}
      </div>

      <div className="profile-id-bar">
        <div className="profile-id-avatar" style={{ position: 'relative' }}>
          <Avatar src={resolveUrl(profile.photo_url)} name={profile.name} size="xl" />
          {isOwnProfile && (
            <>
              <button
                className="iconbtn"
                style={{ position: 'absolute', right: -4, bottom: -4, background: 'var(--surface)', border: '1px solid var(--line)', width: 28, height: 28, borderRadius: 7 }}
                onClick={() => avatarInputRef.current?.click()}
                title="Change avatar"
              >
                <Icon name="edit" size={12} />
              </button>
              <input type="file" accept="image/*" ref={avatarInputRef} style={{ display: 'none' }} onChange={handleAvatarUpload} />
            </>
          )}
        </div>
        <div style={{ paddingBottom: 8, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <h1 className="h2">{profile.name}</h1>
            {profile.is_mentor && <Pill tone="blue" dot>Mentor · {mentorIsFull ? 'full' : 'accepting'}</Pill>}
            {profile.role === 'ALUMNI' && <Pill tone="warm">Alumni{profile.graduation_year ? ` · ${profile.graduation_year}` : ''}</Pill>}
            {profile.role === 'STUDENT' && <Pill>Student</Pill>}
            {profile.role === 'STAFF' && <Pill>Staff</Pill>}
          </div>
          <div className="dim" style={{ fontSize: 14, marginBottom: 8, maxWidth: 720 }}>
            {profile.headline || 'Member of the Alumni Networking Platform'}
            {profile.bio && <span className="serif" style={{ display: 'block', marginTop: 6, color: 'var(--ink-2)' }}>{profile.bio}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: 'var(--ink-3)', fontSize: 12, flexWrap: 'wrap' }} className="mono">
            {profile.location && <span><Icon name="mapPin" size={12} style={{ verticalAlign: 'middle' }} /> {profile.location.toUpperCase()}</span>}
            {profile.career_university && <span>· {profile.career_university.toUpperCase()}</span>}
            {profile.email && <span>· {profile.email}</span>}
          </div>
        </div>
        <div className="profile-actions">
          {isOwnProfile ? (
            <>
              <Link to="/profile/edit" className="btn"><Icon name="edit" size={12} /> Edit profile</Link>
              <Link to="/profile/resume-import" className="btn primary"><Icon name="upload" size={12} /> Import resume</Link>
            </>
          ) : (
            <>
              <button className="btn" onClick={startConversation} disabled={!isConnected}>
                <Icon name="msg" size={14} /> Message
              </button>
              <button className="btn" onClick={handleConnect} disabled={connecting || isConnected || isPendingOutgoing}>
                <Icon name="link" size={14} /> {connectLabel}
              </button>
              {profile.is_mentor && (
                <button
                  className="btn primary"
                  onClick={() => !mentorshipDisabled && setShowMentorshipModal(true)}
                  disabled={mentorshipDisabled}
                >
                  <Icon name="spark" size={14} /> {mentorshipLabel}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div style={{ padding: '20px 36px 0' }}>
        <div className="tabs">
          {tabsList.map((t) => (
            <button key={t.k} className={`tab${activeTab === t.k ? ' active' : ''}`} onClick={() => setActiveTab(t.k)}>
              {t.label} {t.count != null && <span className="count">{t.count}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="page" style={{ padding: '24px 36px 36px' }}>
        {activeTab === 'about' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 12 }}>01 · ABOUT</div>
              <div className="panel" style={{ padding: 16 }}>
                {profile.bio ? (
                  <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-2)' }}>{profile.bio}</p>
                ) : (
                  <p className="mute" style={{ margin: 0, fontSize: 13 }}>
                    {isOwnProfile ? 'Add a summary so others can learn about you.' : 'No bio yet.'}
                  </p>
                )}
              </div>

              {skills.length > 0 && (
                <>
                  <div className="eyebrow" style={{ margin: '24px 0 12px' }}>02 · SKILLS</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {skills.map((s) => <span key={s} className="chip skill">{s}</span>)}
                  </div>
                </>
              )}

              {(careerCompanies.length > 0 || careerRoles.length > 0 || careerProjects.length > 0) && (
                <>
                  <div className="eyebrow" style={{ margin: '24px 0 12px' }}>03 · CAREER FACTS</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                    {careerCompanies.length > 0 && (
                      <div className="panel" style={{ padding: 14 }}>
                        <div className="eyebrow" style={{ marginBottom: 8 }}>Companies</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {careerCompanies.map((c) => <span key={c} className="chip skill">{c}</span>)}
                        </div>
                      </div>
                    )}
                    {careerRoles.length > 0 && (
                      <div className="panel" style={{ padding: 14 }}>
                        <div className="eyebrow" style={{ marginBottom: 8 }}>Roles</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {careerRoles.map((c) => <span key={c} className="chip skill">{c}</span>)}
                        </div>
                      </div>
                    )}
                    {careerProjects.length > 0 && (
                      <div className="panel" style={{ padding: 14 }}>
                        <div className="eyebrow" style={{ marginBottom: 8 }}>Projects</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {careerProjects.map((c) => <span key={c} className="chip skill">{c}</span>)}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div>
              {profile.is_mentor && (
                <>
                  <div className="eyebrow" style={{ marginBottom: 12 }}>MENTORSHIP CAPACITY</div>
                  <div className="panel" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                        {profile.mentor_active_mentees || 0} / {profile.mentor_max_mentees || 0} ACTIVE
                      </span>
                      <span className="mono" style={{ fontSize: 11, color: mentorIsFull ? 'var(--warm)' : 'var(--ok)' }}>
                        {mentorIsFull ? 'FULL' : `${(profile.mentor_max_mentees || 0) - (profile.mentor_active_mentees || 0)} SLOTS OPEN`}
                      </span>
                    </div>
                    {profile.mentor_max_mentees > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${profile.mentor_max_mentees}, 1fr)`, gap: 4 }}>
                        {Array.from({ length: profile.mentor_max_mentees }).map((_, i) => (
                          <div
                            key={i}
                            style={{
                              height: 24, borderRadius: 4,
                              background: i < (profile.mentor_active_mentees || 0) ? 'var(--blue)' : 'var(--surface-2)',
                              border: '1px solid ' + (i < (profile.mentor_active_mentees || 0) ? 'var(--blue)' : 'var(--line)'),
                            }}
                          />
                        ))}
                      </div>
                    )}
                    {profile.mentor_areas_of_help?.length > 0 && (
                      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-2)' }}>
                        Helps with: <span style={{ color: 'var(--ink)' }}>{profile.mentor_areas_of_help.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {profile.linkedin_url && (
                <>
                  <div className="eyebrow" style={{ margin: '24px 0 12px' }}>LINKS</div>
                  <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="panel" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, textDecoration: 'none', color: 'var(--ink)' }}>
                    <Icon name="external" size={14} />
                    <span style={{ fontSize: 12.5 }}>LinkedIn profile</span>
                  </a>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'experience' && (
          <div>
            <div className="eyebrow" style={{ marginBottom: 12 }}>EXPERIENCE</div>
            {experience.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line-soft)', border: '1px solid var(--line-soft)', borderRadius: 10, overflow: 'hidden' }}>
                {experience.map((exp, i) => (
                  <div key={i} style={{ background: 'var(--surface)', padding: '16px 18px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg-2)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', fontFamily: 'var(--mono)' }}>
                      {(exp.company || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h3 className="h3">{exp.position}</h3>
                        {exp.current && <Pill tone="ok" dot>current</Pill>}
                      </div>
                      <div className="mute" style={{ fontSize: 12, marginTop: 2 }}>
                        <span>{exp.company}</span><span className="dot-sep" />
                        <span className="mono">
                          {formatDate(exp.start_date)} — {exp.current ? 'Now' : formatDate(exp.end_date)} · {calculateDuration(exp.start_date, exp.end_date, exp.current)}
                        </span>
                      </div>
                      {exp.location && <div className="mute" style={{ fontSize: 11.5, marginTop: 2 }}>{exp.location}</div>}
                      {exp.description && <div className="dim" style={{ fontSize: 13, marginTop: 8 }}>{exp.description}</div>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-block">
                <Icon name="briefcase" size={28} />
                <h3>No experience yet</h3>
                {isOwnProfile && <Link to="/profile/edit" className="btn sm">Add experience</Link>}
              </div>
            )}
          </div>
        )}

        {activeTab === 'education' && (
          <div>
            <div className="eyebrow" style={{ marginBottom: 12 }}>EDUCATION</div>
            {education.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {education.map((edu, i) => (
                  <div key={i} className="panel" style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 14, alignItems: 'center' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--ink)', color: 'var(--bg)', display: 'grid', placeItems: 'center', fontFamily: 'var(--mono)', fontWeight: 700 }}>
                      {(edu.school || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="h3">{edu.school}</div>
                      <div className="mute" style={{ fontSize: 12 }}>
                        {edu.degree}{edu.field_of_study ? ` · ${edu.field_of_study}` : ''}{edu.grade ? ` · GPA ${edu.grade}` : ''}
                      </div>
                    </div>
                    <div className="mono mute" style={{ fontSize: 11 }}>
                      {edu.start_date && new Date(edu.start_date).getFullYear()} — {edu.end_date ? new Date(edu.end_date).getFullYear() : 'Now'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-block">
                <Icon name="award" size={28} />
                <h3>No education added</h3>
                {isOwnProfile && <Link to="/profile/edit" className="btn sm">Add education</Link>}
              </div>
            )}
          </div>
        )}

        {activeTab === 'trajectory' && (
          <div>
            <div className="eyebrow" style={{ marginBottom: 12 }}>CAREER TRAJECTORY</div>
            {careerPath.length > 0 ? (
              <div className="panel" style={{ padding: 24, background: 'var(--bg-2)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                  {careerPath.map((step, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span className="chip blue" style={{ padding: '6px 14px', fontFamily: 'var(--sans)', fontSize: 12.5 }}>{step}</span>
                      {i < careerPath.length - 1 && <span style={{ color: 'var(--blue)' }}>→</span>}
                    </div>
                  ))}
                </div>
                {profile.career_trajectory?.length > 0 && (
                  <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {profile.career_trajectory.map((step, i) => (
                      <div key={i} className="panel" style={{ padding: 14, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 14, alignItems: 'center' }}>
                        <div className="numcap">{String(i + 1).padStart(2, '0')}</div>
                        <div>
                          <div className="h3">{step.label}</div>
                          {step.company && <div className="mute mono" style={{ fontSize: 10.5 }}>{step.company.toUpperCase()}</div>}
                        </div>
                        <div className="mono mute" style={{ fontSize: 11 }}>
                          {step.start_date || '?'} — {step.current ? 'Now' : (step.end_date || '?')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-block">
                <Icon name="graph" size={28} />
                <h3>No trajectory data yet</h3>
                <p>Import a resume to auto-build your career trajectory.</p>
                {isOwnProfile && <Link to="/profile/resume-import" className="btn sm primary">Import resume</Link>}
              </div>
            )}
          </div>
        )}
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
    </div>
  );
};

export default Profile;
