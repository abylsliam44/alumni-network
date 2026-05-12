import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { connectionsApi } from '../api/connections';
import { mentorshipApi } from '../api/mentorship';
import { eventsApi } from '../api/events';
import { jobsApi } from '../api/jobs';
import { projectsApi } from '../api/projects';
import { messagesApi } from '../api/messages';
import { recommendationsApi } from '../api/recommendations';
import { profileApi } from '../api/profile';
import Avatar from '../components/ui/Avatar';
import Pill from '../components/ui/Pill';
import NumCap from '../components/ui/NumCap';
import Icon from '../components/ui/Icon';
import { resolveUrl } from '../utils/image';

const formatEventDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === now.toDateString()) {
    return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const dayOfWeek = (date) => date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
const dayNum = (date) => String(date.getDate()).padStart(2, '0');

const Dashboard = () => {
  const { user } = useAuth();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [friends, setFriends] = useState([]);
  const [pendingConnections, setPendingConnections] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [mentorships, setMentorships] = useState([]);
  const [incomingMentorRequests, setIncomingMentorRequests] = useState([]);
  const [outgoingMentorRequests, setOutgoingMentorRequests] = useState([]);
  const [myEventRegistrations, setMyEventRegistrations] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [recentJobs, setRecentJobs] = useState([]);
  const [recommendedProjects, setRecommendedProjects] = useState([]);
  const [myJobApplications, setMyJobApplications] = useState([]);
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [
          profileData, friendsData, connectionsData, conversationsData,
          mentorshipsData, incomingReqData, outgoingReqData,
          eventsData, myEventsData, jobsData, projectsData, myAppsData, recsData,
        ] = await Promise.allSettled([
          profileApi.getMe(),
          connectionsApi.friends(),
          connectionsApi.list(),
          messagesApi.listConversations(),
          mentorshipApi.getRelationships(),
          mentorshipApi.getIncomingRequests(),
          mentorshipApi.getOutgoingRequests(),
          eventsApi.list({ limit: 8, upcoming_only: true }),
          eventsApi.myRegistrations(),
          jobsApi.list({ limit: 6 }),
          projectsApi.recommended({ limit: 4 }),
          jobsApi.myApplications(),
          recommendationsApi.getPeople(),
        ]);
        if (cancelled) return;

        if (profileData.status === 'fulfilled') setProfile(profileData.value);
        if (friendsData.status === 'fulfilled') setFriends(friendsData.value.friends || []);
        if (connectionsData.status === 'fulfilled') {
          const pending = (connectionsData.value || []).filter(
            (c) => c.status === 'PENDING' && c.recipient_id === user?.id,
          );
          setPendingConnections(pending);
        }
        if (conversationsData.status === 'fulfilled') setConversations(conversationsData.value || []);
        if (mentorshipsData.status === 'fulfilled') setMentorships(mentorshipsData.value || []);
        if (incomingReqData.status === 'fulfilled') {
          setIncomingMentorRequests((incomingReqData.value || []).filter((r) => r.status === 'PENDING'));
        }
        if (outgoingReqData.status === 'fulfilled') {
          setOutgoingMentorRequests((outgoingReqData.value || []).filter((r) => r.status === 'PENDING'));
        }
        if (eventsData.status === 'fulfilled') setUpcomingEvents(eventsData.value.items || eventsData.value || []);
        if (myEventsData.status === 'fulfilled') setMyEventRegistrations(myEventsData.value || []);
        if (jobsData.status === 'fulfilled') setRecentJobs(jobsData.value.items || jobsData.value || []);
        if (projectsData.status === 'fulfilled') setRecommendedProjects(projectsData.value.items || []);
        if (myAppsData.status === 'fulfilled') setMyJobApplications(myAppsData.value || []);
        if (recsData.status === 'fulfilled') setRecommendations((recsData.value.items || []).slice(0, 4));
      } catch (err) {
        console.error('Dashboard fetch failed', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchAll();
    return () => { cancelled = true; };
  }, [user?.id]);

  const totalUnread = conversations.reduce((s, c) => s + (c.unread_count || 0), 0);

  const profileCompletion = useMemo(() => {
    if (!profile) return 0;
    const has = (v) => {
      if (!v) return false;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'string') return v.trim().length > 0;
      return Boolean(v);
    };
    const fields = [
      [profile.name || user?.name, 1],
      [profile.headline, 1.5],
      [profile.bio, 1],
      [profile.location, 1],
      [profile.skills, 2],
      [profile.experience, 1.5],
      [profile.education, 1],
      [profile.photo_url || user?.photo_url, 1],
      [profile.graduation_year, 0.5],
      [profile.linkedin_url, 0.5],
    ];
    const total = fields.reduce((s, [, w]) => s + w, 0);
    const earned = fields.reduce((s, [v, w]) => s + (has(v) ? w : 0), 0);
    return Math.round((earned / total) * 100);
  }, [profile, user]);

  const opportunityGenerationPending = profile?.opportunity_generation?.status === 'PENDING'
    || Boolean(location.state?.opportunityGenerationStarted);

  useEffect(() => {
    if (profile?.opportunity_generation?.status !== 'PENDING') return undefined;
    const interval = setInterval(async () => {
      try {
        const latestProfile = await profileApi.getMe();
        setProfile(latestProfile);
      } catch (err) {
        console.error('Failed to refresh opportunity generation', err);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [profile?.opportunity_generation?.status]);

  const firstName = (user?.name || profile?.name || 'there').split(' ')[0];
  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).toUpperCase();

  const stats = [
    { k: 'Profile completeness', v: `${profileCompletion}%`, sub: profileCompletion < 100 ? 'add details to rank higher' : 'looking sharp', tone: profileCompletion >= 80 ? 'ok' : 'warm' },
    { k: 'Connections', v: friends.length, sub: pendingConnections.length ? `${pendingConnections.length} pending` : 'in your network' },
    { k: 'Active mentorships', v: mentorships.filter((m) => m.status === 'ACTIVE').length, sub: incomingMentorRequests.length ? `${incomingMentorRequests.length} incoming` : 'no incoming requests', tone: 'blue' },
    { k: 'Job applications', v: myJobApplications.length, sub: myJobApplications.length ? `${myJobApplications.filter((a) => a.status === 'INTERVIEW' || a.status === 'SHORTLISTED').length} shortlisted` : 'browse open roles', tone: 'warm' },
    { k: 'Project matches', v: recommendedProjects.length, sub: recommendedProjects.length ? 'matched by your skills' : 'add skills to match', tone: 'blue' },
  ];

  if (loading) {
    return (
      <div className="page">
        <div className="loading-block">Initializing command center · syncing network</div>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Hero */}
      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>{todayLabel}</div>
          <h1 className="h1">
            Good day, {firstName}.<br />
            {incomingMentorRequests.length > 0 && (
              <>You have <i>{incomingMentorRequests.length} incoming</i> mentorship request{incomingMentorRequests.length > 1 ? 's' : ''}<br /></>
            )}
            {recommendations.length > 0 && (
              <>and <span style={{ color: 'var(--blue)' }}>{recommendations.length} new matches</span> this week.</>
            )}
            {!incomingMentorRequests.length && !recommendations.length && (
              <span className="dim">Build your network · share what you're looking for.</span>
            )}
          </h1>
        </div>
        <div className="page-head-actions">
          <Link to="/messages" className="btn"><Icon name="msg" size={14} /> Messages {totalUnread > 0 && `(${totalUnread})`}</Link>
          <Link to="/profile/resume-import" className="btn primary">Resume Import <Icon name="arrowR" size={12} /></Link>
        </div>
      </div>

      {opportunityGenerationPending && (
        <div className="panel blue-tint" style={{ padding: 14, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="pulse-dot" />
          <div style={{ flex: 1 }}>
            <div className="eyebrow" style={{ color: 'var(--blue)', marginBottom: 4 }}>AQYLDYAI · ROADMAP</div>
            <div style={{ fontSize: 13, color: 'var(--ink)' }}>
              Your roadmap and opportunities are being generated. You'll get a notification when ready.
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="stat-strip" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: 24 }}>
        {stats.map((s) => (
          <div key={s.k} className="stat">
            <div className="stat-label">{s.k}</div>
            <div className={`stat-num ${s.tone || ''}`}>{s.v}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Three columns */}
      <div className="dashboard-grid-3">
        {/* Mentorship requests */}
        <div className="panel">
          <div className="panel-head">
            <div className="panel-head-title">
              <NumCap n={1} />
              <h3>Incoming mentorship requests</h3>
            </div>
            {incomingMentorRequests.length > 0
              ? <Pill tone="blue" dot>{incomingMentorRequests.length} new</Pill>
              : <span className="mono mute" style={{ fontSize: 10 }}>0</span>}
          </div>
          <div className="panel-body flush">
            {incomingMentorRequests.length === 0 ? (
              <div className="empty-block">
                <Icon name="graph" size={28} />
                <h3>No incoming requests</h3>
                <p>When students request mentorship, they'll show up here.</p>
              </div>
            ) : (
              incomingMentorRequests.slice(0, 3).map((r) => (
                <div key={r.id} className="list-row">
                  <Avatar
                    src={resolveUrl(r.mentee?.photo_url)}
                    name={r.mentee?.name}
                    size="m"
                  />
                  <div style={{ minWidth: 0 }}>
                    <div className="h3" style={{ marginBottom: 2 }}>
                      {r.mentee?.name}
                      {r.mentee?.headline && <span className="mono" style={{ marginLeft: 8, fontSize: 10, color: 'var(--ink-3)' }}>{r.mentee.headline}</span>}
                    </div>
                    <div className="mute" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {r.goals || 'No goal specified'}
                    </div>
                  </div>
                  <Link to="/mentorship" className="btn sm primary">Review</Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming */}
        <div className="panel">
          <div className="panel-head">
            <div className="panel-head-title">
              <NumCap n={2} />
              <h3>Upcoming</h3>
            </div>
            <span className="mono mute" style={{ fontSize: 10 }}>this week</span>
          </div>
          <div className="panel-body flush">
            {upcomingEvents.length === 0 ? (
              <div className="empty-block">
                <Icon name="calendar" size={28} />
                <h3>No upcoming events</h3>
                <p>Browse events to register for talks, workshops, and meetups.</p>
                <Link to="/events" className="btn sm">Browse events</Link>
              </div>
            ) : (
              upcomingEvents.slice(0, 4).map((e) => {
                const date = new Date(e.start_time);
                const isClose = (date - new Date()) < 1000 * 60 * 60 * 48;
                return (
                  <Link key={e.id} to={`/events/${e.id}`} className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className={`date-chip ${isClose ? 'blue' : ''}`}>
                      <div className="d">{dayOfWeek(date)}</div>
                      <div className="n">{dayNum(date)}</div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="h3" style={{ fontSize: 13, marginBottom: 2 }}>{e.title}</div>
                      <div className="mute" style={{ fontSize: 11 }}>{e.location || 'Online'}</div>
                    </div>
                    <span className="mono mute" style={{ fontSize: 10 }}>
                      {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* AI matches */}
        <div className="panel blue-tint">
          <div className="panel-head" style={{ borderBottomColor: 'var(--blue-line)' }}>
            <div className="panel-head-title">
              <NumCap n={3} />
              <h3>AI suggests you connect with</h3>
            </div>
            <Icon name="spark" size={14} style={{ color: 'var(--blue)' }} />
          </div>
          <div className="panel-body flush">
            {recommendations.length === 0 ? (
              <div className="empty-block">
                <Icon name="users" size={28} />
                <h3>No recommendations yet</h3>
                <p>Add skills and interests to your profile and we'll surface alumni you should meet.</p>
                <Link to="/profile/edit" className="btn sm">Complete profile</Link>
              </div>
            ) : (
              recommendations.map((rec) => {
                const userId = rec.target_user_id || rec.user?.id;
                const name = rec.name || rec.user?.name;
                const photoUrl = rec.photo_url || rec.user?.photo_url;
                const headline = rec.mentor_headline || rec.role || rec.user?.headline;
                const reason = rec.reason_short || rec.reason;
                const score = rec.score || rec.match;
                if (!userId) return null;
                return (
                  <Link key={userId} to={`/profile/${userId}`} className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <Avatar src={resolveUrl(photoUrl)} name={name} size="m" />
                    <div style={{ minWidth: 0 }}>
                      <div className="h3" style={{ fontSize: 12.5, marginBottom: 1 }}>{name}</div>
                      <div className="mute mono" style={{ fontSize: 10 }}>{headline}</div>
                      {reason && <div style={{ fontSize: 10.5, color: 'var(--blue)', marginTop: 4 }}>+ {reason}</div>}
                    </div>
                    {score && <span className="mono" style={{ fontSize: 10, color: 'var(--blue)' }}>{Math.round(score * 100)}%</span>}
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="dashboard-grid-2">
        <div className="panel blue-tint">
          <div className="panel-head" style={{ borderBottomColor: 'var(--blue-line)' }}>
            <div className="panel-head-title">
              <NumCap n={4} />
              <h3>Recommended projects</h3>
            </div>
            <Link to="/projects" className="btn sm ghost">Project board <Icon name="arrowR" size={12} /></Link>
          </div>
          <div className="panel-body flush">
            {recommendedProjects.length === 0 ? (
              <div className="empty-block">
                <Icon name="bookmark" size={28} />
                <h3>No project matches yet</h3>
                <p>Add skills to your profile or browse the project board.</p>
                <Link to="/projects" className="btn sm">Browse projects</Link>
              </div>
            ) : recommendedProjects.slice(0, 4).map((project) => (
              <Link key={project.id} to={`/projects/${project.id}`} className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ width: 36, height: 36, borderRadius: 7, background: 'var(--bg-2)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                  {(project.title || '?').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="h3" style={{ fontSize: 13 }}>{project.title}</div>
                  <div className="mute" style={{ fontSize: 11.5 }}>{project.required_skills?.slice(0, 3).join(', ') || 'Open collaboration'}</div>
                </div>
                <span className="mono" style={{ fontSize: 10, color: 'var(--blue)' }}>{project.match_score || 0}%</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="panel-head-title">
              <NumCap n={5} />
              <h3>Recent job postings</h3>
            </div>
            <Link to="/jobs" className="btn sm ghost">All jobs <Icon name="arrowR" size={12} /></Link>
          </div>
          <div className="panel-body flush">
            {recentJobs.length === 0 ? (
              <div className="empty-block">
                <Icon name="briefcase" size={28} />
                <h3>No recent jobs</h3>
                <Link to="/jobs" className="btn sm">Browse jobs</Link>
              </div>
            ) : (
              recentJobs.slice(0, 5).map((job) => (
                <Link key={job.id} to={`/jobs/${job.id}`} className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 7, background: 'var(--bg-2)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                    {(job.company || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="h3" style={{ fontSize: 13 }}>{job.title}</div>
                    <div className="mute" style={{ fontSize: 11.5 }}>{job.company} · {job.location || 'Remote'}</div>
                  </div>
                  <span className="mono mute" style={{ fontSize: 10 }}>
                    {job.employment_type ? job.employment_type.replaceAll('_', ' ').toLowerCase() : ''}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="panel warm-tint">
          <div className="panel-head" style={{ borderBottomColor: 'var(--warm-line)' }}>
            <div className="panel-head-title">
              <NumCap n={6} />
              <h3>Quick actions</h3>
            </div>
          </div>
          <div className="panel-body">
            <div className="qa-grid">
              <Link to="/directory" className="qa-item">
                <div className="icon"><Icon name="users" size={16} /></div>
                <div className="label">Find alumni</div>
              </Link>
              <Link to="/mentorship" className="qa-item">
                <div className="icon"><Icon name="graph" size={16} /></div>
                <div className="label">Find a mentor</div>
              </Link>
              <Link to="/ai" className="qa-item">
                <div className="icon"><Icon name="bot" size={16} /></div>
                <div className="label">Ask AqyldyAI</div>
              </Link>
              <Link to="/events" className="qa-item">
                <div className="icon"><Icon name="calendar" size={16} /></div>
                <div className="label">Browse events</div>
              </Link>
              <Link to="/projects" className="qa-item">
                <div className="icon"><Icon name="bookmark" size={16} /></div>
                <div className="label">Project board</div>
              </Link>
              <Link to="/recommendations" className="qa-item">
                <div className="icon"><Icon name="spark" size={16} /></div>
                <div className="label">Recommendations</div>
              </Link>
              <Link to="/profile/resume-import" className="qa-item">
                <div className="icon"><Icon name="upload" size={16} /></div>
                <div className="label">Import resume</div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
