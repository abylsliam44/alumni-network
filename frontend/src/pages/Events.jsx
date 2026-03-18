import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { eventsApi } from '../api/events';
import { useAuth } from '../context/AuthContext';
import PageIntro from '../components/PageIntro';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 2v4" />
    <path d="M16 2v4" />
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M3 10h18" />
  </svg>
);

const ClockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);

const LocationIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21s-6-4.35-6-10a6 6 0 1 1 12 0c0 5.65-6 10-6 10Z" />
    <circle cx="12" cy="11" r="2.5" />
  </svg>
);

const GlobeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
  </svg>
);

const UsersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ArrowUpRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17 17 7" />
    <path d="M7 7h10v10" />
  </svg>
);

const EVENT_TYPES = {
  career: { label: 'Career', color: '#2f6fed' },
  educational: { label: 'Educational', color: '#1f9d67' },
  networking: { label: 'Networking', color: '#c06c2f' },
  recruiting: { label: 'Recruiting', color: '#d9485f' },
  'invite-only': { label: 'Invite Only', color: '#6d5bd0' },
};

const EVENT_FORMATS = {
  online: { label: 'Online', icon: <GlobeIcon /> },
  offline: { label: 'In Person', icon: <LocationIcon /> },
  hybrid: { label: 'Hybrid', icon: <GlobeIcon /> },
};

const STATUS_BADGES = {
  draft: { label: 'Draft', tone: 'muted' },
  pending: { label: 'Pending Review', tone: 'warning' },
  approved: { label: 'Open', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
  completed: { label: 'Completed', tone: 'neutral' },
};

const formatCalendarParts = (dateValue) => {
  const date = new Date(dateValue);
  return {
    month: date.toLocaleDateString('en-US', { month: 'short' }),
    day: date.toLocaleDateString('en-US', { day: '2-digit' }),
    weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
    fullDate: date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
  };
};

const formatTimeRange = (startValue, endValue) => {
  const start = new Date(startValue);
  const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (!endValue) {
    return startTime;
  }

  const end = new Date(endValue);
  const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (start.toDateString() === end.toDateString()) {
    return `${startTime} - ${endTime}`;
  }

  return `${startTime} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${endTime}`;
};

const getVenueLabel = (event) => {
  if (event.format === 'online') {
    return 'Online event';
  }
  if (event.format === 'hybrid') {
    return event.location ? `Hybrid · ${event.location}` : 'Hybrid format';
  }
  return event.location || 'In-person event';
};

const getCapacityCopy = (event) => {
  if (event.is_registered) {
    return event.registration_status === 'WAITLISTED' ? 'You are on the waitlist' : 'You are registered';
  }
  if (event.capacity) {
    return `${Math.max(0, event.capacity - event.registrations_count)} seats left`;
  }
  return 'Open registration';
};

const getDescriptionCopy = (event) => {
  if (event.description?.trim()) {
    return event.description.trim();
  }
  return `${event.topic} session for students, alumni, and community members looking to stay connected.`;
};

const EventCard = ({ event, onRegister, onUnregister }) => {
  const accent = EVENT_TYPES[event.type]?.color || '#475569';
  const dateParts = formatCalendarParts(event.start_time);
  const status = STATUS_BADGES[event.status] || STATUS_BADGES.approved;
  const formatMeta = EVENT_FORMATS[event.format] || EVENT_FORMATS.offline;

  return (
    <div className="card event-card-modern elevated" style={{ '--event-accent': accent }}>
      <div className="event-card-modern-top">
        <div className="event-date-stack">
          <span>{dateParts.month}</span>
          <strong>{dateParts.day}</strong>
          <small>{dateParts.weekday}</small>
        </div>

        <div className="event-card-modern-head">
          <div className="event-card-pill-row">
            <span
              className="event-type-pill"
              style={{
                color: accent,
                backgroundColor: `${accent}14`,
                borderColor: `${accent}2e`,
              }}
            >
              {EVENT_TYPES[event.type]?.label || event.type}
            </span>
            <span className={`event-status-pill tone-${status.tone}`}>{status.label}</span>
          </div>

          <h3>{event.title}</h3>
          <p>{event.topic}</p>
        </div>
      </div>

      <div className="event-card-copy">
        <p>{getDescriptionCopy(event)}</p>
      </div>

      <div className="event-meta-grid">
        <span className="event-meta-chip">
          <CalendarIcon />
          {dateParts.fullDate}
        </span>
        <span className="event-meta-chip">
          <ClockIcon />
          {formatTimeRange(event.start_time, event.end_time)}
        </span>
        <span className="event-meta-chip">
          {formatMeta.icon}
          {getVenueLabel(event)}
        </span>
        <span className="event-meta-chip">
          <UsersIcon />
          {getCapacityCopy(event)}
        </span>
      </div>

      <div className="event-card-modern-footer">
        <div className="event-card-host">
          {event.organizer?.name ? (
            <span>Hosted by {event.organizer.name}</span>
          ) : event.company_name ? (
            <span>{event.company_name}</span>
          ) : (
            <span>Alumni community event</span>
          )}
        </div>

        <div className="event-card-actions">
          {event.status === 'approved' && (
            event.is_registered ? (
              <button type="button" className="event-inline-action subtle" onClick={() => onUnregister(event.id)}>
                {event.registration_status === 'WAITLISTED' ? 'Leave waitlist' : 'Cancel'}
              </button>
            ) : (
              <button type="button" className="event-inline-action" onClick={() => onRegister(event.id)}>
                Register
              </button>
            )
          )}
          <Link to={`/events/${event.id}`} className="event-detail-link">
            View Details
            <ArrowUpRightIcon />
          </Link>
        </div>
      </div>
    </div>
  );
};

const Events = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
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
      setEvents(data.items || []);
      setTotalPages(data.pages || 1);
      setTotalCount(data.total || 0);
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

  const updateFilters = (patch) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const clearFilters = () => {
    setPage(1);
    setFilters({
      type: '',
      format: '',
      upcoming_only: true,
      search: '',
    });
  };

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

  const canCreateEvent = user && (user.role === 'ALUMNI' || user.is_admin);
  const canApproveEvents = user?.is_admin || user?.role === 'STAFF';
  const hasActiveFilters = Boolean(filters.type || filters.format || filters.search || !filters.upcoming_only);
  const featuredEvent = events[0] || null;
  const gridEvents = featuredEvent ? events.slice(1) : [];
  const registeredOnPage = events.filter((event) => event.is_registered).length;

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

      <div className="events-shell">
        <section className="events-toolbar-panel elevated">
          <div className="events-toolbar-main">
            <div className="events-search-field">
              <SearchIcon />
              <input
                type="text"
                placeholder="Search events, topics, or companies"
                value={filters.search}
                onChange={(e) => updateFilters({ search: e.target.value })}
              />
            </div>

            <div className="events-filter-controls">
              <select
                value={filters.type}
                onChange={(e) => updateFilters({ type: e.target.value })}
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
                onChange={(e) => updateFilters({ format: e.target.value })}
                className="filter-select"
              >
                <option value="">All Formats</option>
                <option value="online">Online</option>
                <option value="offline">In Person</option>
                <option value="hybrid">Hybrid</option>
              </select>

              <label className="events-toggle">
                <input
                  type="checkbox"
                  checked={filters.upcoming_only}
                  onChange={(e) => updateFilters({ upcoming_only: e.target.checked })}
                />
                <span>Upcoming only</span>
              </label>

              {hasActiveFilters && (
                <button type="button" className="events-clear-button" onClick={clearFilters}>
                  Reset filters
                </button>
              )}
            </div>
          </div>

          <div className="events-toolbar-meta">
            <div className="events-toolbar-stat">
              <span className="events-toolbar-label">Showing now</span>
              <strong>{events.length}</strong>
            </div>
            <div className="events-toolbar-stat">
              <span className="events-toolbar-label">Filtered total</span>
              <strong>{totalCount}</strong>
            </div>
            <div className="events-toolbar-stat">
              <span className="events-toolbar-label">Registered on page</span>
              <strong>{registeredOnPage}</strong>
            </div>
            <div className="events-toolbar-page">
              <span>Page</span>
              <strong>{page} / {Math.max(totalPages, 1)}</strong>
            </div>
          </div>
        </section>

        {error && <Alert type="error">{error}</Alert>}

        {loading ? (
          <div className="events-loading-layout">
            <div className="events-feature-skeleton elevated" />
            <div className="events-grid">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="event-card-skeleton elevated" />
              ))}
            </div>
          </div>
        ) : events.length === 0 ? (
          <div className="events-empty-state elevated">
            <div className="events-empty-mark">
              <CalendarIcon />
            </div>
            <h3>No events match this view</h3>
            <p>
              {filters.upcoming_only
                ? 'There are no upcoming sessions for the current filter set. Try widening the scope or switching formats.'
                : 'No events match the current search and filter combination.'}
            </p>
            <div className="events-empty-actions">
              {hasActiveFilters && (
                <button type="button" className="event-inline-action" onClick={clearFilters}>
                  Reset filters
                </button>
              )}
              {canCreateEvent && (
                <button type="button" className="event-inline-action subtle" onClick={() => navigate('/events/create')}>
                  Create Event
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {featuredEvent && (
              <section
                className="events-feature-card elevated"
                style={{ '--event-accent': EVENT_TYPES[featuredEvent.type]?.color || '#475569' }}
              >
                <div className="events-feature-copy">
                  <div className="events-feature-pill-row">
                    <span className="events-feature-kicker">Featured Event</span>
                    <span
                      className="event-type-pill"
                      style={{
                        color: EVENT_TYPES[featuredEvent.type]?.color || '#475569',
                        backgroundColor: `${EVENT_TYPES[featuredEvent.type]?.color || '#475569'}14`,
                        borderColor: `${EVENT_TYPES[featuredEvent.type]?.color || '#475569'}2e`,
                      }}
                    >
                      {EVENT_TYPES[featuredEvent.type]?.label || featuredEvent.type}
                    </span>
                  </div>

                  <h2>{featuredEvent.title}</h2>
                  <p className="events-feature-topic">{featuredEvent.topic}</p>
                  <p className="events-feature-description">{getDescriptionCopy(featuredEvent)}</p>

                  <div className="events-feature-meta-grid">
                    <span className="event-meta-chip">
                      <CalendarIcon />
                      {formatCalendarParts(featuredEvent.start_time).fullDate}
                    </span>
                    <span className="event-meta-chip">
                      <ClockIcon />
                      {formatTimeRange(featuredEvent.start_time, featuredEvent.end_time)}
                    </span>
                    <span className="event-meta-chip">
                      {(EVENT_FORMATS[featuredEvent.format] || EVENT_FORMATS.offline).icon}
                      {getVenueLabel(featuredEvent)}
                    </span>
                    <span className="event-meta-chip">
                      <UsersIcon />
                      {getCapacityCopy(featuredEvent)}
                    </span>
                  </div>

                  <div className="events-feature-actions">
                    {featuredEvent.status === 'approved' && (
                      featuredEvent.is_registered ? (
                        <button type="button" className="event-inline-action subtle" onClick={() => handleUnregister(featuredEvent.id)}>
                          {featuredEvent.registration_status === 'WAITLISTED' ? 'Leave waitlist' : 'Cancel registration'}
                        </button>
                      ) : (
                        <button type="button" className="event-inline-action" onClick={() => handleRegister(featuredEvent.id)}>
                          Register for event
                        </button>
                      )
                    )}
                    <Link to={`/events/${featuredEvent.id}`} className="event-detail-link feature-link">
                      Open event page
                      <ArrowUpRightIcon />
                    </Link>
                  </div>
                </div>

                <div className="events-feature-side">
                  <div className="events-feature-date">
                    <span>{formatCalendarParts(featuredEvent.start_time).month}</span>
                    <strong>{formatCalendarParts(featuredEvent.start_time).day}</strong>
                    <small>{formatCalendarParts(featuredEvent.start_time).weekday}</small>
                  </div>

                  <div className="events-feature-status-card">
                    <span className="events-feature-side-label">Event status</span>
                    <strong>{(STATUS_BADGES[featuredEvent.status] || STATUS_BADGES.approved).label}</strong>
                    <p>
                      {featuredEvent.organizer?.name
                        ? `Hosted by ${featuredEvent.organizer.name}`
                        : featuredEvent.company_name || 'Shared with the alumni community'}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {gridEvents.length > 0 && (
              <section className="events-grid-section">
                <div className="events-grid-heading">
                  <div>
                    <span className="events-grid-kicker">More events</span>
                    <h3>Upcoming sessions and community moments</h3>
                  </div>
                  <p>Browse the rest of the calendar and jump into the formats that match your schedule.</p>
                </div>

                <div className="events-grid">
                  {gridEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onRegister={handleRegister}
                      onUnregister={handleUnregister}
                    />
                  ))}
                </div>
              </section>
            )}

            {totalPages > 1 && (
              <div className="events-pagination">
                <button
                  type="button"
                  className="events-page-button"
                  disabled={page === 1}
                  onClick={() => setPage((prev) => prev - 1)}
                >
                  Previous
                </button>
                <div className="events-page-indicator">
                  <span>Page</span>
                  <strong>{page}</strong>
                  <span>of {totalPages}</span>
                </div>
                <button
                  type="button"
                  className="events-page-button"
                  disabled={page === totalPages}
                  onClick={() => setPage((prev) => prev + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .events-page {
          display: flex;
          flex-direction: column;
          gap: 28px;
          padding-bottom: 3rem;
        }

        .events-page-intro .page-intro-title {
          font-size: clamp(2.45rem, 4.6vw, 3.5rem);
        }

        .events-shell {
          display: flex;
          flex-direction: column;
          gap: 26px;
        }

        .events-toolbar-panel {
          position: relative;
          overflow: hidden;
          padding: 24px;
          border-radius: 28px;
          border: 1px solid rgba(17, 24, 39, 0.08);
          background:
            radial-gradient(circle at top left, rgba(47, 111, 237, 0.12), transparent 32%),
            radial-gradient(circle at bottom right, rgba(192, 108, 47, 0.14), transparent 30%),
            var(--bg-elevated);
          box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
        }

        .events-toolbar-main {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.9fr);
          gap: 18px;
          align-items: center;
        }

        .events-search-field {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 58px;
          padding: 0 18px;
          border-radius: 18px;
          border: 1px solid rgba(17, 24, 39, 0.08);
          background: rgba(255, 255, 255, 0.88);
          color: var(--text-secondary);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
        }

        .events-search-field input {
          flex: 1;
          border: 0;
          background: transparent;
          color: var(--text-primary);
          font-size: 1rem;
          outline: none;
        }

        .events-search-field input::placeholder {
          color: #8b93a7;
        }

        .events-filter-controls {
          display: flex;
          align-items: center;
          gap: 12px;
          justify-content: flex-end;
          flex-wrap: wrap;
        }

        .filter-select {
          min-height: 50px;
          padding: 0.8rem 1rem;
          border-radius: 16px;
          border: 1px solid rgba(17, 24, 39, 0.09);
          background: rgba(255, 255, 255, 0.88);
          color: var(--text-primary);
          min-width: 156px;
          font-weight: 500;
          outline: none;
        }

        .events-toggle {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          min-height: 50px;
          padding: 0 14px;
          border-radius: 16px;
          border: 1px solid rgba(17, 24, 39, 0.08);
          background: rgba(255, 255, 255, 0.88);
          color: var(--text-primary);
          font-weight: 600;
          cursor: pointer;
        }

        .events-toggle input {
          margin: 0;
        }

        .events-clear-button {
          min-height: 50px;
          padding: 0 16px;
          border: 0;
          border-radius: 16px;
          background: #111827;
          color: white;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.2s ease, opacity 0.2s ease;
        }

        .events-clear-button:hover {
          transform: translateY(-1px);
          opacity: 0.94;
        }

        .events-toolbar-meta {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-top: 18px;
        }

        .events-toolbar-stat,
        .events-toolbar-page {
          padding: 16px 18px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.68);
          border: 1px solid rgba(17, 24, 39, 0.06);
          backdrop-filter: blur(10px);
        }

        .events-toolbar-label,
        .events-toolbar-page span {
          display: block;
          font-size: 0.78rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #7b8499;
          margin-bottom: 8px;
        }

        .events-toolbar-stat strong,
        .events-toolbar-page strong {
          display: block;
          font-size: 1.5rem;
          line-height: 1;
          color: #111827;
        }

        .events-loading-layout {
          display: flex;
          flex-direction: column;
          gap: 22px;
        }

        .events-feature-skeleton,
        .event-card-skeleton {
          position: relative;
          overflow: hidden;
          border-radius: 28px;
          background: linear-gradient(135deg, #eef2ff, #fff7ed 55%, #f8fafc);
          min-height: 220px;
        }

        .event-card-skeleton {
          min-height: 320px;
          border-radius: 24px;
        }

        .events-feature-skeleton::after,
        .event-card-skeleton::after {
          content: '';
          position: absolute;
          inset: 0;
          transform: translateX(-100%);
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.55), transparent);
          animation: eventsShimmer 1.7s infinite;
        }

        @keyframes eventsShimmer {
          100% {
            transform: translateX(100%);
          }
        }

        .events-feature-card {
          position: relative;
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) 280px;
          gap: 24px;
          padding: 28px;
          border-radius: 32px;
          border: 1px solid rgba(17, 24, 39, 0.08);
          background:
            radial-gradient(circle at top left, rgba(47, 111, 237, 0.12), transparent 28%),
            radial-gradient(circle at bottom right, rgba(17, 24, 39, 0.08), transparent 25%),
            linear-gradient(135deg, #ffffff 0%, #fbfcff 48%, #fff9f1 100%);
          overflow: hidden;
          box-shadow: 0 22px 60px rgba(15, 23, 42, 0.08);
        }

        .events-feature-card::before {
          content: '';
          position: absolute;
          inset: 0 auto 0 0;
          width: 6px;
          background: var(--event-accent);
        }

        .events-feature-copy,
        .events-feature-side {
          position: relative;
          z-index: 1;
        }

        .events-feature-pill-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }

        .events-feature-kicker,
        .events-grid-kicker {
          display: inline-flex;
          align-items: center;
          padding: 0.5rem 0.9rem;
          border-radius: 999px;
          background: rgba(17, 24, 39, 0.06);
          color: #22304a;
          text-transform: uppercase;
          letter-spacing: 0.11em;
          font-weight: 800;
          font-size: 0.73rem;
        }

        .events-feature-card h2 {
          margin: 0;
          font-size: clamp(2rem, 4vw, 3.15rem);
          line-height: 0.96;
          letter-spacing: -0.04em;
          color: #111827;
          max-width: 12ch;
        }

        .events-feature-topic {
          margin: 14px 0 10px;
          font-size: 1.08rem;
          font-weight: 700;
          color: #334155;
        }

        .events-feature-description {
          margin: 0;
          max-width: 68ch;
          color: #556176;
          font-size: 1rem;
          line-height: 1.72;
        }

        .events-feature-meta-grid,
        .event-meta-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 22px;
        }

        .event-meta-chip {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          min-height: 42px;
          padding: 0 14px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.88);
          border: 1px solid rgba(17, 24, 39, 0.08);
          color: #334155;
          font-size: 0.92rem;
          font-weight: 600;
        }

        .events-feature-actions {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-top: 24px;
          flex-wrap: wrap;
        }

        .events-feature-side {
          display: flex;
          flex-direction: column;
          gap: 16px;
          align-items: stretch;
        }

        .events-feature-date,
        .events-feature-status-card {
          padding: 22px;
          border-radius: 24px;
          background: rgba(17, 24, 39, 0.94);
          color: #f8fafc;
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.22);
        }

        .events-feature-date {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          min-height: 200px;
        }

        .events-feature-date span,
        .events-feature-date small {
          text-transform: uppercase;
          letter-spacing: 0.18em;
          font-weight: 700;
          opacity: 0.78;
        }

        .events-feature-date strong {
          font-size: 5rem;
          line-height: 0.92;
          letter-spacing: -0.08em;
          margin: 10px 0;
        }

        .events-feature-side-label {
          display: block;
          margin-bottom: 8px;
          font-size: 0.75rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(248, 250, 252, 0.62);
        }

        .events-feature-status-card strong {
          display: block;
          font-size: 1.4rem;
          margin-bottom: 10px;
        }

        .events-feature-status-card p {
          margin: 0;
          color: rgba(248, 250, 252, 0.76);
          line-height: 1.6;
        }

        .events-grid-section {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .events-grid-heading {
          display: flex;
          justify-content: space-between;
          align-items: end;
          gap: 20px;
        }

        .events-grid-heading h3 {
          margin: 10px 0 0;
          font-size: 1.8rem;
          letter-spacing: -0.03em;
          color: #111827;
        }

        .events-grid-heading p {
          max-width: 440px;
          margin: 0;
          color: #667085;
          line-height: 1.65;
        }

        .events-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 20px;
        }

        .event-card-modern {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 18px;
          min-height: 100%;
          padding: 22px;
          border-radius: 26px;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(250, 251, 255, 0.98)),
            var(--bg-elevated);
          border: 1px solid rgba(17, 24, 39, 0.08);
          overflow: hidden;
          box-shadow: 0 14px 40px rgba(15, 23, 42, 0.06);
          transition: transform 0.24s ease, box-shadow 0.24s ease, border-color 0.24s ease;
        }

        .event-card-modern::before {
          content: '';
          position: absolute;
          inset: 0 auto auto 0;
          width: 100%;
          height: 5px;
          background: linear-gradient(90deg, var(--event-accent), rgba(17, 24, 39, 0.08));
        }

        .event-card-modern:hover {
          transform: translateY(-6px);
          border-color: rgba(17, 24, 39, 0.12);
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.11);
        }

        .event-card-modern-top {
          display: grid;
          grid-template-columns: 74px minmax(0, 1fr);
          gap: 16px;
          align-items: start;
        }

        .event-date-stack {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 88px;
          border-radius: 22px;
          background: linear-gradient(180deg, rgba(17, 24, 39, 0.05), rgba(17, 24, 39, 0.01));
          border: 1px solid rgba(17, 24, 39, 0.08);
          color: #111827;
        }

        .event-date-stack span,
        .event-date-stack small {
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          font-weight: 700;
          color: #64748b;
        }

        .event-date-stack strong {
          font-size: 2rem;
          line-height: 1;
          margin: 5px 0;
          letter-spacing: -0.06em;
        }

        .event-card-modern-head {
          min-width: 0;
        }

        .event-card-pill-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        .event-type-pill,
        .event-status-pill {
          display: inline-flex;
          align-items: center;
          min-height: 30px;
          padding: 0 11px;
          border-radius: 999px;
          border: 1px solid transparent;
          font-size: 0.73rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 800;
        }

        .event-status-pill {
          background: rgba(15, 23, 42, 0.06);
          color: #334155;
        }

        .event-status-pill.tone-success {
          background: rgba(16, 185, 129, 0.12);
          color: #0f8a62;
        }

        .event-status-pill.tone-warning {
          background: rgba(245, 158, 11, 0.12);
          color: #b45309;
        }

        .event-status-pill.tone-danger {
          background: rgba(239, 68, 68, 0.12);
          color: #c24141;
        }

        .event-status-pill.tone-muted,
        .event-status-pill.tone-neutral {
          background: rgba(100, 116, 139, 0.12);
          color: #475569;
        }

        .event-card-modern-head h3 {
          margin: 0;
          font-size: 1.5rem;
          line-height: 1.08;
          letter-spacing: -0.04em;
          color: #111827;
        }

        .event-card-modern-head p {
          margin: 8px 0 0;
          color: #667085;
          font-weight: 600;
        }

        .event-card-copy p {
          margin: 0;
          color: #556176;
          line-height: 1.7;
        }

        .event-card-modern-footer {
          margin-top: auto;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: end;
          padding-top: 18px;
          border-top: 1px solid rgba(17, 24, 39, 0.07);
        }

        .event-card-host {
          color: #667085;
          font-size: 0.92rem;
          line-height: 1.5;
        }

        .event-card-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .event-inline-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          padding: 0 16px;
          border-radius: 999px;
          border: 0;
          background: #111827;
          color: white;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.2s ease, opacity 0.2s ease;
          text-decoration: none;
        }

        .event-inline-action.subtle {
          background: rgba(17, 24, 39, 0.08);
          color: #111827;
        }

        .event-inline-action:hover {
          transform: translateY(-1px);
          opacity: 0.94;
        }

        .event-detail-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 42px;
          color: #2447cf;
          font-weight: 700;
          text-decoration: none;
        }

        .event-detail-link:hover {
          text-decoration: underline;
        }

        .feature-link {
          color: #111827;
        }

        .events-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 14px;
          padding: 54px 24px;
          border-radius: 30px;
          border: 1px solid rgba(17, 24, 39, 0.08);
          background:
            radial-gradient(circle at top, rgba(47, 111, 237, 0.1), transparent 34%),
            linear-gradient(180deg, #ffffff, #fbfcff);
        }

        .events-empty-mark {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 74px;
          height: 74px;
          border-radius: 22px;
          background: #111827;
          color: white;
        }

        .events-empty-state h3 {
          margin: 0;
          font-size: 1.6rem;
          color: #111827;
        }

        .events-empty-state p {
          margin: 0;
          max-width: 560px;
          color: #667085;
          line-height: 1.7;
        }

        .events-empty-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 6px;
        }

        .events-pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 16px;
          padding-top: 6px;
        }

        .events-page-button {
          min-height: 44px;
          padding: 0 18px;
          border-radius: 999px;
          border: 1px solid rgba(17, 24, 39, 0.12);
          background: rgba(255, 255, 255, 0.9);
          color: #111827;
          font-weight: 700;
          cursor: pointer;
        }

        .events-page-button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .events-page-indicator {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 44px;
          padding: 0 16px;
          border-radius: 999px;
          background: rgba(17, 24, 39, 0.06);
          color: #475569;
          font-weight: 600;
        }

        .events-page-indicator strong {
          color: #111827;
        }

        @media (max-width: 1080px) {
          .events-toolbar-main,
          .events-feature-card {
            grid-template-columns: 1fr;
          }

          .events-toolbar-meta {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .events-grid-heading {
            flex-direction: column;
            align-items: start;
          }
        }

        @media (max-width: 720px) {
          .events-shell {
            gap: 20px;
          }

          .events-toolbar-panel,
          .events-feature-card,
          .event-card-modern,
          .events-empty-state {
            padding: 18px;
            border-radius: 24px;
          }

          .events-filter-controls,
          .events-feature-actions,
          .event-card-actions,
          .events-empty-actions {
            width: 100%;
            justify-content: stretch;
          }

          .filter-select,
          .events-toggle,
          .events-clear-button,
          .event-inline-action,
          .event-detail-link,
          .events-page-button {
            width: 100%;
            justify-content: center;
          }

          .events-toolbar-meta {
            grid-template-columns: 1fr;
          }

          .events-feature-date strong {
            font-size: 4rem;
          }

          .event-card-modern-top {
            grid-template-columns: 1fr;
          }

          .event-date-stack {
            width: 88px;
          }

          .event-card-modern-footer {
            flex-direction: column;
            align-items: start;
          }

          .events-pagination {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};

export default Events;
