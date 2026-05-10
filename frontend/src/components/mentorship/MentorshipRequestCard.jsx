import Button from '../ui/Button';
import { Link } from 'react-router-dom';

const apiBase = import.meta.env.VITE_API_URL || '';
const resolveUrl = (path) => (path ? (path.startsWith('http') ? path : `${apiBase}${path}`) : null);
const fallbackAvatar = 'https://via.placeholder.com/50?text=U';

const MentorshipRequestCard = ({ request, type, onAccept, onDecline, onCancel }) => {
  const otherUser = type === 'incoming' ? request.sender : request.receiver;
  const goals = request.goals || [];

  return (
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
            <p className="mentorship-user-subtitle">{otherUser?.headline || otherUser?.role}</p>
          </div>
        </div>
        <span className={`status-badge status-${request.status.toLowerCase()}`}>
          {request.status}
        </span>
      </div>

      <div className="mentorship-card-body">
        {goals.length > 0 && (
          <div className="mentorship-chip-row">
            {goals.map((goal) => (
              <span key={goal} className="mentorship-chip">{goal}</span>
            ))}
          </div>
        )}
        <div className="mentorship-meta-grid">
          <span>{request.expected_duration || 'Duration TBD'}</span>
          <span>{request.preferred_format || 'Format TBD'}</span>
        </div>
        <p className="mentorship-body-label">Message:</p>
        <p className="mentorship-goals-box">
          {request.message || "No message provided."}
        </p>
        {request.decline_reason && (
          <>
            <p className="mentorship-body-label">Decline reason:</p>
            <p className="mentorship-goals-box">{request.decline_reason}</p>
          </>
        )}
        <p className="mentorship-start-date">
          Sent on {new Date(request.created_at).toLocaleDateString()}
        </p>
      </div>

      {type === 'incoming' && request.status === 'PENDING' && (
        <div className="mentorship-card-actions">
          <Button variant="secondary" size="sm" onClick={() => onDecline(request.id)}>
            Decline
          </Button>
          <Button variant="primary" size="sm" onClick={() => onAccept(request.id)}>
            Accept
          </Button>
        </div>
      )}

      {type === 'outgoing' && request.status === 'PENDING' && onCancel && (
        <div className="mentorship-card-actions">
          <Button variant="secondary" size="sm" onClick={() => onCancel(request.id)}>
            Cancel Request
          </Button>
        </div>
      )}
    </div>
  );
};

export default MentorshipRequestCard;

