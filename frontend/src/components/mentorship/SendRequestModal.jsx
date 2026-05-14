import { useState } from 'react';
import { mentorshipApi } from '../../api/mentorship';
import Icon from '../ui/Icon';

const GOAL_OPTIONS = [
  'DSA / Competitive Programming',
  'Career Advice',
  'Resume Review',
  'Interview Prep',
  'Technical Roadmap',
  'Project Guidance',
  'Research / Academia',
];

const SendRequestModal = ({ receiver, onClose, onSuccess }) => {
  const [message, setMessage] = useState('');
  const [goals, setGoals] = useState([]);
  const [expectedDuration, setExpectedDuration] = useState('2-4 weeks');
  const [preferredFormat, setPreferredFormat] = useState('mixed');
  const [meetingFrequency, setMeetingFrequency] = useState('weekly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isFull = receiver?.mentor_capacity_status === 'FULL';

  const toggleGoal = (goal) => {
    setGoals((prev) => (prev.includes(goal) ? prev.filter((item) => item !== goal) : [...prev, goal]));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isFull) return;
    setLoading(true); setError(null);
    try {
      await mentorshipApi.sendRequest({
        receiver_id: receiver.user_id,
        message,
        goals,
        expected_duration: expectedDuration,
        preferred_format: preferredFormat,
        meeting_frequency: meetingFrequency,
      });
      onSuccess(); onClose();
    } catch (err) {
      console.error('Failed to send request', err);
      setError(err.response?.data?.detail || 'Failed to send request');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>MENTORSHIP REQUEST</div>
            <h3>Reach out to {receiver?.name}</h3>
          </div>
          <button className="iconbtn" onClick={onClose}><Icon name="close" size={14} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
          <div className="modal-body">
            {isFull && (
              <div className="error-message">This mentor is currently at full capacity.</div>
            )}

            <div className="form-group">
              <label>Goals</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {GOAL_OPTIONS.map((goal) => (
                  <button
                    key={goal}
                    type="button"
                    className={`chip skill ${goals.includes(goal) ? 'blue' : ''}`}
                    onClick={() => toggleGoal(goal)}
                    style={{ cursor: 'pointer', border: '1px solid var(--line)', fontFamily: 'var(--mono)' }}
                  >
                    {goal}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Expected duration</label>
                <select value={expectedDuration} onChange={(e) => setExpectedDuration(e.target.value)}>
                  <option value="1 session">1 session</option>
                  <option value="2-4 weeks">2-4 weeks</option>
                  <option value="1 semester">1 semester</option>
                </select>
              </div>
              <div className="form-group">
                <label>Preferred format</label>
                <select value={preferredFormat} onChange={(e) => setPreferredFormat(e.target.value)}>
                  <option value="chat">Chat</option>
                  <option value="video call">Video call</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Preferred frequency</label>
              <select value={meetingFrequency} onChange={(e) => setMeetingFrequency(e.target.value)}>
                <option value="one-time">One focused session</option>
                <option value="weekly">Weekly check-in</option>
                <option value="biweekly">Every two weeks</option>
                <option value="async">Async, as needed</option>
              </select>
            </div>

            <div className="form-group">
              <label>Short objective</label>
              <textarea
                rows="4"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What do you want to improve, build, or prepare for?"
                required
              />
            </div>

            {error && <div className="error-message">{error}</div>}
          </div>

          <div className="modal-foot">
            <button type="button" className="btn ghost" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn primary" disabled={loading || isFull}>
              {loading ? 'Sending...' : 'Send request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SendRequestModal;
