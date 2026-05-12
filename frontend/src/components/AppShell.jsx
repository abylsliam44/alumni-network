import { NavLink, useLocation, Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { canModerateJobs, canPostJobs } from '../utils/jobPermissions';
import NotificationDropdown from './NotificationDropdown';
import Icon, { AituGlyph } from './ui/Icon';
import ThemeToggle from './ui/ThemeToggle';

const SEGMENT_LABEL = {
  dashboard: 'Dashboard',
  feed: 'Feed',
  directory: 'Directory',
  mentorship: 'Mentorship',
  'become-mentor': 'Become a Mentor',
  jobs: 'Jobs',
  projects: 'Projects',
  hiring: 'Hiring',
  applications: 'Applications',
  events: 'Events',
  messages: 'Messages',
  friends: 'Connections',
  recommendations: 'Recommendations',
  opportunities: 'Opportunities',
  ai: 'AqyldyAI',
  profile: 'Profile',
  settings: 'Settings',
  edit: 'Edit',
  'resume-import': 'Resume Import',
  create: 'Create',
  admin: 'Admin',
  'video-call': 'Video Call',
};

const titlecase = (s = '') =>
  s
    .split('-')
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(' ');

const buildCrumb = (pathname) => {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return ['Alumni Networking Platform', 'Dashboard'];
  const labelled = parts.map((p, i) => {
    if (SEGMENT_LABEL[p]) return SEGMENT_LABEL[p];
    if (/^[a-f0-9-]{6,}$/i.test(p)) return parts[i - 1] === 'profile' ? 'Member' : 'Detail';
    if (/^[0-9]+$/.test(p)) return 'Detail';
    return titlecase(p);
  });
  if (labelled.length === 1) return ['Alumni Networking Platform', labelled[0]];
  return labelled.slice(0, 3);
};

const initials = (name = 'AK') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

const AppShell = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const crumb = buildCrumb(location.pathname);
  const showHiring = canPostJobs(user) || canModerateJobs(user);

  const primaryNav = [
    { to: '/dashboard', label: 'Dashboard', icon: 'home' },
    { to: '/directory', label: user?.role === 'STUDENT' ? 'Mentors' : 'Directory', icon: 'users' },
    { to: '/mentorship', label: 'Mentorship', icon: 'graph' },
    { to: '/jobs', label: 'Jobs', icon: 'briefcase' },
    { to: '/projects', label: 'Projects', icon: 'bookmark' },
    { to: '/jobs/applications', label: 'My Applications', icon: 'doc' },
    ...(showHiring ? [{ to: '/jobs/hiring', label: 'Hiring', icon: 'building' }] : []),
    { to: '/events', label: 'Events', icon: 'calendar' },
    { to: '/messages', label: 'Messages', icon: 'msg' },
    { to: '/friends', label: 'Connections', icon: 'heart' },
    { to: '/recommendations', label: 'Recommendations', icon: 'spark' },
    ...(!user?.is_admin && user?.role !== 'STAFF'
      ? [{ to: '/opportunities', label: 'Opportunities', icon: 'search' }]
      : []),
    { to: '/ai', label: 'AqyldyAI', icon: 'bot' },
  ];

  const secondaryNav = [
    { to: '/profile/resume-import', label: 'Resume Import', icon: 'upload' },
    ...(user?.role === 'ALUMNI' && !user?.is_mentor
      ? [{ to: '/become-mentor', label: 'Become a Mentor', icon: 'graph' }]
      : []),
    { to: '/settings', label: 'Settings', icon: 'settings' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isFullBleedPage =
    location.pathname.startsWith('/messages') ||
    location.pathname.startsWith('/video-call') ||
    location.pathname.startsWith('/ai');

  return (
    <div className="app-shell">
      <aside className="rail">
        <Link to="/dashboard" className="rail-mark" aria-label="Alumni Networking Platform">
          <AituGlyph size={22} color="var(--bg)" accent="var(--blue-2)" />
        </Link>

        {primaryNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `rail-btn${isActive ? ' active' : ''}`}
            title={item.label}
          >
            <Icon name={item.icon} />
          </NavLink>
        ))}

        <div className="rail-spacer" />
        <div className="rail-divider" />

        {secondaryNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `rail-btn${isActive ? ' active' : ''}`}
            title={item.label}
          >
            <Icon name={item.icon} />
          </NavLink>
        ))}
        <button
          type="button"
          className="rail-btn"
          onClick={handleLogout}
          title="Logout"
          style={{ background: 'transparent', border: 'none' }}
        >
          <Icon name="logout" />
        </button>
        <Link to="/profile" className="rail-avatar" title={user?.name || 'Profile'}>
          {initials(user?.name)}
        </Link>
      </aside>

      <main className="stage">
        <header className="topbar">
          <div className="topbar-crumb">
            {crumb.map((part, index) => (
              <span key={`${part}-${index}`}>
                {index > 0 && <span className="sep">/</span>}{' '}
                {index === crumb.length - 1 ? <b>{part}</b> : <span>{part}</span>}
              </span>
            ))}
          </div>

          <div className="topbar-search" aria-hidden="true">
            <Icon name="search" size={13} />
            <span style={{ flex: 1 }}>Search alumni, jobs, events…</span>
            <kbd>⌘K</kbd>
          </div>

          <div className="topbar-actions">
            <ThemeToggle />
            <NotificationDropdown />
            <Link to="/profile" className="iconbtn" title={user?.name || 'Profile'}>
              <span style={{
                width: 22, height: 22, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--warm), #b8845c)',
                display: 'grid', placeItems: 'center',
                fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, color: '#2a1f15',
              }}>
                {initials(user?.name)}
              </span>
            </Link>
          </div>
        </header>

        <div className={`shell-content${isFullBleedPage ? ' full-bleed' : ''}`}>
          <div className={isFullBleedPage ? 'page-container-full' : 'page-container'}>
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default AppShell;
