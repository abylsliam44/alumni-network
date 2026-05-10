import { useState } from 'react';
import Button from '../ui/Button';
import { mentorshipApi } from '../../api/mentorship';

const GOAL_OPTIONS = [
  'CV review',
  'Interview prep',
  'Career path',
  'Portfolio',
  'Networking',
  'Research',
];

const SendRequestModal = ({ receiver, onClose, onSuccess }) => {
  const [message, setMessage] = useState('');
  const [goals, setGoals] = useState([]);
  const [expectedDuration, setExpectedDuration] = useState('2-4 weeks');
  const [preferredFormat, setPreferredFormat] = useState('mixed');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isFull = receiver?.mentor_capacity_status === 'FULL';

  const toggleGoal = (goal) => {
    setGoals((prev) =>
      prev.includes(goal) ? prev.filter((item) => item !== goal) : [...prev, goal]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isFull) return;
    setLoading(true);
    setError(null);

    try {
      await mentorshipApi.sendRequest({
        receiver_id: receiver.user_id,
        message,
        goals,
        expected_duration: expectedDuration,
        preferred_format: preferredFormat,
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to send request', err);
      setError(err.response?.data?.detail || 'Failed to send request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content card">
        <div className="modal-header">
          <h3>Request Mentorship</h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p className="mb-4">
              You are requesting mentorship from <strong>{receiver.name}</strong>.
            </p>
            {isFull && (
              <div className="error-message">
                This mentor is currently at full capacity.
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Goals</label>
              <div className="mentor-goal-picker">
                {GOAL_OPTIONS.map((goal) => (
                  <button
                    key={goal}
                    type="button"
                    className={`mentor-goal-chip ${goals.includes(goal) ? 'selected' : ''}`}
                    onClick={() => toggleGoal(goal)}
                  >
                    {goal}
                  </button>
                ))}
              </div>
            </div>

            <div className="mentor-request-grid">
              <div className="form-group">
                <label className="form-label">Expected duration</label>
                <select
                  className="form-input"
                  value={expectedDuration}
                  onChange={(e) => setExpectedDuration(e.target.value)}
                >
                  <option value="1 session">1 session</option>
                  <option value="2-4 weeks">2-4 weeks</option>
                  <option value="1 semester">1 semester</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Preferred format</label>
                <select
                  className="form-input"
                  value={preferredFormat}
                  onChange={(e) => setPreferredFormat(e.target.value)}
                >
                  <option value="chat">Chat</option>
                  <option value="video call">Video call</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Message</label>
              <textarea
                className="form-input"
                rows="4"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Introduce yourself and explain why this mentor is a good fit..."
                required
              />
            </div>

            {error && <div className="error-message">{error}</div>}
          </div>

          <div className="modal-footer flex justify-end gap-2 mt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading || isFull}>
              {loading ? 'Sending...' : 'Send Request'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SendRequestModal;
