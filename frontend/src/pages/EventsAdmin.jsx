import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { eventsApi } from '../api/events';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';

const EVENT_TYPE_STYLES = {
    career: { label: 'Career', color: '#1d4ed8', background: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.22)' },
    educational: { label: 'Educational', color: '#047857', background: 'rgba(16, 185, 129, 0.14)', border: 'rgba(16, 185, 129, 0.24)' },
    networking: { label: 'Networking', color: '#7c3aed', background: 'rgba(124, 58, 237, 0.12)', border: 'rgba(124, 58, 237, 0.2)' },
    recruiting: { label: 'Recruiting', color: '#c2410c', background: 'rgba(249, 115, 22, 0.14)', border: 'rgba(249, 115, 22, 0.22)' },
    'invite-only': { label: 'Invite Only', color: '#be123c', background: 'rgba(244, 63, 94, 0.12)', border: 'rgba(244, 63, 94, 0.22)' },
    default: { label: 'Event', color: '#334155', background: 'rgba(148, 163, 184, 0.14)', border: 'rgba(148, 163, 184, 0.22)' },
};

const EventsAdmin = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);

    // Check permissions
    useEffect(() => {
        if (user && !user.is_admin && user.role !== 'STAFF') {
            navigate('/events');
        }
    }, [user, navigate]);

    const fetchPendingEvents = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await eventsApi.getPending();
            // Adjust based on API structure - assuming returns { items: [...] } or [...]
            setEvents(data.items || data);
        } catch (err) {
            console.error('Failed to load pending events:', err);
            setError('Failed to load pending events.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPendingEvents();
    }, [fetchPendingEvents]);

    const handleApprove = async (eventId) => {
        try {
            setActionLoading(eventId);
            await eventsApi.approve(eventId);
            setEvents(prev => prev.filter(e => e.id !== eventId));
            // Optional: Show success message
        } catch (err) {
            alert(err.response?.data?.detail || 'Failed to approve event');
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (eventId) => {
        const reason = prompt('Please enter a reason for rejection (optional):');
        if (reason === null) return; // Cancelled

        try {
            setActionLoading(eventId);
            await eventsApi.reject(eventId, reason);
            setEvents(prev => prev.filter(e => e.id !== eventId));
        } catch (err) {
            alert(err.response?.data?.detail || 'Failed to reject event');
        } finally {
            setActionLoading(null);
        }
    };

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleString();
    };

    if (loading) {
        return (
            <div className="page events-admin-page">
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading pending events...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page events-admin-page">
            <div className="page-header">
                <div className="page-header-content">
                    <h1>Event Approvals</h1>
                    <p className="text-secondary">Review and manage event submissions</p>
                </div>
                <Button className="btn-secondary" onClick={() => navigate('/events')}>
                    Back to Events
                </Button>
            </div>

            {error && <Alert type="error">{error}</Alert>}

            {events.length === 0 ? (
                <div className="empty-state-card elevated">
                    <div className="empty-icon">✓</div>
                    <h3>No pending events</h3>
                    <p>All event submissions have been reviewed.</p>
                </div>
            ) : (
                <div className="events-grid">
                    {events.map((event) => (
                        <Card key={event.id} className="event-card elevated">
                            <div className="event-card-header">
                                <span
                                    className="event-type-badge"
                                    style={{
                                        backgroundColor: (EVENT_TYPE_STYLES[event.type] || EVENT_TYPE_STYLES.default).background,
                                        color: (EVENT_TYPE_STYLES[event.type] || EVENT_TYPE_STYLES.default).color,
                                        borderColor: (EVENT_TYPE_STYLES[event.type] || EVENT_TYPE_STYLES.default).border,
                                    }}
                                >
                                    {(EVENT_TYPE_STYLES[event.type] || EVENT_TYPE_STYLES.default).label}
                                </span>
                                <span className="status-badge badge-warning">
                                    Pending Review
                                </span>
                            </div>

                            <h3 className="event-title">{event.title}</h3>
                            <p className="event-topic">{event.topic}</p>

                            <div className="event-meta">
                                <div className="meta-item">
                                    <span className="meta-icon">📅</span>
                                    <span>{formatDate(event.start_time)}</span>
                                </div>
                                <div className="meta-item">
                                    <span className="meta-icon">📍</span>
                                    <span>{event.format === 'online' ? 'Online' : event.location || 'In-Person'}</span>
                                </div>
                                {event.creator && (
                                    <div className="meta-item">
                                        <span className="meta-icon">👤</span>
                                        <span>{event.creator.first_name} {event.creator.last_name}</span>
                                    </div>
                                )}
                            </div>

                            <div className="event-card-actions">
                                <Button
                                    className="btn-success btn-sm"
                                    onClick={() => handleApprove(event.id)}
                                    disabled={actionLoading === event.id}
                                >
                                    Approve
                                </Button>
                                <Button
                                    className="btn-danger btn-sm"
                                    onClick={() => handleReject(event.id)}
                                    disabled={actionLoading === event.id}
                                >
                                    Reject
                                </Button>
                                <Button
                                    className="btn-secondary btn-sm"
                                    onClick={() => navigate(`/events/${event.id}`)}
                                >
                                    View Details
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <style>{`
        .events-admin-page {
          max-width: 1200px;
          margin: 0 auto;
          padding-bottom: 4rem;
        }
        
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .events-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 1.5rem;
        }

        .event-card {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          transition: transform 0.2s;
        }
        
        .event-card:hover {
          transform: translateY(-4px);
        }

        .event-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .event-type-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 700;
          border: 1px solid transparent;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .status-badge {
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
        }
        
        .badge-warning {
          background: rgba(245, 158, 11, 0.14);
          color: #92400e;
          border: 1px solid rgba(245, 158, 11, 0.22);
        }

        .event-title {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0;
          color: var(--text-primary);
        }

        .event-topic {
          color: var(--text-secondary);
          margin: 0;
          font-size: 0.9rem;
        }

        .event-meta {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 1rem 0;
          border-top: 1px solid var(--border-color);
          border-bottom: 1px solid var(--border-color);
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .event-card-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: auto;
        }
        
        .event-card-actions button {
          flex: 1;
        }

        .btn-success {
          background-color: #1f2937;
          border: 1px solid #1f2937;
          color: white;
        }
        
        .btn-danger {
          background-color: #fff1f2;
          border: 1px solid #fecdd3;
          color: #be123c;
        }

        .btn-success:hover:not(:disabled) {
          background-color: #111827;
          border-color: #111827;
        }

        .btn-danger:hover:not(:disabled) {
          background-color: #ffe4e6;
          border-color: #fda4af;
        }

        .event-card-actions button:disabled {
          cursor: not-allowed;
          opacity: 0.72;
        }

        .event-card-actions .btn-success:disabled {
          background-color: #94a3b8;
          border-color: #94a3b8;
          color: #ffffff;
        }

        .event-card-actions .btn-danger:disabled {
          background-color: #f8fafc;
          border-color: #e2e8f0;
          color: #94a3b8;
        }

        .loading-state {
          padding: 4rem;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
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

        .empty-state-card {
          padding: 4rem;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          background: var(--bg-elevated);
          border-radius: 16px;
        }

        .empty-icon {
          font-size: 3rem;
          color: var(--accent-success);
          margin-bottom: 1rem;
        }
      `}</style>
        </div>
    );
};

export default EventsAdmin;
