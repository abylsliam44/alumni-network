import { useState } from 'react';
import Button from '../ui/Button';

const MentorFeedbackModal = ({ relationship, onClose, onSubmit, existingFeedback }) => {
  const [rating, setRating] = useState(existingFeedback?.rating || 0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState(existingFeedback?.comment || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const mentee = relationship.mentee;

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onSubmit({ rating, comment: comment.trim() || null });
      onClose();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const displayRating = hovered || rating;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content feedback-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Rate Your Mentee</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="feedback-mentee-info">
            <img
              src={mentee?.photo_url || 'https://via.placeholder.com/48'}
              alt={mentee?.name}
              className="feedback-avatar"
            />
            <div>
              <p className="feedback-mentee-name">{mentee?.name}</p>
              <p className="feedback-mentee-role">{mentee?.role}</p>
            </div>
          </div>

          <div className="feedback-stars-section">
            <p className="feedback-label">How would you rate your mentee?</p>
            <div className="stars-container">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  className={`star-btn ${star <= displayRating ? 'star-filled' : 'star-empty'}`}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  type="button"
                  aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                >
                  ★
                </button>
              ))}
            </div>
            {displayRating > 0 && (
              <p className="rating-label">
                {['', 'Poor', 'Below Average', 'Average', 'Good', 'Excellent'][displayRating]}
                {' '}({displayRating}/5)
              </p>
            )}
          </div>

          <div className="feedback-comment-section">
            <label className="feedback-label" htmlFor="feedback-comment">
              Comment <span className="optional-label">(optional)</span>
            </label>
            <textarea
              id="feedback-comment"
              className="feedback-textarea"
              placeholder="Share your thoughts about the mentee's progress, attitude, and achievements..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={1000}
            />
            <p className="char-count">{comment.length}/1000</p>
          </div>

          {error && <p className="feedback-error">{error}</p>}
        </div>

        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting || rating === 0}>
            {submitting ? 'Submitting...' : existingFeedback ? 'Update Feedback' : 'Submit Feedback'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MentorFeedbackModal;
