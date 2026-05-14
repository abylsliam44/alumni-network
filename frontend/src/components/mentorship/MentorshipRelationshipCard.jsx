import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { messagesApi } from '../../api/messages';
import { mentorshipApi } from '../../api/mentorship';
import MentorFeedbackModal from './MentorFeedbackModal';
import Avatar from '../ui/Avatar';
import Pill from '../ui/Pill';
import Icon from '../ui/Icon';
import { resolveUrl } from '../../utils/image';

const STATUS_TONE = { ACTIVE: 'blue', COMPLETED: 'ok', PENDING: 'warm', PLANNED: 'blue', DONE: 'ok', CANCELLED: undefined };

const normalizeMilestones = (items = []) => items
  .map((item, index) => {
    if (typeof item === 'string') {
      return { id: `legacy-${index}-${item}`, title: item, completed: false, completed_at: null };
    }
    return {
      id: item.id || `milestone-${index}`,
      title: item.title || item.name || '',
      completed: !!item.completed,
      completed_at: item.completed_at || null,
    };
  })
  .filter((item) => item.title);

const StarDisplay = ({ rating }) => (
  <span style={{ color: 'var(--warm)', letterSpacing: 1 }}>
    {[1, 2, 3, 4, 5].map((s) => (
      <span key={s} style={{ opacity: s <= rating ? 1 : 0.25 }}>★</span>
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
  const milestones = useMemo(() => normalizeMilestones(plan.milestones || []), [plan.milestones]);
  const completedMilestones = milestones.filter((item) => item.completed).length;
  const progress = milestones.length ? Math.round((completedMilestones / milestones.length) * 100) : 0;
  const nextSession = sessions
    .filter((session) => session.status === 'PLANNED')
    .sort((a, b) => new Date(a.scheduled_at || a.created_at) - new Date(b.scheduled_at || b.created_at))[0];

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [existingFeedback, setExistingFeedback] = useState(null);
  const [loadingFeedback, setLoadingFeedback] = useState(true);
  const [editingPlan, setEditingPlan] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [sessionSaving, setSessionSaving] = useState(false);
  const [milestoneSaving, setMilestoneSaving] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [planDraft, setPlanDraft] = useState({
    goal: '', milestones: '', meeting_frequency: '', expected_duration: '', notes: '', next_step: '',
  });
  const [sessionDraft, setSessionDraft] = useState({ topic: '', scheduled_at: '', notes: '' });

  useEffect(() => {
    (async () => {
      try { setExistingFeedback(await mentorshipApi.getFeedback(relationship.id)); }
      catch { setExistingFeedback(null); }
      finally { setLoadingFeedback(false); }
    })();
  }, [relationship.id]);

  useEffect(() => {
    setPlanDraft({
      goal: plan.goal || relationship.goals || '',
      milestones: milestones.map((m) => m.title).join(', '),
      meeting_frequency: plan.meeting_frequency || '',
      expected_duration: plan.expected_duration || relationship.expected_duration || '',
      notes: plan.notes || '',
      next_step: plan.next_step || '',
    });
  }, [relationship.id, relationship.goals, relationship.expected_duration, plan.goal, plan.meeting_frequency, plan.expected_duration, plan.notes, plan.next_step, milestones]);

  const handleMessage = async () => {
    if (!otherUser?.user_id) return;
    try {
      const convo = await messagesApi.startConversation(otherUser.user_id);
      navigate(`/messages?chat=${convo.conversation_id}`);
    } catch (err) { console.error(err); }
  };

  const handleFeedbackSubmit = async (data) => {
    const result = await mentorshipApi.submitFeedback(relationship.id, data);
    setExistingFeedback(result);
  };

  const handlePlanSubmit = async (e) => {
    e.preventDefault(); setSavingPlan(true); setActionError(null);
    const titles = planDraft.milestones.split(',').map((s) => s.trim()).filter(Boolean);
    try {
      await mentorshipApi.updatePlan(relationship.id, {
        goal: planDraft.goal,
        milestones: titles.map((title) => {
          const existing = milestones.find((item) => item.title.toLowerCase() === title.toLowerCase());
          return existing || { title, completed: false, completed_at: null };
        }),
        meeting_frequency: planDraft.meeting_frequency,
        expected_duration: planDraft.expected_duration,
        notes: planDraft.notes,
        next_step: planDraft.next_step,
      });
      setEditingPlan(false); onChanged?.();
    } catch (err) { setActionError(err.response?.data?.detail || 'Failed to update plan'); }
    finally { setSavingPlan(false); }
  };

  const handleMilestoneToggle = async (milestone) => {
    setMilestoneSaving(milestone.id); setActionError(null);
    try {
      await mentorshipApi.toggleMilestone(relationship.id, milestone.id, !milestone.completed);
      onChanged?.();
    } catch (err) { setActionError(err.response?.data?.detail || 'Failed to update milestone'); }
    finally { setMilestoneSaving(null); }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!sessionDraft.topic.trim()) return;
    setSessionSaving(true); setActionError(null);
    try {
      await mentorshipApi.createSession(relationship.id, {
        topic: sessionDraft.topic.trim(),
        scheduled_at: sessionDraft.scheduled_at ? new Date(sessionDraft.scheduled_at).toISOString() : null,
        notes: sessionDraft.notes,
      });
      setSessionDraft({ topic: '', scheduled_at: '', notes: '' });
      onChanged?.();
    } catch (err) { setActionError(err.response?.data?.detail || 'Failed to create session'); }
    finally { setSessionSaving(false); }
  };

  const handleSessionStatus = async (sessionId, status) => {
    setActionError(null);
    try { await mentorshipApi.updateSession(sessionId, { status }); onChanged?.(); }
    catch (err) { setActionError(err.response?.data?.detail || 'Failed to update session'); }
  };

  const handleJoinSession = (session) => {
    if (!session.room_name) return;
    navigate(`/video-call/${encodeURIComponent(session.room_name)}?mentorship=${relationship.id}`, {
      state: { from: '/mentorship' },
    });
  };

  const handleComplete = async () => {
    setActionError(null);
    try { await mentorshipApi.updateRelationshipStatus(relationship.id, 'COMPLETED'); onChanged?.(); }
    catch (err) { setActionError(err.response?.data?.detail || 'Failed to complete mentorship'); }
  };

  return (
    <>
      <div className="panel" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <Avatar src={resolveUrl(otherUser?.photo_url)} name={otherUser?.name} size="l" />
            <div style={{ minWidth: 0 }}>
              <h4 className="h3">
                <Link to={`/profile/${otherUser?.user_id}`} style={{ color: 'var(--ink)' }}>{otherUser?.name}</Link>
              </h4>
              <div className="mute" style={{ fontSize: 12, marginTop: 2 }}>
                {roleLabel} - {otherUser?.headline || otherUser?.role}
              </div>
            </div>
          </div>
          <Pill tone={STATUS_TONE[relationship.status] || ''} dot>{relationship.status || 'ACTIVE'}</Pill>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          <span className="pill">{relationship.expected_duration || 'Duration TBD'}</span>
          <span className="pill">{relationship.preferred_format || 'Format TBD'}</span>
          <span className="pill">{plan.meeting_frequency || 'Frequency TBD'}</span>
          <span className="pill">Started {new Date(relationship.created_at).toLocaleDateString()}</span>
        </div>

        <div className="mentor-progress-strip">
          <div>
            <div className="eyebrow">PROGRESS</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
              {completedMilestones}/{milestones.length || 0} milestones
            </div>
          </div>
          <div className="mentor-progress-bar">
            <span style={{ width: `${progress}%` }} />
          </div>
          <span className="mono" style={{ fontSize: 12, color: 'var(--blue)' }}>{progress}%</span>
        </div>

        {nextSession && (
          <div className="panel blue-tint" style={{ padding: 12, marginBottom: 14 }}>
            <div className="eyebrow" style={{ color: 'var(--blue)', marginBottom: 4 }}>NEXT SESSION</div>
            <div className="h3" style={{ fontSize: 13 }}>{nextSession.topic}</div>
            <div className="mute mono" style={{ fontSize: 10.5, marginTop: 2 }}>
              {nextSession.scheduled_at ? new Date(nextSession.scheduled_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Time TBD'}
            </div>
          </div>
        )}

        {relationship.goals && (
          <>
            <div className="eyebrow" style={{ marginBottom: 6 }}>GOALS</div>
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line-soft)', padding: 10, borderRadius: 7, fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 14 }}>
              {relationship.goals}
            </div>
          </>
        )}

        <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 14, marginTop: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <div className="eyebrow">PLAN</div>
            {isMentor && isActive && (
              <button className="btn sm ghost" onClick={() => setEditingPlan((v) => !v)}>{editingPlan ? 'Close' : 'Edit'}</button>
            )}
          </div>

          {editingPlan ? (
            <form onSubmit={handlePlanSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input value={planDraft.goal} onChange={(e) => setPlanDraft((p) => ({ ...p, goal: e.target.value }))} placeholder="Main goal" />
              <input value={planDraft.milestones} onChange={(e) => setPlanDraft((p) => ({ ...p, milestones: e.target.value }))} placeholder="Milestones, comma separated" />
              <div className="form-row">
                <input value={planDraft.meeting_frequency} onChange={(e) => setPlanDraft((p) => ({ ...p, meeting_frequency: e.target.value }))} placeholder="Frequency" />
                <input value={planDraft.expected_duration} onChange={(e) => setPlanDraft((p) => ({ ...p, expected_duration: e.target.value }))} placeholder="Expected duration" />
              </div>
              <textarea rows="2" value={planDraft.next_step} onChange={(e) => setPlanDraft((p) => ({ ...p, next_step: e.target.value }))} placeholder="Next step" />
              <textarea rows="2" value={planDraft.notes} onChange={(e) => setPlanDraft((p) => ({ ...p, notes: e.target.value }))} placeholder="Notes" />
              <button type="submit" className="btn primary" disabled={savingPlan}>{savingPlan ? 'Saving...' : 'Save plan'}</button>
            </form>
          ) : (
            <>
              <div style={{ fontSize: 13, color: 'var(--ink)' }}>{plan.goal || relationship.goals || 'Plan not finalized'}</div>
              {milestones.length > 0 && (
                <div className="mentor-milestone-list">
                  {milestones.map((milestone) => (
                    <button
                      key={milestone.id}
                      type="button"
                      className={`mentor-milestone${milestone.completed ? ' done' : ''}`}
                      onClick={() => handleMilestoneToggle(milestone)}
                      disabled={milestoneSaving === milestone.id || !isActive}
                    >
                      <span className="mentor-milestone-check">
                        {milestone.completed ? <Icon name="check" size={12} /> : null}
                      </span>
                      <span>{milestone.title}</span>
                    </button>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                <span className="pill">{plan.meeting_frequency || 'Frequency TBD'}</span>
                <span className="pill">{plan.expected_duration || relationship.expected_duration || 'Duration TBD'}</span>
              </div>
              {plan.next_step && <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--ink-2)' }}><b style={{ color: 'var(--blue)' }}>Next:</b> {plan.next_step}</div>}
              {plan.notes && <div className="mute" style={{ marginTop: 6, fontSize: 12 }}>{plan.notes}</div>}
            </>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 14, marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <div className="eyebrow">SESSIONS - {sessions.length}</div>
          </div>

          {sessions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sessions.map((session) => (
                <div key={session.id} className="panel" style={{ padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="h3" style={{ fontSize: 13 }}>{session.topic}</div>
                      <div className="mono mute" style={{ fontSize: 10.5, marginTop: 2 }}>
                        {session.scheduled_at ? new Date(session.scheduled_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Time TBD'}
                      </div>
                    </div>
                    <Pill tone={STATUS_TONE[session.status] || ''} dot>{session.status}</Pill>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    {session.status !== 'CANCELLED' && session.room_name && (
                      <button className="btn sm blue" onClick={() => handleJoinSession(session)}>
                        <Icon name="video" size={12} /> Join call
                      </button>
                    )}
                    {session.status === 'PLANNED' && (
                      <>
                        <button className="btn sm" onClick={() => handleSessionStatus(session.id, 'DONE')}>Mark done</button>
                        <button className="btn sm ghost" onClick={() => handleSessionStatus(session.id, 'CANCELLED')}>Cancel</button>
                      </>
                    )}
                  </div>
                  {session.notes && <div className="mute" style={{ marginTop: 8, fontSize: 12 }}>{session.notes}</div>}
                </div>
              ))}
            </div>
          ) : (
            <p className="mute" style={{ fontSize: 12 }}>No sessions scheduled yet.</p>
          )}

          {isActive && (
            <form onSubmit={handleCreateSession} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              <input value={sessionDraft.topic} onChange={(e) => setSessionDraft((p) => ({ ...p, topic: e.target.value }))} placeholder="Session topic" required />
              <div className="form-row">
                <input type="datetime-local" value={toDatetimeLocal(sessionDraft.scheduled_at)} onChange={(e) => setSessionDraft((p) => ({ ...p, scheduled_at: e.target.value }))} />
                <input value={sessionDraft.notes} onChange={(e) => setSessionDraft((p) => ({ ...p, notes: e.target.value }))} placeholder="Notes" />
              </div>
              <button type="submit" className="btn primary" disabled={sessionSaving} style={{ alignSelf: 'flex-start' }}>
                {sessionSaving ? 'Adding...' : 'Add session'}
              </button>
            </form>
          )}
        </div>

        {!loadingFeedback && existingFeedback && (
          <div className="panel" style={{ padding: 12, marginTop: 14, background: 'var(--bg-2)' }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>{isMentor ? 'YOUR FEEDBACK' : 'MENTOR FEEDBACK'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <StarDisplay rating={existingFeedback.rating} />
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{existingFeedback.rating}/5</span>
            </div>
            {existingFeedback.comment && <div className="serif" style={{ marginTop: 8, fontSize: 13, color: 'var(--ink-2)' }}>{existingFeedback.comment}</div>}
          </div>
        )}

        {actionError && <div className="error-message" style={{ marginTop: 12 }}>{actionError}</div>}

        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 14, flexWrap: 'wrap' }}>
          {isMentor && (
            <button className="btn sm" onClick={() => setShowFeedbackModal(true)}>
              <Icon name="star" size={12} /> {existingFeedback ? 'Edit feedback' : 'Give feedback'}
            </button>
          )}
          {isMentor && isActive && (
            <button className="btn sm" onClick={handleComplete}>Complete</button>
          )}
          <button className="btn sm primary" onClick={handleMessage}>
            <Icon name="msg" size={12} /> Message
          </button>
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
