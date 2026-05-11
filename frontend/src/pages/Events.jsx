import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { eventsApi } from '../api/events';
import { useAuth } from '../hooks/useAuth';
import Pill from '../components/ui/Pill';
import Icon from '../components/ui/Icon';

const EVENT_TYPE_LABEL = {
  career: 'Career',
  educational: 'Educational',
  networking: 'Networking',
  recruiting: 'Recruiting',
  'invite-only': 'Invite-only',
};

const STATUS_TONE = {
  draft: undefined, pending: 'warm', approved: 'ok', cancelled: 'err', completed: 'blue',
};

const formatDateParts = (value) => {
  const d = new Date(value);
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    day: String(d.getDate()).padStart(2, '0'),
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    full: d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
  };
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
  const [filters, setFilters] = useState({ type: '', format: '', upcoming_only: true, search: '' });

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const params = { page, limit: 12, upcoming_only: filters.upcoming_only };
      if (filters.type) params.type = filters.type;
      if (filters.format) params.format = filters.format;
      if (filters.search) params.search = filters.search;
      const data = await eventsApi.list(params);
      setEvents(data.items || []);
      setTotalPages(data.pages || 1);
      setTotalCount(data.total || 0);
    } catch (err) {
      console.error('Failed to load events', err);
      setError('Failed to load events. Please try again.');
    } finally { setLoading(false); }
  }, [page, filters]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const updateFilters = (patch) => { setPage(1); setFilters((p) => ({ ...p, ...patch })); };
  const clearFilters = () => { setPage(1); setFilters({ type: '', format: '', upcoming_only: true, search: '' }); };

  const handleRegister = async (id) => {
    try { await eventsApi.register(id); fetchEvents(); }
    catch (err) { alert(err.response?.data?.detail || 'Failed to register'); }
  };
  const handleUnregister = async (id) => {
    try { await eventsApi.unregister(id); fetchEvents(); }
    catch (err) { alert(err.response?.data?.detail || 'Failed to unregister'); }
  };

  const canCreateEvent = Boolean(user);
  const canApproveEvents = user?.is_admin || user?.role === 'STAFF';
  const hasActiveFilters = Boolean(filters.type || filters.format || filters.search || !filters.upcoming_only);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>EVENTS · {totalCount} TOTAL</div>
          <h1 className="h1">Connect, learn, <i>show up</i>.</h1>
        </div>
        <div className="page-head-actions">
          {canApproveEvents && (
            <button className="btn" onClick={() => navigate('/events/admin')}>
              <Icon name="check" size={14} /> Review pending
            </button>
          )}
          {canCreateEvent && (
            <button className="btn primary" onClick={() => navigate('/events/create')}>
              <Icon name="plus" size={12} /> Create event
            </button>
          )}
        </div>
      </div>

      <div className="panel" style={{ padding: 16, marginBottom: 20 }}>
        <div className="filter-grid events">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Search</label>
            <input type="search" value={filters.search} onChange={(e) => updateFilters({ search: e.target.value })} placeholder="Title, topic, organizer…" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Type</label>
            <select value={filters.type} onChange={(e) => updateFilters({ type: e.target.value })}>
              <option value="">All</option>
              {Object.entries(EVENT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Format</label>
            <select value={filters.format} onChange={(e) => updateFilters({ format: e.target.value })}>
              <option value="">All</option>
              <option value="online">Online</option>
              <option value="offline">In person</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--sans)', textTransform: 'none', letterSpacing: 0, fontSize: 12, paddingBottom: 9 }}>
            <input type="checkbox" checked={filters.upcoming_only} onChange={(e) => updateFilters({ upcoming_only: e.target.checked })} />
            Upcoming only
          </label>
          {hasActiveFilters && <button type="button" className="btn ghost" onClick={clearFilters}>Clear</button>}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading-block">Loading events…</div>
      ) : events.length === 0 ? (
        <div className="empty-block">
          <Icon name="calendar" size={28} />
          <h3>No events found</h3>
          <p>Try clearing filters or check back soon.</p>
          {hasActiveFilters && <button className="btn sm" onClick={clearFilters}>Clear filters</button>}
        </div>
      ) : (
        <>
          <div className="responsive-card-grid wide">
            {events.map((event) => {
              const dp = formatDateParts(event.start_time);
              const isHot = (new Date(event.start_time) - new Date()) < 1000 * 60 * 60 * 48;
              const remaining = event.capacity ? Math.max(0, event.capacity - (event.registrations_count || 0)) : null;
              return (
                <article key={event.id} className="panel" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div className={`date-chip ${isHot ? 'blue' : ''}`}>
                      <div className="d">{dp.weekday}</div>
                      <div className="n">{dp.day}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link to={`/events/${event.id}`} className="h3" style={{ color: 'var(--ink)' }}>{event.title}</Link>
                      <div className="mute mono" style={{ fontSize: 10.5, marginTop: 4 }}>
                        {dp.month} · {dp.time} · {event.format === 'online' ? 'ONLINE' : event.format === 'hybrid' ? 'HYBRID' : (event.location || 'IN-PERSON').toUpperCase()}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {event.type && <Pill tone="blue" dot>{EVENT_TYPE_LABEL[event.type] || event.type}</Pill>}
                    {event.status && event.status !== 'approved' && <Pill tone={STATUS_TONE[event.status]} dot>{event.status}</Pill>}
                    {event.is_registered && <Pill tone="ok" dot>Registered{event.registration_status === 'WAITLISTED' ? ' · waitlist' : ''}</Pill>}
                    {remaining != null && <Pill>{remaining} seats left</Pill>}
                  </div>

                  {event.description && (
                    <p className="dim" style={{ fontSize: 12.5, lineHeight: 1.5, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {event.description}
                    </p>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--line-soft)', paddingTop: 10, marginTop: 'auto' }}>
                    <span className="mono mute" style={{ fontSize: 10.5 }}>{event.registrations_count || 0} registered</span>
                    {event.is_registered ? (
                      <button className="btn sm ghost" onClick={() => handleUnregister(event.id)}>Cancel</button>
                    ) : event.status === 'approved' ? (
                      <button className="btn sm primary" onClick={() => handleRegister(event.id)}>Register</button>
                    ) : (
                      <Link to={`/events/${event.id}`} className="btn sm">View</Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 24 }}>
              <button className="btn sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}><Icon name="chevronL" size={12} /> Prev</button>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', alignSelf: 'center', padding: '0 12px' }}>Page {page} / {totalPages}</span>
              <button className="btn sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>Next <Icon name="chevronR" size={12} /></button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Events;
