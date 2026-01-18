import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { eventsApi } from '../api/events';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import Avatar from '../components/ui/Avatar';

const EVENT_TYPES = {
  career: { label: 'Career', color: '#3b82f6' },
  educational: { label: 'Educational', color: '#10b981' },
  networking: { label: 'Networking', color: '#8b5cf6' },
  recruiting: { label: 'Recruiting', color: '#f59e0b' },
  'invite-only': { label: 'Invite Only', color: '#ef4444' },
};

const EventDetail = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviews, setReviews] = useState({ items: [], total: 0, average_rating: 0 });
  const [messages, setMessages] = useState({ items: [], total: 0 });
  const [newMessage, setNewMessage] = useState('');
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [activeTab, setActiveTab] = useState('details');

  const fetchEvent = useCallback(async () => {
    try {
      setLoading(true);
      const data = await eventsApi.get(eventId);
      setEvent(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const fetchReviews = useCallback(async () => {
    try {
      const data = await eventsApi.getReviews(eventId);
      setReviews(data);
    } catch (err) {
      console.error('Failed to load reviews:', err);
    }
  }, [eventId]);

  const fetchMessages = useCallback(async () => {
    try {
      const data = await eventsApi.getMessages(eventId);
      setMessages(data);
    } catch (err) {
      // Chat may not be available yet
      console.log('Chat not available yet');
    }
  }, [eventId]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  useEffect(() => {
    if (event && new Date(event.start_time) <= new Date()) {
      fetchReviews();
      fetchMessages();
    }
  }, [event, fetchReviews, fetchMessages]);

  const handleRegister = async () => {
    try {
      await eventsApi.register(eventId);
      fetchEvent();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to register');
    }
  };

  const handleUnregister = async () => {
    if (!window.confirm('Are you sure you want to cancel your registration?')) return;
    try {
      await eventsApi.unregister(eventId);
      fetchEvent();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to unregister');
    }
  };

  const handleSubmitForApproval = async () => {
    try {
      await eventsApi.submitForApproval(eventId);
      fetchEvent();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to submit');
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this event? All participants will be notified.')) return;
    try {
      await eventsApi.cancel(eventId);
      fetchEvent();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to cancel event');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    try {
      await eventsApi.sendMessage(eventId, newMessage);
      setNewMessage('');
      fetchMessages();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to send message');
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    try {
      await eventsApi.createReview(eventId, newReview);
      setShowReviewForm(false);
      setNewReview({ rating: 5, comment: '' });
      fetchReviews();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to submit review');
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const hasStarted = event && new Date(event.start_time) <= new Date();
  const isOrganizer = event && user && event.organizer_id === user.id;
  const isAdmin = user?.is_admin;
  const canManage = isOrganizer || isAdmin;

  if (loading) {
    return (
      <div className="page loading-state">
        <div className="spinner"></div>
        <p>Loading event...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <Alert type="error">{error}</Alert>
        <Button onClick={() => navigate('/events')}>Back to Events</Button>
      </div>
    );
  }

  if (!event) return null;

  return (
    <div className="page event-detail-page">
      <div className="back-link">
        <Link to="/events">← Back to Events</Link>
      </div>

      <div className="event-detail-layout">
        <div className="event-main">
          <Card className="event-header-card elevated">
            <div className="event-badges">
              <span
                className="type-badge"
                style={{ backgroundColor: EVENT_TYPES[event.type]?.color }}
              >
                {EVENT_TYPES[event.type]?.label}
              </span>
              <span className={`status-badge status-${event.status}`}>
                {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
              </span>
              <span className="format-badge">
                {event.format === 'online' ? '🌐 Online' :
                  event.format === 'hybrid' ? '🔄 Hybrid' : '📍 In-Person'}
              </span>
            </div>

            <h1 className="event-title">{event.title}</h1>
            <p className="event-topic">{event.topic}</p>

            <div className="event-info-grid">
              <div className="info-item">
                <span className="info-icon">📅</span>
                <div>
                  <strong>When</strong>
                  <p>{formatDate(event.start_time)}</p>
                  {event.end_time && <p className="text-secondary">Until {formatDate(event.end_time)}</p>}
                </div>
              </div>

              {event.location && (
                <div className="info-item">
                  <span className="info-icon">📍</span>
                  <div>
                    <strong>Location</strong>
                    <p>{event.location}</p>
                  </div>
                </div>
              )}

              {event.online_link && (
                <div className="info-item">
                  <span className="info-icon">🔗</span>
                  <div>
                    <strong>Join Link</strong>
                    <a href={event.online_link} target="_blank" rel="noopener noreferrer">
                      {event.online_link}
                    </a>
                  </div>
                </div>
              )}

              {event.capacity && (
                <div className="info-item">
                  <span className="info-icon">👥</span>
                  <div>
                    <strong>Capacity</strong>
                    <p>{event.registrations_count} / {event.capacity} registered</p>
                    {event.waitlist_count > 0 && (
                      <p className="text-secondary">{event.waitlist_count} on waitlist</p>
                    )}
                  </div>
                </div>
              )}

              {event.company_name && (
                <div className="info-item">
                  <span className="info-icon">🏢</span>
                  <div>
                    <strong>Company</strong>
                    <p>{event.company_name}</p>
                  </div>
                </div>
              )}
            </div>

            {event.description && (
              <div className="event-description">
                <h3>About this Event</h3>
                <p>{event.description}</p>
              </div>
            )}

            {/* Organizer Actions */}
            {canManage && (
              <div className="organizer-actions">
                {event.status === 'draft' && (
                  <>
                    <Button className="btn-primary" onClick={handleSubmitForApproval}>
                      Submit for Approval
                    </Button>
                    <Link to={`/events/${eventId}/edit`} className="btn btn-secondary">
                      Edit Event
                    </Link>
                  </>
                )}
                {event.status !== 'cancelled' && event.status !== 'completed' && (
                  <Button className="btn-danger" onClick={handleCancel}>
                    Cancel Event
                  </Button>
                )}
              </div>
            )}
          </Card>

          {/* Tabs */}
          {hasStarted && (
            <div className="event-tabs">
              <button
                className={`tab ${activeTab === 'details' ? 'active' : ''}`}
                onClick={() => setActiveTab('details')}
              >
                Details
              </button>
              <button
                className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
                onClick={() => setActiveTab('chat')}
              >
                Chat ({messages.total})
              </button>
              <button
                className={`tab ${activeTab === 'reviews' ? 'active' : ''}`}
                onClick={() => setActiveTab('reviews')}
              >
                Reviews ({reviews.total})
              </button>
            </div>
          )}

          {/* Tab Content */}
          {activeTab === 'chat' && hasStarted && event.is_registered && (
            <Card className="chat-section elevated">
              <h3>Event Chat</h3>
              <div className="messages-list">
                {messages.items.length === 0 ? (
                  <p className="text-secondary">No messages yet. Start the conversation!</p>
                ) : (
                  messages.items.map((msg) => (
                    <div key={msg.id} className={`message ${msg.user_id === user?.id ? 'own' : ''}`}>
                      <Avatar name={msg.user_name} src={msg.user_photo} size="sm" />
                      <div className="message-content">
                        <strong>{msg.user_name}</strong>
                        <p>{msg.content}</p>
                        <span className="message-time">
                          {new Date(msg.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={handleSendMessage} className="message-form">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="input"
                />
                <Button type="submit" className="btn-primary">Send</Button>
              </form>
            </Card>
          )}

          {activeTab === 'reviews' && hasStarted && (
            <Card className="reviews-section elevated">
              <div className="reviews-header">
                <h3>Reviews</h3>
                {reviews.average_rating > 0 && (
                  <div className="average-rating">
                    {'⭐'.repeat(Math.round(reviews.average_rating))}
                    <span>{reviews.average_rating.toFixed(1)}</span>
                  </div>
                )}
              </div>

              {event.is_registered && !showReviewForm && (
                <Button className="btn-secondary" onClick={() => setShowReviewForm(true)}>
                  Write a Review
                </Button>
              )}

              {showReviewForm && (
                <form onSubmit={handleSubmitReview} className="review-form">
                  <div className="form-group">
                    <label>Rating</label>
                    <div className="star-rating">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          className={`star ${newReview.rating >= star ? 'active' : ''}`}
                          onClick={() => setNewReview(prev => ({ ...prev, rating: star }))}
                        >
                          ⭐
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Comment (optional)</label>
                    <textarea
                      value={newReview.comment}
                      onChange={(e) => setNewReview(prev => ({ ...prev, comment: e.target.value }))}
                      className="input"
                      rows={3}
                    />
                  </div>
                  <div className="form-actions">
                    <Button type="submit" className="btn-primary">Submit Review</Button>
                    <Button type="button" className="btn-secondary" onClick={() => setShowReviewForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              )}

              <div className="reviews-list">
                {reviews.items.map((review) => (
                  <div key={review.id} className="review-item">
                    <div className="review-header">
                      <Avatar name={review.user_name} src={review.user_photo} size="sm" />
                      <div>
                        <strong>{review.user_name}</strong>
                        <div className="review-rating">
                          {'⭐'.repeat(review.rating)}
                        </div>
                      </div>
                      <span className="review-date">
                        {new Date(review.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {review.comment && <p className="review-comment">{review.comment}</p>}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="event-sidebar">
          {/* Registration Card */}
          <Card className="registration-card elevated">
            <h3>Registration</h3>
            {event.status === 'approved' ? (
              <>
                {event.is_registered ? (
                  <div className="registered-status">
                    <div className={`status-display ${event.registration_status?.toLowerCase()}`}>
                      {event.registration_status === 'WAITLISTED' ? (
                        <>
                          <span className="status-icon">⏳</span>
                          <span>You're on the waitlist</span>
                        </>
                      ) : (
                        <>
                          <span className="status-icon">✓</span>
                          <span>You're registered!</span>
                        </>
                      )}
                    </div>
                    <Button className="btn-danger btn-sm" onClick={handleUnregister}>
                      Cancel Registration
                    </Button>
                  </div>
                ) : (
                  <Button className="btn-primary btn-full" onClick={handleRegister}>
                    {event.capacity && event.registrations_count >= event.capacity
                      ? 'Join Waitlist'
                      : 'Register Now'}
                  </Button>
                )}
              </>
            ) : (
              <p className="text-secondary">
                {event.status === 'draft' ? 'Event is still a draft.' :
                  event.status === 'pending' ? 'Pending admin approval.' :
                    event.status === 'cancelled' ? 'This event has been cancelled.' :
                      'Registration closed.'}
              </p>
            )}
          </Card>

          {/* Organizer Card */}
          {event.organizer && (
            <Card className="organizer-card elevated">
              <h3>Organizer</h3>
              <Link to={`/profile/${event.organizer.id}`} className="organizer-link">
                <Avatar name={event.organizer.name} src={event.organizer.photo_url} size="md" />
                <span>{event.organizer.name}</span>
              </Link>
            </Card>
          )}

          {/* Speakers Card */}
          {event.speakers && event.speakers.length > 0 && (
            <Card className="speakers-card elevated">
              <h3>Speakers</h3>
              <div className="speakers-list">
                {event.speakers.map((speaker) => (
                  <div key={speaker.id} className="speaker-item">
                    <Avatar name={speaker.name} size="sm" />
                    <div>
                      <strong>{speaker.name}</strong>
                      {speaker.link && (
                        <a href={speaker.link} target="_blank" rel="noopener noreferrer">
                          View Profile
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Materials Card */}
          {event.materials && event.materials.length > 0 && (
            <Card className="materials-card elevated">
              <h3>Materials</h3>
              <div className="materials-list">
                {event.materials.map((material) => (
                  <a
                    key={material.id}
                    href={material.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="material-item"
                  >
                    <span className="material-icon">
                      {material.type === 'agenda' ? '📋' :
                        material.type === 'presentation' ? '📊' : '📄'}
                    </span>
                    <span>{material.title}</span>
                  </a>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      <style>{`
        .event-detail-page { max-width: 1200px; margin: 0 auto; }
        .back-link { margin-bottom: 1rem; }
        .back-link a { color: var(--text-secondary); text-decoration: none; }
        .back-link a:hover { color: var(--text-primary); }
        
        .event-detail-layout {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 1.5rem;
        }
        
        @media (max-width: 900px) {
          .event-detail-layout { grid-template-columns: 1fr; }
        }
        
        .event-header-card { padding: 1.5rem; }
        
        .event-badges {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }
        
        .type-badge {
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: 600;
        }
        
        .status-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: 500;
        }
        
        .status-draft { background: var(--bg-tertiary); color: var(--text-secondary); }
        .status-pending { background: #fef3c7; color: #92400e; }
        .status-approved { background: #d1fae5; color: #065f46; }
        .status-cancelled { background: #fee2e2; color: #991b1b; }
        .status-completed { background: #dbeafe; color: #1e40af; }
        
        .format-badge {
          background: var(--bg-secondary);
          padding: 0.25rem 0.75rem;
          border-radius: 4px;
          font-size: 0.8rem;
        }
        
        .event-title {
          font-size: 1.75rem;
          margin: 0 0 0.5rem;
        }
        
        .event-topic {
          font-size: 1rem;
          color: var(--text-secondary);
          margin: 0 0 1.5rem;
        }
        
        .event-info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        
        .info-item {
          display: flex;
          gap: 0.75rem;
        }
        
        .info-icon { font-size: 1.5rem; }
        
        .info-item strong {
          display: block;
          font-size: 0.75rem;
          text-transform: uppercase;
          color: var(--text-tertiary);
          margin-bottom: 0.25rem;
        }
        
        .info-item p { margin: 0; font-size: 0.9rem; }
        
        .event-description {
          padding-top: 1.5rem;
          border-top: 1px solid var(--border-color);
        }
        
        .event-description h3 { margin: 0 0 0.75rem; }
        .event-description p { line-height: 1.6; color: var(--text-secondary); }
        
        .organizer-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 1.5rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--border-color);
        }
        
        .btn-danger { background: #ef4444; color: white; }
        
        .event-tabs {
          display: flex;
          gap: 0.5rem;
          margin: 1.5rem 0 1rem;
        }
        
        .tab {
          padding: 0.75rem 1.25rem;
          background: var(--bg-secondary);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }
        
        .tab:hover { background: var(--bg-tertiary); }
        .tab.active { background: var(--accent-primary); color: white; }
        
        .chat-section, .reviews-section { padding: 1.25rem; }
        
        .messages-list {
          max-height: 400px;
          overflow-y: auto;
          margin-bottom: 1rem;
        }
        
        .message {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }
        
        .message-content {
          background: var(--bg-secondary);
          padding: 0.75rem;
          border-radius: 8px;
          max-width: 80%;
        }
        
        .message-content strong { font-size: 0.85rem; }
        .message-content p { margin: 0.25rem 0; }
        .message-time { font-size: 0.7rem; color: var(--text-tertiary); }
        
        .message.own .message-content {
          background: var(--accent-primary);
          color: white;
        }
        
        .message-form {
          display: flex;
          gap: 0.5rem;
        }
        
        .message-form .input { flex: 1; }
        
        .reviews-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        
        .average-rating {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 1.1rem;
        }
        
        .review-form {
          background: var(--bg-secondary);
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1rem;
        }
        
        .star-rating { display: flex; gap: 0.25rem; }
        .star { background: none; border: none; font-size: 1.5rem; cursor: pointer; opacity: 0.3; }
        .star.active { opacity: 1; }
        
        .form-actions { display: flex; gap: 0.5rem; margin-top: 1rem; }
        
        .reviews-list { margin-top: 1rem; }
        
        .review-item {
          padding: 1rem 0;
          border-bottom: 1px solid var(--border-color);
        }
        
        .review-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        
        .review-date {
          margin-left: auto;
          font-size: 0.8rem;
          color: var(--text-tertiary);
        }
        
        .review-rating { font-size: 0.8rem; }
        .review-comment { margin: 0.5rem 0 0; color: var(--text-secondary); }
        
        .event-sidebar .elevated { margin-bottom: 1rem; padding: 1rem; }
        .event-sidebar h3 { margin: 0 0 0.75rem; font-size: 1rem; }
        
        .registration-card .btn-full { width: 100%; }
        
        .registered-status { text-align: center; }
        
        .status-display {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem;
          border-radius: 8px;
          margin-bottom: 0.75rem;
        }
        
        .status-display.registered { background: #d1fae5; color: #065f46; }
        .status-display.waitlisted { background: #fef3c7; color: #92400e; }
        
        .organizer-link {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          text-decoration: none;
          color: var(--text-primary);
        }
        
        .speakers-list, .materials-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        
        .speaker-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        
        .speaker-item a {
          font-size: 0.8rem;
          color: var(--accent-primary);
        }
        
        .material-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem;
          background: var(--bg-secondary);
          border-radius: 6px;
          text-decoration: none;
          color: var(--text-primary);
        }
        
        .material-item:hover { background: var(--bg-tertiary); }
        
        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 300px;
        }
        
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--bg-tertiary);
          border-top-color: var(--accent-primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default EventDetail;
