import { NavLink, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Logo from '../../images/aitu-logo__2.png';

const AppShell = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const primaryNav = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/directory', label: user?.role === 'STUDENT' ? 'Mentors' : 'Directory' },
    { to: '/jobs', label: 'Jobs' },
    { to: '/events', label: 'Events' },
    { to: '/messages', label: 'Messages' },
    { to: '/friends', label: 'Friends' },
    { to: '/recommendations', label: 'Recommendations' },
    { to: '/ai', label: 'AI Assistant' },
  ];

  const secondaryNav = [
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
        <div className="shell-logo brand-logo" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link to="/dashboard" className="brand-home" style={{ display: 'inline-flex' }}>
            <img
              src={Logo}
              alt="Alumni Network"
              style={{ maxWidth: '100px', height: 'auto' }}
            />
          </Link>
          <span style={{ fontWeight: 700, color: '#111', textDecoration: 'none' }}>Alumni Network</span>
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
        <div className="shell-content">{children}</div>
      </main>
    </div>
  );
};

export default AppShell;

