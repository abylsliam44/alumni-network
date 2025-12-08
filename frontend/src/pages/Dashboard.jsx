import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/ui/Button';

const Dashboard = () => {
  const { user, logout } = useAuth();

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Dashboard</h1>
        <div className="user-info">
          <span>Welcome, {user?.name} ({user?.role})</span>
          <Link to="/profile">
            <Button variant="secondary">View Profile</Button>
          </Link>
          <Link to="/directory">
            <Button variant="primary">Browse Directory</Button>
          </Link>
          <Button onClick={logout} variant="secondary">Logout</Button>
        </div>
      </header>
      <main className="dashboard-content">
        <div className="card">
          <h3>Your Activity</h3>
          <p>You are logged in as {user?.email}</p>
        </div>

        <div className="grid-vertical" style={{ marginTop: '1.5rem' }}>
          <div className="card">
            <h3>Shortcuts</h3>
            <div className="pill-row">
              <Link to="/directory"><Button variant="secondary">Directory</Button></Link>
              <Link to="/mentorship"><Button variant="secondary">Mentorship</Button></Link>
              <Link to="/jobs"><Button variant="secondary">Jobs</Button></Link>
              <Link to="/events"><Button variant="secondary">Events</Button></Link>
              <Link to="/messages"><Button variant="secondary">Messages</Button></Link>
            </div>
          </div>

          <div className="card">
            <h3>Getting Started</h3>
            <p className="text-secondary">
              Complete your profile, explore the directory, and send your first mentorship request.
            </p>
          </div>

          <div className="card">
            <h3>Upcoming</h3>
            <p className="text-secondary">No upcoming events yet. Register on the Events page to see them here.</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
