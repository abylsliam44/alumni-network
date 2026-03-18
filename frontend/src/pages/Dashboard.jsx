import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { connectionsApi } from '../api/connections';
import { mentorshipApi } from '../api/mentorship';
import { eventsApi } from '../api/events';
import { jobsApi } from '../api/jobs';
import { messagesApi } from '../api/messages';
import { recommendationsApi } from '../api/recommendations';
import { profileApi } from '../api/profile';
import aituBackground from '../../images/aitu.jpg';

const apiBase = import.meta.env.VITE_API_URL || '';
const resolveUrl = (path) => {
  if (!path) return null;
  return path.startsWith('http') ? path : `${apiBase}${path}`;
};

const dicebear = (name = 'User') =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;

// Icons
const UsersIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const MessageIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const BriefcaseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

const UserPlusIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="19" y1="8" x2="19" y2="14" />
    <line x1="22" y1="11" x2="16" y2="11" />
  </svg>
);

const GraduationCapIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const MapPinIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const BuildingIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <path d="M9 22v-4h6v4" />
    <line x1="8" y1="6" x2="8" y2="6" />
    <line x1="12" y1="6" x2="12" y2="6" />
    <line x1="16" y1="6" x2="16" y2="6" />
    <line x1="8" y1="10" x2="8" y2="10" />
    <line x1="12" y1="10" x2="12" y2="10" />
    <line x1="16" y1="10" x2="16" y2="10" />
    <line x1="8" y1="14" x2="8" y2="14" />
    <line x1="12" y1="14" x2="12" y2="14" />
    <line x1="16" y1="14" x2="16" y2="14" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const AlertCircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);


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
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // State for all dashboard data
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
  const [myJobApplications, setMyJobApplications] = useState([]);
  const [recommendations, setRecommendations] = useState([]);

  // Fetch all dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // Fetch all data in parallel
        const [
          profileData,
          friendsData,
          connectionsData,
          conversationsData,
          mentorshipsData,
          incomingReqData,
          outgoingReqData,
          eventsData,
          myEventsData,
          jobsData,
          myAppsData,
          recsData,
        ] = await Promise.allSettled([
          profileApi.getMe(),
          connectionsApi.friends(),
          connectionsApi.list(),
          messagesApi.listConversations(),
          mentorshipApi.getRelationships(),
          mentorshipApi.getIncomingRequests(),
          mentorshipApi.getOutgoingRequests(),
          eventsApi.list({ limit: 5, upcoming_only: true }),
          eventsApi.myRegistrations(),
          jobsApi.list({ limit: 5 }),
          jobsApi.myApplications(),
          recommendationsApi.getPeople(),
        ]);

        // Set profile
        if (profileData.status === 'fulfilled') {
          setProfile(profileData.value);
        }

        // Set friends
        if (friendsData.status === 'fulfilled') {
          setFriends(friendsData.value.friends || []);
        }

        // Set pending connections
        if (connectionsData.status === 'fulfilled') {
          const pending = (connectionsData.value || []).filter(
            (c) => c.status === 'PENDING' && c.recipient_id === user?.id
          );
          setPendingConnections(pending);
        }

        // Set conversations
        if (conversationsData.status === 'fulfilled') {
          setConversations(conversationsData.value || []);
        }

        // Set mentorships
        if (mentorshipsData.status === 'fulfilled') {
          setMentorships(mentorshipsData.value || []);
        }

        // Set mentor requests
        if (incomingReqData.status === 'fulfilled') {
          setIncomingMentorRequests(
            (incomingReqData.value || []).filter((r) => r.status === 'PENDING')
          );
        }
        if (outgoingReqData.status === 'fulfilled') {
          setOutgoingMentorRequests(
            (outgoingReqData.value || []).filter((r) => r.status === 'PENDING')
          );
        }

        // Set events
        if (eventsData.status === 'fulfilled') {
          setUpcomingEvents(eventsData.value.items || eventsData.value || []);
        }
        if (myEventsData.status === 'fulfilled') {
          setMyEventRegistrations(myEventsData.value || []);
        }

        // Set jobs
        if (jobsData.status === 'fulfilled') {
          setRecentJobs(jobsData.value.items || jobsData.value || []);
        }
        if (myAppsData.status === 'fulfilled') {
          setMyJobApplications(myAppsData.value || []);
        }

        // Set recommendations
        if (recsData.status === 'fulfilled') {
          setRecommendations((recsData.value.items || []).slice(0, 4));
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Calculate stats
  const unreadMessages = conversations.filter((c) => c.unread_count > 0).length;
  const totalUnreadCount = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  // Calculate profile completion with proper null handling and weighting
  const calculateProfileCompletion = () => {
    if (!profile) return 0;

    // Check each field with proper null/empty handling
    const checkField = (value) => {
      if (value === null || value === undefined) return false;
      if (typeof value === 'string') return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;
      return Boolean(value);
    };

    // Fields to check with their weights (more important = higher weight)
    const fields = [
      { value: profile.name || user?.name, weight: 1 },           // Name
      { value: profile.headline, weight: 1.5 },                   // Headline - important for visibility
      { value: profile.bio, weight: 1 },                          // Bio
      { value: profile.location, weight: 1 },                     // Location
      { value: profile.skills, weight: 2 },                       // Skills - critical for matching
      { value: profile.experience, weight: 1.5 },                 // Experience
      { value: profile.education, weight: 1 },                    // Education
      { value: profile.photo_url || user?.photo_url, weight: 1 }, // Photo
      { value: profile.graduation_year, weight: 0.5 },            // Graduation year
      { value: profile.linkedin_url, weight: 0.5 },               // LinkedIn
    ];

    const totalWeight = fields.reduce((sum, f) => sum + f.weight, 0);
    const earnedWeight = fields.reduce((sum, f) => {
      return sum + (checkField(f.value) ? f.weight : 0);
    }, 0);

    return Math.round((earnedWeight / totalWeight) * 100);
  };

  const profileCompletion = calculateProfileCompletion();
  const hasRecommendationProfileSignals = Boolean(
    profile?.skills?.length ||
    profile?.interests?.length ||
    profile?.mentor_areas_of_help?.length
  );
  const opportunityGeneration = profile?.opportunity_generation;
  const opportunityGenerationPending =
    profile
      ? opportunityGeneration?.status === 'PENDING'
      : Boolean(location.state?.opportunityGenerationStarted);
  const opportunityGenerationInterest =
    opportunityGeneration?.requested_interest || location.state?.opportunityInterest;

  useEffect(() => {
    if (opportunityGeneration?.status !== 'PENDING') {
      return undefined;
    }

    const interval = setInterval(async () => {
      try {
        const latestProfile = await profileApi.getMe();
        setProfile(latestProfile);
      } catch (err) {
        console.error('Failed to refresh opportunity generation status:', err);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [opportunityGeneration?.status]);

  // Calendar Logic
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    return { days, firstDay };
  };

  const { days: daysInMonth, firstDay: startDay } = getDaysInMonth(currentDate);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const isToday = (day) => {
    const today = new Date();
    return day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear();
  };

  const isSelected = (day) => {
    return day === selectedDate.getDate() &&
      currentDate.getMonth() === selectedDate.getMonth() &&
      currentDate.getFullYear() === selectedDate.getFullYear();
  };

  const hasEvent = (day) => {
    return upcomingEvents.some(e => {
      const d = new Date(e.start_time);
      return d.getDate() === day &&
        d.getMonth() === currentDate.getMonth() &&
        d.getFullYear() === currentDate.getFullYear();
    });
  };

  const getEventsForSelectedDate = () => {
    return upcomingEvents.filter(e => {
      const d = new Date(e.start_time);
      return d.getDate() === selectedDate.getDate() &&
        d.getMonth() === selectedDate.getMonth() &&
        d.getFullYear() === selectedDate.getFullYear();
    });
  };

  const selectedEvents = getEventsForSelectedDate();

  if (loading) {
    return (
      <div className="dash-page dash-page-loading" style={{ '--dash-bg-image': `url(${aituBackground})` }}>
        <div className="dash-loading">
          <div className="dash-loader" />
          <span>Loading your dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-page" style={{ '--dash-bg-image': `url(${aituBackground})` }}>
      {/* Welcome Section */}
      <header className="dash-header">
        <div className="dash-welcome">
          <div className="dash-avatar-wrapper">
            <img
              src={resolveUrl(user?.photo_url) || dicebear(user?.name)}
              alt={user?.name}
              className="dash-avatar"
            />
            <span className="dash-avatar-badge">{user?.role?.[0]?.toUpperCase()}</span>
          </div>
          <div className="dash-welcome-text">
            <h1>Welcome back, {user?.name?.split(' ')[0]}!</h1>
            <p>Here's what's happening in your network</p>
          </div>
        </div>

        <div className="dash-header-actions">
          <Link to="/profile" className="dash-btn secondary">
            View Profile
          </Link>
          <Link to="/directory" className="dash-btn primary">
            Browse Directory
          </Link>
        </div>
      </header>

      {/* Profile Completion Banner */}
      {opportunityGenerationPending && (
        <div className="dash-opportunity-banner">
          <div className="dash-opportunity-copy">
            <AlertCircleIcon />
            <div>
              <span className="dash-opportunity-title">Your roadmap is being generated</span>
              <span className="dash-opportunity-desc">
                {opportunityGenerationInterest
                  ? `Your roadmap and opportunities for "${opportunityGenerationInterest}" are being generated. You'll get a notification when it's ready.`
                  : `Your roadmap and opportunities are being generated. You'll get a notification when it's ready.`}
              </span>
            </div>
          </div>
        </div>
      )}

      {profileCompletion < 100 && (
        <div className="dash-completion-banner">
          <div className="dash-completion-content">
            <AlertCircleIcon />
            <div className="dash-completion-text">
              <span className="dash-completion-title">Complete your profile</span>
              <span className="dash-completion-desc">
                Your profile is {profileCompletion}% complete. Add more details to help others find you.
              </span>
            </div>
          </div>
          <div className="dash-completion-progress">
            <div
              className="dash-completion-bar"
              style={{ width: `${profileCompletion}%` }}
            />
          </div>
          <Link to="/profile/edit" className="dash-btn small primary">
            Complete Profile
          </Link>
        </div>
      )}

      {/* Stats Cards */}
      <section className="dash-stats">
        <div className="dash-stat-card">
          <div className="dash-stat-icon blue">
            <UsersIcon />
          </div>
          <div className="dash-stat-content">
            <span className="dash-stat-number">{friends.length}</span>
            <span className="dash-stat-label">Connections</span>
          </div>
          {pendingConnections.length > 0 && (
            <span className="dash-stat-badge">{pendingConnections.length} pending</span>
          )}
        </div>

        <div className="dash-stat-card" onClick={() => navigate('/messages')}>
          <div className="dash-stat-icon green">
            <MessageIcon />
          </div>
          <div className="dash-stat-content">
            <span className="dash-stat-number">{conversations.length}</span>
            <span className="dash-stat-label">Conversations</span>
          </div>
          {totalUnreadCount > 0 && (
            <span className="dash-stat-badge alert">{totalUnreadCount} unread</span>
          )}
        </div>

        <div className="dash-stat-card" onClick={() => navigate('/events')}>
          <div className="dash-stat-icon purple">
            <CalendarIcon />
          </div>
          <div className="dash-stat-content">
            <span className="dash-stat-number">{myEventRegistrations.length}</span>
            <span className="dash-stat-label">Registered Events</span>
          </div>
        </div>

        <div className="dash-stat-card" onClick={() => navigate('/mentorship')}>
          <div className="dash-stat-icon orange">
            <GraduationCapIcon />
          </div>
          <div className="dash-stat-content">
            <span className="dash-stat-number">{mentorships.length}</span>
            <span className="dash-stat-label">Mentorships</span>
          </div>
          {(incomingMentorRequests.length + outgoingMentorRequests.length) > 0 && (
            <span className="dash-stat-badge">
              {incomingMentorRequests.length + outgoingMentorRequests.length} requests
            </span>
          )}
        </div>
      </section>

      {/* Notifications / Activity Area (Full width) */}
      <div className="dash-notifications">
        {/* Pending Connection Requests */}
        {pendingConnections.length > 0 && (
          <section className="dash-card">
            <div className="dash-card-header">
              <h2><UserPlusIcon /> Connection Requests</h2>
              <Link to="/friends" className="dash-link">
                View All <ArrowRightIcon />
              </Link>
            </div>
            <div className="dash-request-list">
              {pendingConnections.slice(0, 3).map((conn) => (
                <div key={conn.id} className="dash-request-item">
                  <img
                    src={resolveUrl(conn.requester?.photo_url) || dicebear(conn.requester?.name)}
                    alt={conn.requester?.name}
                    className="dash-request-avatar"
                  />
                  <div className="dash-request-info">
                    <span className="dash-request-name">{conn.requester?.name}</span>
                    <span className="dash-request-role">{conn.requester?.role}</span>
                  </div>
                  <Link to="/friends" className="dash-btn small secondary">
                    Respond
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Mentorship Requests */}
        {incomingMentorRequests.length > 0 && (
          <section className="dash-card">
            <div className="dash-card-header">
              <h2><GraduationCapIcon /> Mentorship Requests</h2>
              <Link to="/mentorship" className="dash-link">
                View All <ArrowRightIcon />
              </Link>
            </div>
            <div className="dash-request-list">
              {incomingMentorRequests.slice(0, 3).map((req) => (
                <div key={req.id} className="dash-request-item">
                  <img
                    src={resolveUrl(req.mentee?.photo_url) || dicebear(req.mentee?.name)}
                    alt={req.mentee?.name}
                    className="dash-request-avatar"
                  />
                  <div className="dash-request-info">
                    <span className="dash-request-name">{req.mentee?.name}</span>
                    <span className="dash-request-goal">{req.goals?.slice(0, 50)}...</span>
                  </div>
                  <Link to="/mentorship" className="dash-btn small secondary">
                    Review
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* My Job Applications */}
        {myJobApplications.length > 0 && (
          <section className="dash-card">
            <div className="dash-card-header">
              <h2><BriefcaseIcon /> Your Applications</h2>
              <Link to="/jobs" className="dash-link">
                View All <ArrowRightIcon />
              </Link>
            </div>
            <div className="dash-applications-list">
              {myJobApplications.slice(0, 3).map((app) => (
                <div key={app.id} className="dash-application-item">
                  <div className="dash-application-info">
                    <span className="dash-application-title">{app.job?.title}</span>
                    <span className="dash-application-company">{app.job?.company}</span>
                  </div>
                  <span className={`dash-application-status ${app.status}`}>
                    {app.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Active Mentorships */}
        {mentorships.length > 0 && (
          <section className="dash-card">
            <div className="dash-card-header">
              <h2><GraduationCapIcon /> Active Mentorships</h2>
              <Link to="/mentorship" className="dash-link">
                View All <ArrowRightIcon />
              </Link>
            </div>
            <div className="dash-mentorships-list">
              {mentorships.slice(0, 3).map((m) => {
                const otherUser = m.mentor_id === user?.id ? m.mentee : m.mentor;
                const role = m.mentor_id === user?.id ? 'Mentee' : 'Mentor';
                return (
                  <div key={m.id} className="dash-mentorship-item">
                    <img
                      src={resolveUrl(otherUser?.photo_url) || dicebear(otherUser?.name)}
                      alt={otherUser?.name}
                      className="dash-mentorship-avatar"
                    />
                    <div className="dash-mentorship-info">
                      <span className="dash-mentorship-name">{otherUser?.name}</span>
                      <span className="dash-mentorship-role">Your {role}</span>
                    </div>
                    <Link
                      to={`/messages?chat=${m.conversation_id || ''}`}
                      className="dash-btn small secondary"
                    >
                      Message
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Main 2x2 Grid */}
      <div className="dash-main-grid">

        {/* 1. Upcoming Events (with Calendar) */}
        <section className="dash-card">
          <div className="dash-card-header">
            <h2><CalendarIcon /> Upcoming Events</h2>
            <Link to="/events" className="dash-link">
              View All <ArrowRightIcon />
            </Link>
          </div>

          <div className="mini-calendar">
            <div className="mc-header">
              <button onClick={handlePrevMonth} className="mc-nav-btn">&lt;</button>
              <span className="mc-month">
                {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={handleNextMonth} className="mc-nav-btn">&gt;</button>
            </div>
            <div className="mc-grid">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                <div key={d} className="mc-day-name">{d}</div>
              ))}
              {Array.from({ length: startDay }).map((_, i) => (
                <div key={`empty-${i}`} className="mc-day empty" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                return (
                  <div
                    key={day}
                    className={`mc-day ${isToday(day) ? 'today' : ''} ${hasEvent(day) ? 'has-event' : ''} ${isSelected(day) ? 'mc-selected-date' : ''}`}
                    onClick={() => setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))}
                  >
                    {day}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="dash-events-preview">
            {selectedEvents.length > 0 ? (
              selectedEvents.map(event => (
                <Link
                  key={event.id}
                  to={`/events/${event.id}`}
                  className="dash-event-item"
                  style={{ marginBottom: '0.5rem' }}
                >
                  <div className="dash-event-info">
                    <span className="dash-event-title">{event.title}</span>
                    <div className="dash-event-meta">
                      <span><ClockIcon /> {formatEventDate(event.start_time)}</span>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', margin: '0.5rem 0' }}>
                No events on {selectedDate.toLocaleDateString()}
              </p>
            )}
            <Link to="/events" className="dash-btn small secondary" style={{ width: '100%', marginTop: '0.5rem', textAlign: 'center', justifyContent: 'center' }}>
              Browse All Events
            </Link>
          </div>
        </section>

        {/* 2. Recommended for You */}
        <section className="dash-card highlight">
          <div className="dash-card-header">
            <h2>Recommended for You</h2>
            <Link to="/recommendations" className="dash-link">
              View All <ArrowRightIcon />
            </Link>
          </div>
          {recommendations.length > 0 ? (
            <div className="dash-recommendations">
              {recommendations.map((rec) => {
                // API returns items with target_user_id, not nested user object
                const userId = rec.target_user_id || rec.id || rec.user?.id;
                const name = rec.name || rec.user?.name;
                const photoUrl = rec.photo_url || rec.user?.photo_url;
                const headline = rec.mentor_headline || rec.role || rec.user?.headline;
                // Use short reason if available
                const reason = rec.reason_short || rec.reason || "Recommended based on your profile";

                if (!userId) return null;

                return (
                  <div key={userId} className="dash-rec-item">
                    <img
                      src={resolveUrl(photoUrl) || dicebear(name)}
                      alt={name}
                      className="dash-rec-avatar"
                    />
                    <div className="dash-rec-info">
                      <span className="dash-rec-name">{name}</span>
                      <span className="dash-rec-headline">
                        {headline}
                      </span>
                      <span className="dash-rec-reason">{reason}</span>
                    </div>
                    <Link to={`/profile/${userId}`} className="dash-btn small secondary">
                      View
                    </Link>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="dash-empty">
              <UsersIcon />
              {hasRecommendationProfileSignals ? (
                <>
                  <span>No new matches found</span>
                  <p>Check back later for new alumni connections</p>
                </>
              ) : (
                <>
                  <span>No recommendations yet</span>
                  <p>Complete your profile with skills and interests to get personalized recommendations</p>
                </>
              )}
            </div>
          )}
        </section>

        {/* 3. Quick Actions */}
        <section className="dash-card">
          <div className="dash-card-header">
            <h2>Quick Actions</h2>
          </div>
          <div className="dash-quick-actions">
            <Link to="/directory" className="dash-quick-action">
              <UsersIcon />
              <span>Find Alumni</span>
            </Link>
            <Link to="/mentorship" className="dash-quick-action">
              <GraduationCapIcon />
              <span>Find a Mentor</span>
            </Link>
            <Link to="/jobs" className="dash-quick-action">
              <BriefcaseIcon />
              <span>Browse Jobs</span>
            </Link>
            <Link to="/events" className="dash-quick-action">
              <CalendarIcon />
              <span>View Events</span>
            </Link>
          </div>
        </section>

        {/* 4. Recent Jobs */}
        <section className="dash-card">
          <div className="dash-card-header">
            <h2><BriefcaseIcon /> Recent Job Postings</h2>
            <Link to="/jobs" className="dash-link">
              View All <ArrowRightIcon />
            </Link>
          </div>
          {recentJobs.length > 0 ? (
            <div className="dash-jobs-list">
              {recentJobs.slice(0, 4).map((job) => (
                <Link
                  key={job.id}
                  to={`/jobs/${job.id}`}
                  className="dash-job-item"
                >
                  <div className="dash-job-icon">
                    <BuildingIcon />
                  </div>
                  <div className="dash-job-info">
                    <span className="dash-job-title">{job.title}</span>
                    <span className="dash-job-company">{job.company}</span>
                    <div className="dash-job-meta">
                      {job.location && <span><MapPinIcon /> {job.location}</span>}
                      {job.employment_type && <span>{job.employment_type.replaceAll('_', ' ')}</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="dash-empty">
              <BriefcaseIcon />
              <span>No job postings yet</span>
              <Link to="/jobs" className="dash-btn small secondary">
                Browse Jobs
              </Link>
            </div>
          )}
        </section>

      </div>
    </div>
  );
};

export default Dashboard;
