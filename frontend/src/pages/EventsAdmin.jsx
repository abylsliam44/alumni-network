import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { eventsApi } from '../api/events';
import { useAuth } from '../hooks/useAuth';
import Pill from '../components/ui/Pill';
import Icon from '../components/ui/Icon';
import Alert from '../components/ui/Alert';

const EVENT_TYPE_LABEL = {
  career: 'Career', educational: 'Educational', networking: 'Networking',
  recruiting: 'Recruiting', 'invite-only': 'Invite-only',
};

const EventsAdmin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    if (user && !user.is_admin && user.role !== 'STAFF') navigate('/events');
  }, [user, navigate]);

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const data = await eventsApi.getPending();
      setEvents(data.items || data);
    } catch (err) {
      console.error(err);
      setError('Failed to load pending events.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const handleApprove = async (id) => {
    try {
      setActionLoading(id);
      await eventsApi.approve(id);
      setEvents((p) => p.filter((e) => e.id !== id));
    } catch (err) { alert(err.response?.data?.detail || 'Failed to approve event'); }
    finally { setActionLoading(null); }
  };

  const handleReject = async (id) => {
    const reason = window.prompt('Reason for rejection (optional):');
    if (reason === null) return;
    try {
      setActionLoading(id);
      await eventsApi.reject(id, reason);
      setEvents((p) => p.filter((e) => e.id !== id));
    } catch (err) { alert(err.response?.data?.detail || 'Failed to reject event'); }
    finally { setActionLoading(null); }
  };

  const formatDate = (s) => new Date(s).toLocaleString();

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>EVENTS · ADMIN</div>
          <h1 className="h1">Review pending <i>submissions</i>.</h1>
        </div>
        <div className="page-head-actions">
          <button className="btn" onClick={() => navigate('/events')}>Back to events</button>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {loading ? (
        <div className="loading-block">Loading pending events…</div>
      ) : events.length === 0 ? (
        <div className="empty-block">
          <Icon name="check" size={28} />
          <h3>No pending events</h3>
          <p>All event submissions have been reviewed.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 12 }}>
          {events.map((event) => (
            <article key={event.id} className="panel" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                {event.type && <Pill tone="blue" dot>{EVENT_TYPE_LABEL[event.type] || event.type}</Pill>}
                <Pill tone="warm" dot>Pending review</Pill>
              </div>

              <div>
                <h3 className="h3" style={{ fontSize: 15 }}>{event.title}</h3>
                {event.topic && <div className="mute" style={{ fontSize: 12.5, marginTop: 4 }}>{event.topic}</div>}
              </div>

              <div style={{ paddingTop: 10, borderTop: '1px solid var(--line-soft)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="mute mono" style={{ fontSize: 10.5 }}>
                  <Icon name="calendar" size={11} style={{ verticalAlign: 'middle' }} /> {formatDate(event.start_time).toUpperCase()}
                </div>
                <div className="mute mono" style={{ fontSize: 10.5 }}>
                  <Icon name="mapPin" size={11} style={{ verticalAlign: 'middle' }} />{' '}
                  {(event.format === 'online' ? 'ONLINE' : event.location || 'IN-PERSON').toUpperCase()}
                </div>
                {event.creator && (
                  <div className="mute mono" style={{ fontSize: 10.5 }}>
                    <Icon name="user" size={11} style={{ verticalAlign: 'middle' }} /> {event.creator.first_name} {event.creator.last_name}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                <button className="btn sm primary" onClick={() => handleApprove(event.id)} disabled={actionLoading === event.id} style={{ flex: 1 }}>
                  Approve
                </button>
                <button className="btn sm ghost" onClick={() => handleReject(event.id)} disabled={actionLoading === event.id} style={{ flex: 1 }}>
                  Reject
                </button>
                <button className="btn sm" onClick={() => navigate(`/events/${event.id}`)}>View</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventsAdmin;
