import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Button from './ui/Button';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/feed', label: 'Feed' },
  { to: '/mentorship', label: 'Mentorship' },
  { to: '/jobs', label: 'Jobs' },
  { to: '/events', label: 'Events' },
  { to: '/messages', label: 'Messages' },
  { to: '/recommendations', label: 'Recommendations' },
  { to: '/ai', label: 'AI Assistant' },
];

const secondaryItems = [
  { to: '/settings', label: 'Settings' },
  { to: '/logout', label: 'Logout' },
];

const AppShell = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const handleNavClick = (item) => {
    if (item.to === '/logout') {
      logout();
    }
  };

  return (
    <div className="app-shell">
      <aside className="shell-sidebar">
        <div className="shell-logo">AlumniHub</div>
        <nav className="shell-nav">
          {navItems.map((item) => (
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
          {secondaryItems.map((item) => (
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
        <header className="shell-topbar">
          <div className="shell-search">
            <input placeholder="Search mentors, jobs, events..." />
          </div>
          <div className="shell-user">
            <span className="name">{user?.name}</span>
            <Button variant="secondary" onClick={logout}>Logout</Button>
          </div>
        </header>
        <div className="shell-content">{children}</div>
      </main>
    </div>
  );
};

export default AppShell;

