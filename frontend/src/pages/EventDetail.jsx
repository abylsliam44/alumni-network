import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { eventsApi } from '../api/events';
import { useAuth } from '../hooks/useAuth';
import Avatar from '../components/ui/Avatar';
import Pill from '../components/ui/Pill';
import Icon from '../components/ui/Icon';
import Alert from '../components/ui/Alert';
import { resolveUrl } from '../utils/image';

const EVENT_TYPE_LABEL = {
  career: 'Career', educational: 'Educational', networking: 'Networking',
  recruiting: 'Recruiting', 'invite-only': 'Invite-only',
};
const STATUS_TONE = { draft: undefined, pending: 'warm', approved: 'ok', cancelled: 'err', completed: 'blue' };

const formatDateTime = (s) =>
  new Date(s).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const StarDisplay = ({ rating }) => (
  <span style={{ color: 'var(--warm)' }}>
    {[1, 2, 3, 4, 5].map((s) => <span key={s} style={{ opacity: s <= rating ? 1 : 0.25 }}>★</span>)}
  </span>
);

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
    try { setLoading(true); setEvent(await eventsApi.get(eventId)); }
    catch (err) { setError(err.response?.data?.detail || 'Failed to load event'); }
    finally { setLoading(false); }
  }, [eventId]);

  const fetchReviews = useCallback(async () => {
    try { setReviews(await eventsApi.getReviews(eventId)); } catch (err) { console.error(err); }
  }, [eventId]);

  const fetchMessages = useCallback(async () => {
    try { setMessages(await eventsApi.getMessages(eventId)); } catch { /* not available */ }
  }, [eventId]);

  useEffect(() => { fetchEvent(); }, [fetchEvent]);
  useEffect(() => {
    if (event && new Date(event.start_time) <= new Date()) {
      fetchReviews(); fetchMessages();
    }
  }, [event, fetchReviews, fetchMessages]);

  const handleRegister = async () => {
    try { await eventsApi.register(eventId); fetchEvent(); }
    catch (err) { alert(err.response?.data?.detail || 'Failed to register'); }
  };
  const handleUnregister = async () => {
    if (!window.confirm('Cancel your registration?')) return;
    try { await eventsApi.unregister(eventId); fetchEvent(); }
    catch (err) { alert(err.response?.data?.detail || 'Failed to unregister'); }
  };
  const handleSubmitForApproval = async () => {
    try { await eventsApi.submitForApproval(eventId); fetchEvent(); }
    catch (err) { alert(err.response?.data?.detail || 'Failed to submit'); }
  };
  const handleApprove = async () => {
    try { await eventsApi.approve(eventId); fetchEvent(); }
    catch (err) { alert(err.response?.data?.detail || 'Failed to approve event'); }
  };
  const handleReject = async () => {
    const reason = window.prompt('Reason for rejection (optional):');
    if (reason === null) return;
    try { await eventsApi.reject(eventId, reason); fetchEvent(); }
    catch (err) { alert(err.response?.data?.detail || 'Failed to reject event'); }
  };
  const handleCancel = async () => {
    if (!window.confirm('Cancel this event? All participants will be notified.')) return;
    try { await eventsApi.cancel(eventId); fetchEvent(); }
    catch (err) { alert(err.response?.data?.detail || 'Failed to cancel event'); }
  };
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    try { await eventsApi.sendMessage(eventId, newMessage); setNewMessage(''); fetchMessages(); }
    catch (err) { alert(err.response?.data?.detail || 'Failed to send message'); }
  };
  const handleSubmitReview = async (e) => {
    e.preventDefault();
    try {
      await eventsApi.createReview(eventId, newReview);
      setShowReviewForm(false); setNewReview({ rating: 5, comment: '' });
      fetchReviews();
    } catch (err) { alert(err.response?.data?.detail || 'Failed to submit review'); }
  };

  if (loading) return <div className="page"><div className="loading-block">Loading event…</div></div>;
  if (error) return <div className="page"><Alert type="error">{error}</Alert><button className="btn mt-12" onClick={() => navigate('/events')}>Back</button></div>;
  if (!event) return null;

  const hasStarted = new Date(event.start_time) <= new Date();
  const isOrganizer = user && event.organizer_id === user.id;
  const isAdmin = user?.is_admin;
  const canReview = user && (user.is_admin || user.role === 'STAFF');
  const canManage = isOrganizer || isAdmin;

  const tabs = [
    { k: 'details', label: 'Details' },
    ...(hasStarted ? [{ k: 'chat', label: 'Live chat', count: messages.total }] : []),
    ...(hasStarted ? [{ k: 'reviews', label: 'Reviews', count: reviews.total }] : []),
  ];

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
        <Link to="/events" style={{ color: 'var(--ink-3)' }}>EVENTS</Link>
        <span>/</span>
        <span style={{ color: 'var(--ink-2)' }}>{event.title.toUpperCase()}</span>
      </div>

      <div className="panel" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {event.type && <Pill tone="blue" dot>{EVENT_TYPE_LABEL[event.type] || event.type}</Pill>}
          <Pill tone={STATUS_TONE[event.status]} dot>{event.status}</Pill>
          {event.is_registered && <Pill tone="ok" dot>{event.registration_status === 'WAITLISTED' ? 'Waitlist' : 'Registered'}</Pill>}
        </div>
        <h1 className="h1" style={{ fontSize: 32 }}>{event.title}</h1>
        {event.topic && <div className="dim" style={{ fontSize: 14, marginTop: 8 }}>{event.topic}</div>}
        <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap', color: 'var(--ink-3)', fontSize: 12.5, fontFamily: 'var(--mono)' }}>
          <span><Icon name="calendar" size={12} style={{ verticalAlign: 'middle' }} /> {formatDateTime(event.start_time).toUpperCase()}</span>
          <span>
            <Icon name={event.format === 'online' ? 'globe' : 'mapPin'} size={12} style={{ verticalAlign: 'middle' }} />{' '}
            {event.format === 'online' ? 'ONLINE' : event.format === 'hybrid' ? 'HYBRID' : (event.location || 'IN-PERSON').toUpperCase()}
          </span>
        </div>
      </div>

      <div className="responsive-two-col">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>01 · ABOUT</div>
          <div className="panel" style={{ padding: 18 }}>
            {event.description ? (
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>{event.description}</p>
            ) : (
              <p className="mute" style={{ margin: 0, fontSize: 13 }}>No description provided.</p>
            )}
          </div>

          {event.materials && event.materials.length > 0 && (
            <>
              <div className="eyebrow" style={{ margin: '24px 0 10px' }}>MATERIALS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {event.materials.map((m) => (
                  <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" className="chip" style={{ textDecoration: 'none', color: 'var(--ink)', cursor: 'pointer' }}>
                    <Icon name="doc" size={12} /> {m.title}
                  </a>
                ))}
              </div>
            </>
          )}

          {(canManage || canReview) && (
            <>
              <div className="eyebrow" style={{ margin: '24px 0 10px' }}>EVENT MANAGEMENT</div>
              <div className="panel" style={{ padding: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {isOrganizer && event.status === 'draft' && (
                  <button className="btn primary" onClick={handleSubmitForApproval}>Submit for approval</button>
                )}
                {canReview && event.status === 'pending' && (
                  <>
                    <button className="btn primary" onClick={handleApprove}>Approve</button>
                    <button className="btn ghost" onClick={handleReject}>Reject</button>
                  </>
                )}
                {canManage && event.status !== 'cancelled' && event.status !== 'completed' && (
                  <button className="btn ghost" onClick={handleCancel}>Cancel event</button>
                )}
              </div>
            </>
          )}

          {hasStarted && (
            <>
              <div className="tabs" style={{ marginTop: 24, marginBottom: 16 }}>
                {tabs.map((t) => (
                  <button key={t.k} className={`tab${activeTab === t.k ? ' active' : ''}`} onClick={() => setActiveTab(t.k)}>
                    {t.label}{t.count != null && <span className="count">{t.count}</span>}
                  </button>
                ))}
              </div>

              {activeTab === 'chat' && (
                <div className="panel" style={{ padding: 16 }}>
                  <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                    {messages.items.length === 0 ? (
                      <div className="empty-block"><Icon name="msg" size={28} /><h3>Start the conversation</h3></div>
                    ) : messages.items.map((m) => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <Avatar src={resolveUrl(m.user_photo)} name={m.user_name} size="s" />
                        <div className="panel" style={{ padding: 10, flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <strong style={{ fontSize: 12.5 }}>{m.user_name}</strong>
                            <span className="mono mute" style={{ fontSize: 9.5 }}>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>{m.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {event.is_registered ? (
                    <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: 8 }}>
                      <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message…" />
                      <button type="submit" className="btn primary"><Icon name="send" size={12} /></button>
                    </form>
                  ) : (
                    <p className="mute" style={{ fontSize: 12, textAlign: 'center', margin: 0 }}>Register to join the chat.</p>
                  )}
                </div>
              )}

              {activeTab === 'reviews' && (
                <div className="panel" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div>
                      <div className="h2" style={{ fontSize: 28 }}>{(reviews.average_rating || 0).toFixed(1)}</div>
                      <StarDisplay rating={Math.round(reviews.average_rating || 0)} />
                      <div className="mute mono" style={{ fontSize: 10.5, marginTop: 4 }}>{reviews.total} REVIEW{reviews.total === 1 ? '' : 'S'}</div>
                    </div>
                    {event.is_registered && !showReviewForm && (
                      <button className="btn primary" onClick={() => setShowReviewForm(true)}>Write review</button>
                    )}
                  </div>

                  {showReviewForm && (
                    <form onSubmit={handleSubmitReview} className="panel" style={{ padding: 14, marginBottom: 12 }}>
                      <div className="eyebrow" style={{ marginBottom: 8 }}>YOUR RATING</div>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star} type="button"
                            onClick={() => setNewReview((p) => ({ ...p, rating: star }))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: newReview.rating >= star ? 'var(--warm)' : 'var(--ink-4)', padding: 0 }}
                          >★</button>
                        ))}
                      </div>
                      <textarea value={newReview.comment} onChange={(e) => setNewReview((p) => ({ ...p, comment: e.target.value }))} rows={3} placeholder="Share your experience…" />
                      <div className="form-actions" style={{ marginTop: 10 }}>
                        <button type="button" className="btn ghost" onClick={() => setShowReviewForm(false)}>Cancel</button>
                        <button type="submit" className="btn primary">Submit</button>
                      </div>
                    </form>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {reviews.items.map((r) => (
                      <div key={r.id} className="panel" style={{ padding: 12, background: 'var(--bg-2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <Avatar src={resolveUrl(r.user_photo)} name={r.user_name} size="s" />
                          <div style={{ flex: 1 }}>
                            <strong style={{ fontSize: 12.5 }}>{r.user_name}</strong>
                            <div className="mute mono" style={{ fontSize: 9.5 }}>{new Date(r.created_at).toLocaleDateString()}</div>
                          </div>
                          <StarDisplay rating={r.rating} />
                        </div>
                        {r.comment && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-2)' }}>{r.comment}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>REGISTRATION</div>
          <div className="panel" style={{ padding: 16 }}>
            {event.status === 'approved' ? (
              event.is_registered ? (
                <>
                  <Pill tone={event.registration_status === 'WAITLISTED' ? 'warm' : 'ok'} dot>
                    {event.registration_status === 'WAITLISTED' ? 'On the waitlist' : 'You\'re registered'}
                  </Pill>
                  <button className="btn ghost block" style={{ marginTop: 12 }} onClick={handleUnregister}>
                    Cancel registration
                  </button>
                </>
              ) : (
                <>
                  {event.capacity && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span className="mute mono" style={{ fontSize: 10 }}>SEATS</span>
                        <span className="mono" style={{ fontSize: 10.5, color: 'var(--blue)' }}>
                          {event.registrations_count || 0} / {event.capacity}
                        </span>
                      </div>
                      <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 2, marginBottom: 14 }}>
                        <div style={{ width: `${Math.min(100, ((event.registrations_count || 0) / event.capacity) * 100)}%`, height: '100%', background: 'var(--blue)', borderRadius: 2 }} />
                      </div>
                    </>
                  )}
                  <button className="btn primary block" onClick={handleRegister}>
                    {event.capacity && event.registrations_count >= event.capacity ? 'Join waitlist' : 'Register'}
                  </button>
                </>
              )
            ) : (
              <p className="mute" style={{ fontSize: 12, margin: 0, textAlign: 'center' }}>
                {event.status === 'draft' ? 'Event is unpublished.' :
                  event.status === 'pending' ? 'Pending approval.' :
                  event.status === 'cancelled' ? 'Event cancelled.' : 'Registration closed.'}
              </p>
            )}
          </div>

          <div className="eyebrow" style={{ margin: '20px 0 10px' }}>EVENT DETAILS</div>
          <div className="panel" style={{ padding: 16 }}>
            {[
              ['Date', formatDateTime(event.start_time)],
              ...(event.end_time ? [['Until', new Date(event.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })]] : []),
              ...(event.location ? [['Location', event.location]] : []),
              ...(event.company_name ? [['Company', event.company_name]] : []),
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: '1px solid var(--line-soft)', fontSize: 12.5 }}>
                <span className="mute mono" style={{ fontSize: 10.5 }}>{k.toUpperCase()}</span>
                <span style={{ color: 'var(--ink)', textAlign: 'right' }}>{v}</span>
              </div>
            ))}
            {event.online_link && event.is_registered && (
              <a href={event.online_link} target="_blank" rel="noopener noreferrer" className="btn block" style={{ marginTop: 14 }}>
                <Icon name="external" size={12} /> Join meeting
              </a>
            )}
          </div>

          {event.organizer && (
            <>
              <div className="eyebrow" style={{ margin: '20px 0 10px' }}>ORGANIZER</div>
              <Link to={`/profile/${event.organizer.id}`} className="panel" style={{ padding: 14, display: 'flex', gap: 12, alignItems: 'center', textDecoration: 'none', color: 'var(--ink)' }}>
                <Avatar src={resolveUrl(event.organizer.photo_url)} name={event.organizer.name} size="m" />
                <div>
                  <div className="h3">{event.organizer.name}</div>
                  <div className="mute mono" style={{ fontSize: 10, marginTop: 2 }}>VIEW PROFILE →</div>
                </div>
              </Link>
            </>
          )}

          {event.speakers && event.speakers.length > 0 && (
            <>
              <div className="eyebrow" style={{ margin: '20px 0 10px' }}>SPEAKERS</div>
              <div className="panel" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {event.speakers.map((sp) => (
                  <div key={sp.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={sp.name} size="s" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5 }}>{sp.name}</div>
                      {sp.link && <a href={sp.link} target="_blank" rel="noopener noreferrer" className="mono" style={{ fontSize: 10, color: 'var(--blue)' }}>Profile ↗</a>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventDetail;
