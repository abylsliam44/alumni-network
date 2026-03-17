import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { eventsApi } from '../api/events';
import { useAuth } from '../context/AuthContext';
import PageIntro from '../components/PageIntro';
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
  const canApproveEvents = user?.is_admin || user?.role === 'STAFF';

  return (
    <div className="page events-page">
      <PageIntro
        className="events-page-intro"
        eyebrow="Community & Networking"
        title="Events"
        subtitle="Connect, learn, and grow with the alumni community."
        side={(
          <div className="page-intro-side-stack">
            <div className="page-intro-actions">
              {canApproveEvents && (
                <Button
                  variant="secondary"
                  className="page-intro-button page-intro-button-secondary"
                  onClick={() => navigate('/events/admin')}
                >
                  Review Pending
                </Button>
              )}
              {canCreateEvent && (
                <Button
                  className="page-intro-button"
                  onClick={() => navigate('/events/create')}
                >
                  + Create Event
                </Button>
              )}
            </div>
          </div>
        )}
      />

      {/* Modern Filter Bar */}
      <div className="events-filters-bar elevated">
        <div className="search-wrapper">
          <input
            type="text"
            placeholder="Search events..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
          />
        </div>

        <div className="filters-group">
          <select
            value={filters.type}
            onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
            className="filter-select"
          >
            <option value="">All Types</option>
            <option value="career">Career</option>
            <option value="educational">Educational</option>
            <option value="networking">Networking</option>
            <option value="recruiting">Recruiting</option>
            <option value="invite-only">Invite Only</option>
          </select>

          <select
            value={filters.format}
            onChange={(e) => setFilters(prev => ({ ...prev, format: e.target.value }))}
            className="filter-select"
          >
            <option value="">All Formats</option>
            <option value="online">Online</option>
            <option value="offline">In-Person</option>
            <option value="hybrid">Hybrid</option>
          </select>

          <label className="toggle-label">
            <input
              type="checkbox"
              checked={filters.upcoming_only}
              onChange={(e) => setFilters(prev => ({ ...prev, upcoming_only: e.target.checked }))}
            />
            <span className="toggle-text">Upcoming only</span>
          </label>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading events...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="empty-state-card elevated">
          <div className="empty-icon">📅</div>
          <h3>No events found</h3>
          <p>
            {filters.upcoming_only
              ? 'No upcoming events match your criteria. Try adjusting filters.'
              : 'No events match your criteria.'}
          </p>
          {canCreateEvent && (
            <Button className="btn-primary" onClick={() => navigate('/events/create')}>
              Create First Event
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="events-grid">
            {events.map((event) => {
              const dateObj = new Date(event.start_time);
              const month = dateObj.toLocaleString('en-US', { month: 'short' });
              const day = dateObj.getDate();

              return (
                <Card key={event.id} className="event-card-modern elevated">
                  <div className="card-top">
                    {/* Date Box */}
                    <div className="date-box">
                      <span className="date-month">{month}</span>
                      <span className="date-day">{day}</span>
                    </div>

                    <div className="card-header-content">
                      <div className="badges-row">
                        <span
                          className="type-pill"
                          style={{
                            color: EVENT_TYPES[event.type]?.color || 'var(--text-secondary)',
                            backgroundColor: `${EVENT_TYPES[event.type]?.color || '#666'}15`,
                            borderColor: `${EVENT_TYPES[event.type]?.color || '#666'}30`
                          }}
                        >
                          {EVENT_TYPES[event.type]?.label || event.type}
                        </span>
                        {event.status !== 'approved' && (
                          <span className={`status-pill status-${event.status}`}>
                            {STATUS_BADGES[event.status]?.label}
                          </span>
                        )}
                      </div>
                      <h3 className="card-title" title={event.title}>{event.title}</h3>
                      <p className="card-topic">{event.topic}</p>
                    </div>
                  </div>

                  <div className="card-body">
                    <div className="info-row">
                      <span className="icon">{FORMAT_ICONS[event.format]}</span>
                      <span>
                        {event.format === 'online' ? 'Online' :
                          event.format === 'hybrid' ? 'Hybrid' :
                            event.location || 'In-Person'}
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="icon">⏰</span>
                      <span>{dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {event.company_name && (
                      <div className="info-row company">
                        <span className="icon">🏢</span>
                        <span>{event.company_name}</span>
                      </div>
                    )}
                  </div>

                  <div className="card-footer">
                    {event.is_registered ? (
                      <div className={`user-status ${event.registration_status === 'WAITLISTED' ? 'waitlist' : 'registered'}`}>
                        {event.registration_status === 'WAITLISTED' ? '⏳ Waitlisted' : '✓ Registered'}
                      </div>
                    ) : (
                      <div className="spots-left">
                        {event.capacity ? (
                          <>
                            <span className="count">{Math.max(0, event.capacity - event.registrations_count)}</span> spots left
                          </>
                        ) : (
                          <span className="open-spots">Open Registration</span>
                        )}
                      </div>
                    )}

                    <Link to={`/events/${event.id}`} className="view-btn">
                      View Details &rarr;
                    </Link>
                  </div>
                </Card>
              );
            })}
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
          display: flex;
          flex-direction: column;
          gap: 24px;
          padding-bottom: 3rem;
        }

        .events-page-intro .page-intro-title {
          font-size: clamp(2.2rem, 4vw, 2.95rem);
        }

        /* Filters Bar */
        .events-filters-bar {
          background: var(--bg-elevated);
          padding: 1rem;
          border-radius: 20px;
          display: flex;
          gap: 1.5rem;
          align-items: center;
          margin-bottom: 0;
          border: 1px solid var(--border-color);
          box-shadow: var(--shadow-sm);
          flex-wrap: wrap;
        }

        .search-wrapper {
           flex: 1;
           min-width: 200px;
        }

        .search-wrapper input {
           width: 100%;
           min-height: 48px;
           padding: 0.75rem 1rem;
          border-radius: 14px;
          border: 1px solid var(--border-color);
          background: var(--bg-secondary);
          transition: all 0.2s;
        }

        .search-wrapper input:focus {
           background: var(--bg-primary);
           border-color: var(--accent-primary);
           box-shadow: 0 0 0 3px var(--accent-light);
           outline: none;
        }

        .filters-group {
          display: flex;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .filter-select {
          min-height: 48px;
          padding: 0.75rem 2rem 0.75rem 1rem;
          border-radius: 14px;
          border: 1px solid var(--border-color);
          background: var(--bg-secondary);
          color: var(--text-primary);
          cursor: pointer;
          min-width: 140px;
        }

        .toggle-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          font-weight: 500;
          font-size: 0.9rem;
          user-select: none;
        }

        /* Grid */
        .events-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 2rem;
        }

        /* Card Modern */
        .event-card-modern {
          padding: 1.5rem;
          border-radius: 20px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          height: 100%;
          position: relative;
          overflow: hidden;
        }

        .event-card-modern:hover {
          transform: translateY(-5px);
          box-shadow: 0 20px 40px -5px rgba(0,0,0,0.1);
          border-color: var(--accent-hover);
        }

        .card-top {
          display: flex;
          gap: 1.25rem;
          margin-bottom: 1.25rem;
        }

        .date-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: var(--bg-secondary);
          border-radius: 12px;
          width: 60px;
          height: 60px;
          flex-shrink: 0;
          color: var(--text-primary);
          border: 1px solid var(--border-color);
        }

        .date-month {
          font-size: 0.75rem;
          text-transform: uppercase;
          font-weight: 700;
          color: var(--accent-primary); /* Uses main accent in light mode */
        }
        
        [data-theme='dark'] .date-month {
           color: #60a5fa;
        }

        .date-day {
          font-size: 1.5rem;
          font-weight: 800;
          line-height: 1;
        }

        .card-header-content {
          flex: 1;
          min-width: 0; /* for truncation */
        }

        .badges-row {
           display: flex;
           gap: 0.5rem;
           margin-bottom: 0.5rem;
           flex-wrap: wrap;
        }

        .type-pill {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 0.2rem 0.6rem;
          border-radius: 20px;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          border: 1px solid transparent;
        }

        .status-pill {
           font-size: 0.7rem;
           padding: 0.2rem 0.6rem;
           border-radius: 20px;
           background: #e5e7eb;
           color: #374151;
        }

        .card-title {
          font-size: 1.25rem;
          font-weight: 700;
          margin: 0 0 0.25rem;
          line-height: 1.3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .card-topic {
          font-size: 0.9rem;
          color: var(--text-secondary);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .card-body {
          margin-bottom: auto; /* Pushes footer down */
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .info-row {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          font-size: 0.9rem;
          color: var(--text-secondary);
        }
        
        .info-row.company {
           color: var(--text-primary);
           font-weight: 500;
        }

        .icon {
          font-size: 1.1rem;
          width: 1.2rem;
          text-align: center;
        }

        .card-footer {
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border-subtle);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .spots-left {
          font-size: 0.85rem;
          color: var(--text-secondary);
        }
        
        .spots-left .count {
           font-weight: 700;
           color: var(--text-primary);
        }

        .open-spots {
           color: var(--success-color);
           font-weight: 600;
        }

        .user-status {
           font-size: 0.85rem;
           font-weight: 600;
        }
        .user-status.registered { color: var(--success-color); }
        .user-status.waitlist { color: #d97706; }

        .view-btn {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--accent-primary);
          text-decoration: none;
          transition: transform 0.2s;
        }

        .view-btn:hover {
          transform: translateX(3px);
          text-decoration: underline;
        }

        .empty-state-card {
           text-align: center;
           padding: 4rem;
           border-radius: 24px;
           background: var(--bg-elevated);
           border: 1px solid var(--border-color);
           box-shadow: var(--shadow-sm);
        }

        @media (max-width: 768px) {
          .events-filters-bar {
            flex-direction: column;
            align-items: stretch;
          }
          .filters-group {
             flex-direction: column;
             align-items: stretch;
          }
        }
      `}</style>
    </div>
  );
};

export default Events;
