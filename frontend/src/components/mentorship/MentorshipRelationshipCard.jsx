import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../ui/Button';
import { messagesApi } from '../../api/messages';
import { mentorshipApi } from '../../api/mentorship';
import MentorFeedbackModal from './MentorFeedbackModal';

const apiBase = import.meta.env.VITE_API_URL || '';
const resolveUrl = (path) => (path ? (path.startsWith('http') ? path : `${apiBase}${path}`) : null);
const fallbackAvatar = 'https://via.placeholder.com/50?text=U';

const StarDisplay = ({ rating }) => (
  <span className="star-display" aria-label={`${rating} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((s) => (
      <span key={s} className={s <= rating ? 'star-filled-sm' : 'star-empty-sm'}>★</span>
    ))}
  </span>
);

const toDatetimeLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const MentorshipRelationshipCard = ({ relationship, currentUserId, onChanged }) => {
  const navigate = useNavigate();
  const isMentor = relationship.mentor_id === currentUserId;
  const otherUser = isMentor ? relationship.mentee : relationship.mentor;
  const roleLabel = isMentor ? 'Mentee' : 'Mentor';
  const isActive = relationship.status === 'ACTIVE';
  const plan = relationship.plan || {};
  const sessions = relationship.sessions || [];

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [existingFeedback, setExistingFeedback] = useState(null);
  const [loadingFeedback, setLoadingFeedback] = useState(true);
  const [editingPlan, setEditingPlan] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [sessionSaving, setSessionSaving] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [planDraft, setPlanDraft] = useState({
    goal: '',
    milestones: '',
    meeting_frequency: '',
    expected_duration: '',
    notes: '',
    next_step: '',
  });
  const [sessionDraft, setSessionDraft] = useState({
    topic: '',
    scheduled_at: '',
    notes: '',
  });

  useEffect(() => {
    loadFeedback();
  }, [relationship.id]);

  useEffect(() => {
    setPlanDraft({
      goal: plan.goal || relationship.goals || '',
      milestones: (plan.milestones || []).join(', '),
      meeting_frequency: plan.meeting_frequency || '',
      expected_duration: plan.expected_duration || relationship.expected_duration || '',
      notes: plan.notes || '',
      next_step: plan.next_step || '',
    });
  }, [relationship.id, relationship.goals, relationship.expected_duration, plan.goal, plan.meeting_frequency, plan.expected_duration, plan.notes, plan.next_step]);

  const loadFeedback = async () => {
    try {
      const fb = await mentorshipApi.getFeedback(relationship.id);
      setExistingFeedback(fb);
    } catch {
      setExistingFeedback(null);
    } finally {
      setLoadingFeedback(false);
    }
  };

  const handleMessage = async () => {
    if (!otherUser?.user_id) return;
    try {
      const convo = await messagesApi.startConversation(otherUser.user_id);
      navigate(`/messages?chat=${convo.conversation_id}`);
    } catch (err) {
      console.error('Failed to start conversation', err);
    }
  };

  const handleFeedbackSubmit = async (data) => {
    const result = await mentorshipApi.submitFeedback(relationship.id, data);
    setExistingFeedback(result);
  };

  const handlePlanSubmit = async (e) => {
    e.preventDefault();
    setSavingPlan(true);
    setActionError(null);
    try {
      await mentorshipApi.updatePlan(relationship.id, {
        goal: planDraft.goal,
        milestones: planDraft.milestones
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        meeting_frequency: planDraft.meeting_frequency,
        expected_duration: planDraft.expected_duration,
        notes: planDraft.notes,
        next_step: planDraft.next_step,
      });
      setEditingPlan(false);
      onChanged?.();
    } catch (err) {
      console.error('Failed to update mentorship plan', err);
      setActionError(err.response?.data?.detail || 'Failed to update mentorship plan');
    } finally {
      setSavingPlan(false);
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!sessionDraft.topic.trim()) return;
    setSessionSaving(true);
    setActionError(null);
    try {
      await mentorshipApi.createSession(relationship.id, {
        topic: sessionDraft.topic.trim(),
        scheduled_at: sessionDraft.scheduled_at ? new Date(sessionDraft.scheduled_at).toISOString() : null,
        notes: sessionDraft.notes,
      });
      setSessionDraft({ topic: '', scheduled_at: '', notes: '' });
      onChanged?.();
    } catch (err) {
      console.error('Failed to create mentorship session', err);
      setActionError(err.response?.data?.detail || 'Failed to create mentorship session');
    } finally {
      setSessionSaving(false);
    }
  };

  const handleSessionStatus = async (sessionId, status) => {
    setActionError(null);
    try {
      await mentorshipApi.updateSession(sessionId, { status });
      onChanged?.();
    } catch (err) {
      console.error('Failed to update session', err);
      setActionError(err.response?.data?.detail || 'Failed to update session');
    }
  };

  const handleJoinSession = (session) => {
    if (!session.room_name) return;
    navigate(`/video-call/${encodeURIComponent(session.room_name)}?mentorship=${relationship.id}`, {
      state: { from: '/mentorship' },
    });
  };

  const handleComplete = async () => {
    setActionError(null);
    try {
      await mentorshipApi.updateRelationshipStatus(relationship.id, 'COMPLETED');
      onChanged?.();
    } catch (err) {
      console.error('Failed to complete mentorship', err);
      setActionError(err.response?.data?.detail || 'Failed to complete mentorship');
    }
  };

  return (
    <>
      <div className="mentorship-card card">
        <div className="mentorship-card-header">
          <div className="mentorship-user">
            <img
              src={resolveUrl(otherUser?.photo_url) || fallbackAvatar}
              alt={otherUser?.name}
              className="mentorship-avatar"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = fallbackAvatar;
              }}
            />
            <div className="mentorship-user-meta">
              <h4 className="mentorship-user-name">
                <Link to={`/profile/${otherUser?.user_id}`} className="mentorship-user-link">
                  {otherUser?.name}
                </Link>
              </h4>
              <p className="mentorship-user-subtitle">{roleLabel} • {otherUser?.headline || otherUser?.role}</p>
            </div>
          </div>
          <span className={`status-badge status-${relationship.status?.toLowerCase() || 'active'}`}>
            {relationship.status || 'ACTIVE'}
          </span>
        </div>

        <div className="mentorship-card-body">
          <div className="mentorship-meta-grid">
            <span>{relationship.expected_duration || 'Duration TBD'}</span>
            <span>{relationship.preferred_format || 'Format TBD'}</span>
          </div>
          {relationship.goals && (
            <>
              <p className="mentorship-body-label">Goals:</p>
              <p className="mentorship-goals-box">
                {relationship.goals}
              </p>
            </>
          )}
          <p className="mentorship-start-date">
            Started on {new Date(relationship.created_at).toLocaleDateString()}
          </p>

          <section className="mentorship-workflow-section">
            <div className="mentorship-section-header">
              <div>
                <p className="mentorship-body-label">Mentorship plan</p>
                <strong>{plan.goal || relationship.goals || 'Plan not finalized yet'}</strong>
              </div>
              {isMentor && isActive && (
                <Button variant="secondary" size="sm" onClick={() => setEditingPlan((value) => !value)}>
                  {editingPlan ? 'Close' : 'Edit Plan'}
                </Button>
              )}
            </div>

            {editingPlan ? (
              <form className="mentorship-plan-form" onSubmit={handlePlanSubmit}>
                <input
                  className="form-input"
                  value={planDraft.goal}
                  onChange={(e) => setPlanDraft((prev) => ({ ...prev, goal: e.target.value }))}
                  placeholder="Main mentorship goal"
                />
                <input
                  className="form-input"
                  value={planDraft.milestones}
                  onChange={(e) => setPlanDraft((prev) => ({ ...prev, milestones: e.target.value }))}
                  placeholder="Milestones, comma separated"
                />
                <div className="mentor-request-grid">
                  <input
                    className="form-input"
                    value={planDraft.meeting_frequency}
                    onChange={(e) => setPlanDraft((prev) => ({ ...prev, meeting_frequency: e.target.value }))}
                    placeholder="Meeting frequency"
                  />
                  <input
                    className="form-input"
                    value={planDraft.expected_duration}
                    onChange={(e) => setPlanDraft((prev) => ({ ...prev, expected_duration: e.target.value }))}
                    placeholder="Expected duration"
                  />
                </div>
                <textarea
                  className="form-input"
                  rows="2"
                  value={planDraft.next_step}
                  onChange={(e) => setPlanDraft((prev) => ({ ...prev, next_step: e.target.value }))}
                  placeholder="Next step"
                />
                <textarea
                  className="form-input"
                  rows="2"
                  value={planDraft.notes}
                  onChange={(e) => setPlanDraft((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Notes"
                />
                <Button type="submit" variant="primary" disabled={savingPlan}>
                  {savingPlan ? 'Saving...' : 'Save Plan'}
                </Button>
              </form>
            ) : (
              <div className="mentorship-plan-read">
                {(plan.milestones || []).length > 0 && (
                  <div className="mentorship-chip-row">
                    {plan.milestones.map((milestone) => (
                      <span key={milestone} className="mentorship-chip">{milestone}</span>
                    ))}
                  </div>
                )}
                <div className="mentorship-meta-grid">
                  <span>{plan.meeting_frequency || 'Frequency TBD'}</span>
                  <span>{plan.expected_duration || relationship.expected_duration || 'Duration TBD'}</span>
                </div>
                {plan.next_step && <p className="mentorship-goals-box">{plan.next_step}</p>}
                {plan.notes && <p className="mentorship-note">{plan.notes}</p>}
              </div>
            )}
          </section>

          <section className="mentorship-workflow-section">
            <div className="mentorship-section-header">
              <div>
                <p className="mentorship-body-label">Sessions</p>
                <strong>{sessions.length} planned or completed</strong>
              </div>
            </div>

            {sessions.length > 0 ? (
              <div className="mentorship-session-list">
                {sessions.map((session) => (
                  <div key={session.id} className="mentorship-session-item">
                    <div>
                      <strong>{session.topic}</strong>
                      <span>
                        {session.scheduled_at
                          ? new Date(session.scheduled_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
                          : 'Time TBD'}
                      </span>
                    </div>
                    <span className={`status-badge status-${session.status.toLowerCase()}`}>
                      {session.status}
                    </span>
                    <div className="mentorship-session-actions">
                      {session.status !== 'CANCELLED' && (
                        <Button variant="secondary" size="sm" onClick={() => handleJoinSession(session)}>
                          Join video
                        </Button>
                      )}
                      {session.status === 'PLANNED' && (
                        <>
                          <Button variant="secondary" size="sm" onClick={() => handleSessionStatus(session.id, 'DONE')}>
                            Done
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => handleSessionStatus(session.id, 'CANCELLED')}>
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>
                    {session.notes && <p className="mentorship-note">{session.notes}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mentorship-note">No sessions scheduled yet.</p>
            )}

            {isActive && (
              <form className="mentorship-session-form" onSubmit={handleCreateSession}>
                <input
                  className="form-input"
                  value={sessionDraft.topic}
                  onChange={(e) => setSessionDraft((prev) => ({ ...prev, topic: e.target.value }))}
                  placeholder="Session topic"
                  required
                />
                <input
                  className="form-input"
                  type="datetime-local"
                  value={toDatetimeLocal(sessionDraft.scheduled_at)}
                  onChange={(e) => setSessionDraft((prev) => ({ ...prev, scheduled_at: e.target.value }))}
                />
                <input
                  className="form-input"
                  value={sessionDraft.notes}
                  onChange={(e) => setSessionDraft((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Notes"
                />
                <Button type="submit" variant="primary" disabled={sessionSaving}>
                  {sessionSaving ? 'Adding...' : 'Add Session'}
                </Button>
              </form>
            )}
          </section>

          {!loadingFeedback && existingFeedback && (
            <div className="feedback-summary">
              <p className="feedback-summary-title">
                {isMentor ? 'Your feedback:' : 'Mentor\'s feedback:'}
              </p>
              <div className="feedback-summary-row">
                <StarDisplay rating={existingFeedback.rating} />
                <span className="feedback-rating-text">{existingFeedback.rating}/5</span>
              </div>
              {existingFeedback.comment && (
                <p className="feedback-comment-preview">"{existingFeedback.comment}"</p>
              )}
            </div>
          )}

          {actionError && <div className="error-message mentorship-error">{actionError}</div>}
        </div>

        <div className="mentorship-card-actions">
          {isMentor && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowFeedbackModal(true)}
              className="feedback-btn"
            >
              {existingFeedback ? 'Edit Feedback' : 'Give Feedback ★'}
            </Button>
          )}
          {isMentor && isActive && (
            <Button variant="secondary" size="sm" onClick={handleComplete}>
              Complete
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={handleMessage}>
            Message
          </Button>
        </div>
      </div>

      {showFeedbackModal && (
        <MentorFeedbackModal
          relationship={relationship}
          existingFeedback={existingFeedback}
          onClose={() => setShowFeedbackModal(false)}
          onSubmit={handleFeedbackSubmit}
        />
      )}
    </>
  );
};

export default MentorshipRelationshipCard;
