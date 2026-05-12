import { useState } from 'react';
import Avatar from '../ui/Avatar';
import Icon from '../ui/Icon';
import { resolveUrl } from '../../utils/image';

const RATING_LABELS = ['', 'Poor', 'Below average', 'Average', 'Good', 'Excellent'];

const MentorFeedbackModal = ({ relationship, onClose, onSubmit, existingFeedback }) => {
  const [rating, setRating] = useState(existingFeedback?.rating || 0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState(existingFeedback?.comment || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const mentee = relationship.mentee;
  const displayRating = hovered || rating;

  const handleSubmit = async () => {
    if (rating === 0) { setError('Please select a rating'); return; }
    setSubmitting(true); setError('');
    try {
      await onSubmit({ rating, comment: comment.trim() || null });
      onClose();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to submit feedback');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>MENTOR FEEDBACK</div>
            <h3>Rate your mentee</h3>
          </div>
          <button className="iconbtn" onClick={onClose}><Icon name="close" size={14} /></button>
        </div>

        <div className="modal-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <Avatar src={resolveUrl(mentee?.photo_url)} name={mentee?.name} size="m" />
            <div>
              <div className="h3">{mentee?.name}</div>
              <div className="mute mono" style={{ fontSize: 10.5, marginTop: 2 }}>{(mentee?.role || '').toUpperCase()}</div>
            </div>
          </div>

          <div className="form-group">
            <label>How would you rate your mentee?</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setRating(star)}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontSize: 28, color: star <= displayRating ? 'var(--warm)' : 'var(--ink-4)',
                    padding: 0, lineHeight: 1,
                  }}
                  aria-label={`Rate ${star}`}
                >
                  ★
                </button>
              ))}
            </div>
            {displayRating > 0 && (
              <div className="help" style={{ marginTop: 6 }}>
                {RATING_LABELS[displayRating]} ({displayRating}/5)
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Comment <span style={{ textTransform: 'none', color: 'var(--ink-3)' }}>(optional)</span></label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Share your thoughts about the mentee's progress and growth…"
            />
            <div className="help">{comment.length}/1000</div>
          </div>

          {error && <div className="error-message">{error}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="btn primary" onClick={handleSubmit} disabled={submitting || rating === 0}>
            {submitting ? 'Submitting…' : existingFeedback ? 'Update feedback' : 'Submit feedback'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MentorFeedbackModal;
