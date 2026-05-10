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

const MentorshipRelationshipCard = ({ relationship, currentUserId }) => {
  const navigate = useNavigate();
  const isMentor = relationship.mentor_id === currentUserId;
  const otherUser = isMentor ? relationship.mentee : relationship.mentor;
  const roleLabel = isMentor ? 'Mentee' : 'Mentor';

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [existingFeedback, setExistingFeedback] = useState(null);
  const [loadingFeedback, setLoadingFeedback] = useState(true);

  useEffect(() => {
    loadFeedback();
  }, [relationship.id]);

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
          <span className="status-badge status-active">Active</span>
        </div>

        <div className="mentorship-card-body">
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
