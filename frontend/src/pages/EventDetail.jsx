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
      {/* Hero Section */}
      <div className="event-hero">
        <div className="event-hero-content">
          <div className="back-nav">
            <Link to="/events" className="back-link">
              ← Back to Events
            </Link>
          </div>

          <div className="hero-main">
            <div className="hero-badges">
              <span className="type-pill" style={{
                backgroundColor: `${EVENT_TYPES[event.type]?.color || '#666'}20`,
                color: EVENT_TYPES[event.type]?.color || '#fff',
                borderColor: `${EVENT_TYPES[event.type]?.color || '#666'}40`
              }}>
                {EVENT_TYPES[event.type]?.label}
              </span>
              <span className={`status-pill status-${event.status}`}>
                {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
              </span>
            </div>

            <h1 className="hero-title">{event.title}</h1>
            <p className="hero-topic">{event.topic}</p>

            <div className="hero-meta">
              <div className="hero-meta-item">
                <span className="icon">📅</span>
                <span>{formatDate(event.start_time)}</span>
              </div>
              <div className="hero-meta-item">
                <span className="icon">
                  {event.format === 'online' ? '🌐' : event.format === 'hybrid' ? '🔄' : '📍'}
                </span>
                <span>
                  {event.format === 'online' ? 'Online' :
                    event.format === 'hybrid' ? 'Hybrid' :
                      event.location || 'In-Person'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="event-content-wrapper">

        {/* Main Content Column */}
        <div className="main-content">

          {/* About Section */}
          <Card className="content-card elevated">
            <div className="section-header">
              <h3>About this Event</h3>
            </div>
            {event.description ? (
              <div className="event-description">
                <p>{event.description}</p>
              </div>
            ) : (
              <p className="text-secondary">No description provided.</p>
            )}

            {/* Materials (Mobile/Inline fallback or if important enough for main view) */}
            {event.materials && event.materials.length > 0 && (
              <div className="materials-section">
                <h4>Materials</h4>
                <div className="materials-grid">
                  {event.materials.map((material) => (
                    <a
                      key={material.id}
                      href={material.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="material-pill"
                    >
                      <span className="material-icon">
                        {material.type === 'agenda' ? '📋' :
                          material.type === 'presentation' ? '📊' : '📄'}
                      </span>
                      <span>{material.title}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Admin / Organizer Toolbar */}
          {canManage && (
            <Card className="admin-toolbar elevated">
              <h3>Event Management</h3>
              <div className="toolbar-actions">
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
                  <Button className="btn-danger-outline" onClick={handleCancel}>
                    Cancel Event
                  </Button>
                )}
              </div>
            </Card>
          )}

          {/* Interactive Tabs */}
          {hasStarted && (
            <div className="interaction-section">
              <div className="tabs-nav">
                <button
                  className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`}
                  onClick={() => setActiveTab('details')}
                >
                  Details
                </button>
                <button
                  className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
                  onClick={() => setActiveTab('chat')}
                >
                  Live Chat <span className="tab-count">{messages.total}</span>
                </button>
                <button
                  className={`tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
                  onClick={() => setActiveTab('reviews')}
                >
                  Reviews <span className="tab-count">{reviews.total}</span>
                </button>
              </div>

              <div className="tab-content">
                {activeTab === 'details' && (
                  <div className="details-tab-placeholder">
                    <p className="text-secondary">Additional event details and resources appear here.</p>
                    {/* You could move materials here if preferred */}
                  </div>
                )}

                {activeTab === 'chat' && (
                  <Card className="chat-card elevated">
                    <div className="messages-container">
                      {messages.items.length === 0 ? (
                        <div className="empty-chat">
                          <span>💬</span>
                          <p>Start the conversation!</p>
                        </div>
                      ) : (
                        messages.items.map((msg) => (
                          <div key={msg.id} className={`chat-message ${msg.user_id === user?.id ? 'own' : ''}`}>
                            <Avatar name={msg.user_name} src={msg.user_photo} size="sm" />
                            <div className="bubble">
                              <div className="bubble-header">
                                <span className="author">{msg.user_name}</span>
                                <span className="time">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <p>{msg.content}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    {event.is_registered ? (
                      <form onSubmit={handleSendMessage} className="chat-input-area">
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Type a message..."
                          className="chat-input"
                        />
                        <Button type="submit" className="btn-primary btn-icon">
                          ➤
                        </Button>
                      </form>
                    ) : (
                      <div className="chat-locked">
                        <p>Register to join the chat.</p>
                      </div>
                    )}
                  </Card>
                )}

                {activeTab === 'reviews' && (
                  <Card className="reviews-card elevated">
                    <div className="reviews-summary">
                      <div className="rating-big">
                        <span className="score">{reviews.average_rating.toFixed(1)}</span>
                        <div className="stars">
                          {'⭐'.repeat(Math.round(reviews.average_rating))}
                        </div>
                        <span className="count">{reviews.total} reviews</span>
                      </div>
                      {event.is_registered && !showReviewForm && (
                        <Button className="btn-secondary" onClick={() => setShowReviewForm(true)}>
                          Write Review
                        </Button>
                      )}
                    </div>

                    {showReviewForm && (
                      <form onSubmit={handleSubmitReview} className="review-form-box">
                        <h4>Write a Review</h4>
                        <div className="form-group">
                          <div className="star-select">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                className={`star-btn ${newReview.rating >= star ? 'active' : ''}`}
                                onClick={() => setNewReview(prev => ({ ...prev, rating: star }))}
                              >
                                ★
                              </button>
                            ))}
                          </div>
                        </div>
                        <textarea
                          value={newReview.comment}
                          onChange={(e) => setNewReview(prev => ({ ...prev, comment: e.target.value }))}
                          placeholder="Share your experience..."
                          className="review-input"
                          rows={3}
                        />
                        <div className="form-actions">
                          <Button type="submit" className="btn-primary">Submit</Button>
                          <Button type="button" className="btn-text" onClick={() => setShowReviewForm(false)}>
                            Cancel
                          </Button>
                        </div>
                      </form>
                    )}

                    <div className="reviews-list">
                      {reviews.items.map((review) => (
                        <div key={review.id} className="review-row">
                          <Avatar name={review.user_name} src={review.user_photo} size="md" />
                          <div className="review-content">
                            <div className="review-meta">
                              <span className="author">{review.user_name}</span>
                              <span className="date">{new Date(review.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="review-stars">{'⭐'.repeat(review.rating)}</div>
                            {review.comment && <p className="comment-text">{review.comment}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Column */}
        <div className="sidebar-content">

          {/* Primary Action Card */}
          <Card className="sidebar-card action-card elevated">
            <h3>Registration</h3>
            <div className="registration-status-box">
              {event.status === 'approved' ? (
                event.is_registered ? (
                  <div className="status-message">
                    <div className={`status-icon-box ${event.registration_status === 'WAITLISTED' ? 'waitlist' : 'success'}`}>
                      {event.registration_status === 'WAITLISTED' ? '⏳' : '✓'}
                    </div>
                    <div className="status-text">
                      <h4>{event.registration_status === 'WAITLISTED' ? 'Waitlisted' : 'Registered'}</h4>
                      <p>{event.registration_status === 'WAITLISTED' ? 'You are on the waitlist.' : 'You are all set!'}</p>
                    </div>
                    <Button className="btn-text-danger full-width" onClick={handleUnregister}>
                      Cancel Registration
                    </Button>
                  </div>
                ) : (
                  <div className="register-action">
                    {event.capacity && (
                      <div className="spots-indicator">
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{ width: `${Math.min(100, (event.registrations_count / event.capacity) * 100)}%` }}
                          ></div>
                        </div>
                        <span className="spots-text">
                          {Math.max(0, event.capacity - event.registrations_count)} spots left
                        </span>
                      </div>
                    )}
                    <Button className="btn-primary full-width" onClick={handleRegister}>
                      {event.capacity && event.registrations_count >= event.capacity
                        ? 'Join Waitlist'
                        : 'Register Now'}
                    </Button>
                  </div>
                )
              ) : (
                <div className="status-message">
                  <p className="text-secondary text-center">
                    {event.status === 'draft' ? 'Event is unpublished.' :
                      event.status === 'pending' ? 'Pending approval.' :
                        event.status === 'cancelled' ? 'Event cancelled.' : 'Closed.'}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Event Details Sidebar */}
          <Card className="sidebar-card info-card elevated">
            <div className="sidebar-row">
              <span className="sidebar-icon">🕒</span>
              <div>
                <strong>Date & Time</strong>
                <p>{formatDate(event.start_time)}</p>
                {event.end_time && <span className="sub-text">to {new Date(event.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
              </div>
            </div>

            {event.location && (
              <div className="sidebar-row">
                <span className="sidebar-icon">📍</span>
                <div>
                  <strong>Location</strong>
                  <p>{event.location}</p>
                </div>
              </div>
            )}

            {event.company_name && (
              <div className="sidebar-row">
                <span className="sidebar-icon">🏢</span>
                <div>
                  <strong>Company</strong>
                  <p>{event.company_name}</p>
                </div>
              </div>
            )}

            {event.online_link && event.is_registered && (
              <div className="sidebar-row join-link-row">
                <a href={event.online_link} target="_blank" rel="noopener noreferrer" className="btn-secondary full-width">
                  🔗 Join Meeting
                </a>
              </div>
            )}
          </Card>

          {/* Organizer */}
          {event.organizer && (
            <Card className="sidebar-card organizer-card elevated">
              <h3>Organizer</h3>
              <Link to={`/profile/${event.organizer.id}`} className="organizer-profile">
                <Avatar name={event.organizer.name} src={event.organizer.photo_url} size="md" />
                <div className="organizer-info">
                  <span className="name">{event.organizer.name}</span>
                  <span className="role text-secondary">View Profile</span>
                </div>
              </Link>
            </Card>
          )}

          {/* Speakers */}
          {event.speakers && event.speakers.length > 0 && (
            <Card className="sidebar-card speakers-card elevated">
              <h3>Speakers</h3>
              <div className="speakers-list-sidebar">
                {event.speakers.map((speaker) => (
                  <div key={speaker.id} className="speaker-row">
                    <Avatar name={speaker.name} size="sm" />
                    <div className="speaker-info">
                      <span className="name">{speaker.name}</span>
                      {speaker.link && (
                        <a href={speaker.link} target="_blank" rel="noopener noreferrer" className="link">
                          Profile ↗
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      <style>{`
        .event-detail-page {
          max-width: 1200px;
          margin: 0 auto;
          padding-bottom: 4rem;
        }

        /* Hero */
        .event-hero {
          background: var(--bg-elevated);
          padding: 2rem;
          border-radius: 20px;
          margin-bottom: 2rem;
          border: 1px solid var(--border-subtle);
          box-shadow: 0 4px 20px -5px rgba(0,0,0,0.05);
        }

        .back-link {
          display: inline-block;
          color: var(--text-secondary);
          text-decoration: none;
          font-weight: 500;
          margin-bottom: 1.5rem;
          transition: color 0.2s;
        }
        .back-link:hover { color: var(--accent-primary); }

        .hero-badges {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }

        .type-pill, .status-pill {
           padding: 0.35rem 0.85rem;
           border-radius: 50px;
           font-size: 0.75rem;
           font-weight: 700;
           text-transform: uppercase;
           letter-spacing: 0.05em;
           border: 1px solid transparent;
        }
        
        .status-pill.status-approved { background: #d1fae5; color: #065f46; border-color: #a7f3d0; }
        .status-pill.status-pending { background: #fef3c7; color: #92400e; border-color: #fde68a; }
        .status-pill.status-cancelled { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }

        .hero-title {
          font-size: 2.5rem;
          font-weight: 800;
          margin: 0 0 0.5rem;
          line-height: 1.2;
          background: linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hero-topic {
          font-size: 1.1rem;
          color: var(--text-secondary);
          margin: 0 0 1.5rem;
        }

        .hero-meta {
          display: flex;
          gap: 2rem;
          flex-wrap: wrap;
        }

        .hero-meta-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 1rem;
          color: var(--text-primary);
          font-weight: 500;
        }
        
        .hero-meta-item .icon { font-size: 1.25rem; }

        /* Layout */
        .event-content-wrapper {
          display: grid;
          grid-template-columns: 1fr 350px;
          gap: 2rem;
          align-items: start;
        }

        @media (max-width: 900px) {
          .event-content-wrapper {
             grid-template-columns: 1fr;
          }
          .hero-title { font-size: 2rem; }
        }

        /* Content Styles */
        .content-card {
           padding: 2rem;
           margin-bottom: 2rem;
           border-radius: 16px;
           background: var(--bg-elevated);
           border: 1px solid var(--border-subtle);
        }

        .event-description p {
           line-height: 1.7;
           font-size: 1.05rem;
           color: var(--text-secondary);
        }

        .materials-section { margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--border-subtle); }
        .materials-section h4 { font-size: 0.9rem; text-transform: uppercase; color: var(--text-tertiary); margin-bottom: 1rem; }
        
        .materials-grid { display: flex; gap: 0.75rem; flex-wrap: wrap; }
        
        .material-pill {
           display: flex;
           align-items: center;
           gap: 0.5rem;
           padding: 0.5rem 1rem;
           background: var(--bg-secondary);
           border-radius: 8px;
           text-decoration: none;
           color: var(--text-primary);
           font-weight: 500;
           font-size: 0.9rem;
           transition: all 0.2s;
           border: 1px solid var(--border-color);
        }
        .material-pill:hover { border-color: var(--accent-primary); color: var(--accent-primary); background: var(--bg-primary); }

        /* Tabs */
        .interaction-section { margin-top: 2rem; }
        
        .tabs-nav {
           display: flex;
           gap: 2rem;
           border-bottom: 1px solid var(--border-subtle);
           margin-bottom: 1.5rem;
        }

        .tab-btn {
           background: none;
           border: none;
           padding: 1rem 0;
           font-size: 1rem;
           font-weight: 600;
           color: var(--text-secondary);
           cursor: pointer;
           position: relative;
        }

        .tab-btn.active { color: var(--accent-primary); }
        
        .tab-btn.active::after {
           content: '';
           position: absolute;
           bottom: -1px;
           left: 0;
           width: 100%;
           height: 2px;
           background: var(--accent-primary);
        }
        
        .tab-count {
           font-size: 0.75rem;
           background: var(--bg-tertiary);
           padding: 0.1rem 0.4rem;
           border-radius: 10px;
           margin-left: 0.4rem;
           color: var(--text-secondary);
        }

        /* Chat */
        .chat-card { padding: 0; overflow: hidden; height: 500px; display: flex; flex-direction: column; }
        .messages-container { flex: 1; overflow-y: auto; padding: 1.5rem; background: var(--bg-secondary); }
        
        .chat-message { display: flex; gap: 1rem; margin-bottom: 1rem; }
        .chat-message.own { flex-direction: row-reverse; }
        
        .bubble {
           background: var(--bg-elevated);
           padding: 0.8rem 1rem;
           border-radius: 12px;
           max-width: 70%;
           box-shadow: 0 2px 4px rgba(0,0,0,0.05);
           position: relative;
        }
        .chat-message.own .bubble { background: var(--accent-primary); color: white; }
        .chat-message.own .bubble p { color: white; }
        .chat-message.own .bubble .author, .chat-message.own .bubble .time { color: rgba(255,255,255,0.8); }

        .bubble-header { display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 0.25rem; font-size: 0.75rem; }
        .author { font-weight: 700; opacity: 0.8; }
        .time { opacity: 0.6; }
        
        .chat-input-area { padding: 1rem; background: var(--bg-elevated); border-top: 1px solid var(--border-subtle); display: flex; gap: 0.5rem; }
        .chat-input { flex: 1; padding: 0.75rem; border-radius: 20px; border: 1px solid var(--border-color); background: var(--bg-secondary); }
        .btn-icon { border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; padding: 0; }
        
        .empty-chat { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-tertiary); }
        .empty-chat span { font-size: 3rem; margin-bottom: 1rem; opacity: 0.5; }

        /* Sidebar Styles */
        .sidebar-card { padding: 1.5rem; margin-bottom: 1.5rem; border-radius: 16px; border: 1px solid var(--border-subtle); background: var(--bg-elevated); }
        .sidebar-card h3 { font-size: 1.1rem; margin: 0 0 1rem; }

        .registration-status-box { text-align: center; }
        .status-icon-box { width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin: 0 auto 1rem; }
        .status-icon-box.success { background: #d1fae5; color: #065f46; }
        .status-icon-box.waitlist { background: #fef3c7; color: #92400e; }
        
        .status-text h4 { margin: 0 0 0.25rem; }
        .status-text p { margin: 0 0 1.5rem; color: var(--text-secondary); font-size: 0.9rem; }

        .progress-bar { height: 8px; background: var(--bg-tertiary); border-radius: 4px; overflow: hidden; margin-bottom: 0.5rem; }
        .progress-fill { height: 100%; background: var(--accent-primary); border-radius: 4px; }
        .spots-indicator { margin-bottom: 1rem; text-align: left; }
        .spots-text { font-size: 0.85rem; color: var(--text-secondary); font-weight: 500; }
        
        .full-width { width: 100%; justify-content: center; }
        .btn-text-danger { background: none; border: none; color: #ef4444; font-size: 0.85rem; cursor: pointer; text-decoration: underline; margin-top: 0.5rem; }

        .sidebar-row { display: flex; gap: 1rem; margin-bottom: 1rem; align-items: flex-start; }
        .sidebar-row:last-child { margin-bottom: 0; }
        .sidebar-icon { font-size: 1.25rem; width: 1.5rem; text-align: center; }
        .sidebar-row strong { display: block; font-size: 0.9rem; }
        .sidebar-row p { margin: 0; color: var(--text-secondary); font-size: 0.9rem; }
        .sub-text { font-size: 0.8rem; color: var(--text-tertiary); }

        .organizer-profile { display: flex; align-items: center; gap: 0.75rem; text-decoration: none; color: var(--text-primary); padding: 0.5rem; border-radius: 8px; transition: background 0.2s; }
        .organizer-profile:hover { background: var(--bg-secondary); }
        .name { font-weight: 600; display: block; }
        .role { font-size: 0.8rem; display: block; }

        .speaker-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
        .link { font-size: 0.8rem; color: var(--accent-primary); text-decoration: none; }

        /* Reviews */
        .reviews-summary { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; background: var(--bg-secondary); padding: 1.5rem; border-radius: 12px; }
        .rating-big { display: flex; flex-direction: column; }
        .score { font-size: 2.5rem; font-weight: 800; line-height: 1; }
        .count { font-size: 0.8rem; color: var(--text-secondary); }
        
        .review-row { display: flex; gap: 1rem; padding: 1.5rem 0; border-bottom: 1px solid var(--border-color); }
        .review-content { flex: 1; }
        .review-meta { display: flex; justify-content: space-between; margin-bottom: 0.25rem; }
        .review-meta .date { font-size: 0.8rem; color: var(--text-tertiary); }
        .comment-text { color: var(--text-secondary); font-style: italic; margin-top: 0.5rem; line-height: 1.5; }

        .review-form-box { background: var(--bg-secondary); padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; }
        .star-select { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
        .star-btn { font-size: 1.5rem; background: none; border: none; cursor: pointer; color: var(--text-tertiary); transition: color 0.1s; }
        .star-btn.active { color: #f59e0b; }
        .review-input { width: 100%; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 1rem; }
        .btn-text { background: none; border: none; cursor: pointer; color: var(--text-secondary); }

      `}</style>
    </div>
  );
};

export default EventDetail;
