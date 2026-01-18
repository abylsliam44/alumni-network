import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { eventsApi } from '../api/events';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';

// Event type labels and colors
const EVENT_TYPES = {
  career: { label: 'Career', color: 'var(--accent-blue)' },
  educational: { label: 'Educational', color: 'var(--accent-green)' },
  networking: { label: 'Networking', color: 'var(--accent-purple)' },
  recruiting: { label: 'Recruiting', color: 'var(--accent-orange)' },
  'invite-only': { label: 'Invite Only', color: 'var(--accent-red)' },
};

const FORMAT_ICONS = {
  online: '🌐',
  offline: '📍',
  hybrid: '🔄',
};

const STATUS_BADGES = {
  draft: { label: 'Draft', className: 'badge-secondary' },
  pending: { label: 'Pending Review', className: 'badge-warning' },
  approved: { label: 'Open', className: 'badge-success' },
  cancelled: { label: 'Cancelled', className: 'badge-danger' },
  completed: { label: 'Completed', className: 'badge-info' },
};

const Events = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    type: '',
    format: '',
    upcoming_only: true,
    search: '',
  });

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, limit: 12 };
      if (filters.type) params.type = filters.type;
      if (filters.format) params.format = filters.format;
      if (filters.search) params.search = filters.search;
      params.upcoming_only = filters.upcoming_only;

      const data = await eventsApi.list(params);
      setEvents(data.items);
      setTotalPages(data.pages);
    } catch (err) {
      console.error('Failed to load events:', err);
      setError('Failed to load events. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleRegister = async (eventId) => {
    try {
      await eventsApi.register(eventId);
      fetchEvents();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to register');
    }
  };

  const handleUnregister = async (eventId) => {
    try {
      await eventsApi.unregister(eventId);
      fetchEvents();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to unregister');
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const canCreateEvent = user && (user.role === 'ALUMNI' || user.is_admin);
  const isAdmin = user?.is_admin;

  return (
    <div className="page events-page">
      <div className="page-header">
        <div className="page-header-content">
          <h1>Events</h1>
          <p className="text-secondary">Discover and join alumni events, workshops, and networking sessions</p>
        </div>
        <div className="page-header-actions">
          {isAdmin && (
            <Button
              className="btn-secondary"
              onClick={() => navigate('/events/admin')}
            >
              Review Pending
            </Button>
          )}
          {canCreateEvent && (
            <Button
              className="btn-primary"
              onClick={() => navigate('/events/create')}
            >
              + Create Event
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="events-filters">
        <div className="filter-group">
          <input
            type="text"
            placeholder="Search events..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="input"
          />
        </div>
        <div className="filter-group">
          <select
            value={filters.type}
            onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
            className="input"
          >
            <option value="">All Types</option>
            <option value="career">Career</option>
            <option value="educational">Educational</option>
            <option value="networking">Networking</option>
            <option value="recruiting">Recruiting</option>
            <option value="invite-only">Invite Only</option>
          </select>
        </div>
        <div className="filter-group">
          <select
            value={filters.format}
            onChange={(e) => setFilters(prev => ({ ...prev, format: e.target.value }))}
            className="input"
          >
            <option value="">All Formats</option>
            <option value="online">Online</option>
            <option value="offline">In-Person</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>
        <label className="filter-checkbox">
          <input
            type="checkbox"
            checked={filters.upcoming_only}
            onChange={(e) => setFilters(prev => ({ ...prev, upcoming_only: e.target.checked }))}
          />
          <span>Upcoming only</span>
        </label>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading events...</p>
        </div>
      ) : events.length === 0 ? (
        <Card className="empty-state">
          <div className="empty-icon">📅</div>
          <h3>No events found</h3>
          <p className="text-secondary">
            {filters.upcoming_only
              ? 'No upcoming events match your criteria. Try adjusting filters or check back later.'
              : 'No events match your criteria.'}
          </p>
          {canCreateEvent && (
            <Button className="btn-primary" onClick={() => navigate('/events/create')}>
              Create First Event
            </Button>
          )}
        </Card>
      ) : (
        <>
          <div className="events-grid">
            {events.map((event) => (
              <Card key={event.id} className="event-card elevated">
                <div className="event-card-header">
                  <span
                    className="event-type-badge"
                    style={{ backgroundColor: EVENT_TYPES[event.type]?.color || 'var(--bg-tertiary)' }}
                  >
                    {EVENT_TYPES[event.type]?.label || event.type}
                  </span>
                  {event.status !== 'approved' && (
                    <span className={`status-badge ${STATUS_BADGES[event.status]?.className}`}>
                      {STATUS_BADGES[event.status]?.label}
                    </span>
                  )}
                </div>

                <h3 className="event-title">{event.title}</h3>
                <p className="event-topic">{event.topic}</p>

                <div className="event-meta">
                  <div className="meta-item">
                    <span className="meta-icon">📅</span>
                    <span>{formatDate(event.start_time)}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-icon">{FORMAT_ICONS[event.format]}</span>
                    <span>
                      {event.format === 'online' ? 'Online' :
                        event.format === 'hybrid' ? 'Hybrid' :
                          event.location || 'In-Person'}
                    </span>
                  </div>
                  {event.capacity && (
                    <div className="meta-item">
                      <span className="meta-icon">👥</span>
                      <span>
                        {event.registrations_count}/{event.capacity}
                        {event.waitlist_count > 0 && ` (+${event.waitlist_count} waitlist)`}
                      </span>
                    </div>
                  )}
                </div>

                {event.company_name && (
                  <div className="event-company">
                    <span className="company-icon">🏢</span>
                    <span>{event.company_name}</span>
                  </div>
                )}

                <div className="event-card-footer">
                  <Link to={`/events/${event.id}`} className="btn btn-secondary btn-sm">
                    View Details
                  </Link>
                  {event.status === 'approved' && !event.is_registered && (
                    <Button
                      className="btn-primary btn-sm"
                      onClick={() => handleRegister(event.id)}
                    >
                      {event.capacity && event.registrations_count >= event.capacity
                        ? 'Join Waitlist'
                        : 'Register'}
                    </Button>
                  )}
                  {event.is_registered && (
                    <div className="registration-status">
                      <span className={`status-pill ${event.registration_status === 'WAITLISTED' ? 'waitlisted' : 'registered'}`}>
                        {event.registration_status === 'WAITLISTED' ? '⏳ Waitlisted' : '✓ Registered'}
                      </span>
                      <button
                        className="btn-link text-danger"
                        onClick={() => handleUnregister(event.id)}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <Button
                className="btn-secondary btn-sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </Button>
              <span className="page-info">Page {page} of {totalPages}</span>
              <Button
                className="btn-secondary btn-sm"
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <style>{`
        .events-page {
          max-width: 1200px;
          margin: 0 auto;
        }
        
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        
        .page-header-actions {
          display: flex;
          gap: 0.75rem;
        }
        
        .events-filters {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          margin-bottom: 1.5rem;
          padding: 1rem;
          background: var(--bg-secondary);
          border-radius: 12px;
        }
        
        .filter-group {
          flex: 1;
          min-width: 150px;
        }
        
        .filter-group .input {
          width: 100%;
        }
        
        .filter-checkbox {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          white-space: nowrap;
        }
        
        .events-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1.5rem;
        }
        
        .event-card {
          display: flex;
          flex-direction: column;
          padding: 1.25rem;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .event-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        }
        
        .event-card-header {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }
        
        .event-type-badge {
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          color: white;
        }
        
        .status-badge {
          font-size: 0.7rem;
          padding: 0.2rem 0.4rem;
          border-radius: 4px;
          font-weight: 500;
        }
        
        .badge-secondary { background: var(--bg-tertiary); color: var(--text-secondary); }
        .badge-warning { background: #f59e0b; color: white; }
        .badge-success { background: #10b981; color: white; }
        .badge-danger { background: #ef4444; color: white; }
        .badge-info { background: #3b82f6; color: white; }
        
        .event-title {
          font-size: 1.125rem;
          font-weight: 600;
          margin: 0 0 0.25rem;
          color: var(--text-primary);
        }
        
        .event-topic {
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin: 0 0 1rem;
        }
        
        .event-meta {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }
        
        .meta-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: var(--text-secondary);
        }
        
        .meta-icon {
          font-size: 1rem;
          width: 1.25rem;
        }
        
        .event-company {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: var(--text-secondary);
          padding: 0.5rem;
          background: var(--bg-secondary);
          border-radius: 6px;
          margin-bottom: 1rem;
        }
        
        .event-card-footer {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: auto;
          padding-top: 1rem;
          border-top: 1px solid var(--border-color);
        }
        
        .registration-status {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-left: auto;
        }
        
        .status-pill {
          font-size: 0.75rem;
          font-weight: 500;
          padding: 0.25rem 0.5rem;
          border-radius: 12px;
        }
        
        .status-pill.registered {
          background: #d1fae5;
          color: #065f46;
        }
        
        .status-pill.waitlisted {
          background: #fef3c7;
          color: #92400e;
        }
        
        .btn-link {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 0.75rem;
        }
        
        .text-danger { color: #ef4444; }
        
        .loading-state, .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          text-align: center;
        }
        
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--bg-tertiary);
          border-top-color: var(--accent-primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .empty-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }
        
        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 1rem;
          margin-top: 2rem;
        }
        
        .page-info {
          font-size: 0.875rem;
          color: var(--text-secondary);
        }
        
        .btn-sm {
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
};

export default Events;
