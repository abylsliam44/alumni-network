import { NavLink, useLocation, Link, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import NotificationDropdown from './NotificationDropdown';
import Logo from '../../images/aitu-logo__2.png';
import { AnimatePresence, motion } from 'framer-motion';

const AppShell = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const primaryNav = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/directory', label: user?.role === 'STUDENT' ? 'Mentors' : 'Directory' },
    { to: '/mentorship', label: 'Mentorship' },
    { to: '/jobs', label: 'Jobs' },
    { to: '/events', label: 'Events' },
    { to: '/messages', label: 'Messages' },
    { to: '/friends', label: 'Friends' },
    { to: '/recommendations', label: 'Recommendations' },
    ...(!user?.is_admin && user?.role !== 'STAFF'
      ? [{ to: '/opportunities', label: 'Find Opportunities' }]
      : []),
    { to: '/ai', label: 'AqyldyAI' },
  ];

  const secondaryNav = [
    { to: '/profile/resume-import', label: 'Resume Import' },
    ...(user?.role === 'ALUMNI' && !user?.is_mentor
      ? [{ to: '/become-mentor', label: 'Become a Mentor' }]
      : []),
    { to: '/settings', label: 'Settings' },
    { to: '/logout', label: 'Logout' },
  ];

  const handleNavClick = (item) => {
    if (item.to === '/logout') {
      logout();
    }
  };

  return (
    <div className="app-shell">
      <aside className="shell-sidebar">
        <div className="shell-brand-wrapper">
          <Link to="/dashboard" className="shell-brand">
            <img src={Logo} alt="AITU" className="shell-brand-logo" />
            <div className="shell-brand-text">
              <span className="shell-brand-name">Alumni</span>
              <span className="shell-brand-name">Network</span>
            </div>
          </Link>
        </div>

        <nav className="shell-nav">
          {primaryNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `shell-nav-item ${isActive ? 'active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="shell-nav secondary">
          <NotificationDropdown />
          {secondaryNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to === '/logout' ? location.pathname : item.to}
              onClick={() => handleNavClick(item)}
              className="shell-nav-item"
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </aside>

      <main className="shell-main">
        <div className="shell-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className={
                location.pathname.startsWith('/messages') || location.pathname.startsWith('/video-call')
                  ? 'page-container-full'
                  : 'page-container'
              }
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default AppShell;
