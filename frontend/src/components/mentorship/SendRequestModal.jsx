import { useState } from 'react';
import Button from '../ui/Button';
import { mentorshipApi } from '../../api/mentorship';

const SendRequestModal = ({ receiver, onClose, onSuccess }) => {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await mentorshipApi.sendRequest({
        receiver_id: receiver.user_id,
        message: message
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

            <div className="form-group">
              <label className="form-label">Message / Goals</label>
              <textarea
                className="form-input"
                rows="4"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Introduce yourself and share your mentorship goals..."
                required
              />
            </div>

            {error && <div className="error-message">{error}</div>}
          </div>

          <div className="modal-footer flex justify-end gap-2 mt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Sending...' : 'Send Request'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SendRequestModal;
