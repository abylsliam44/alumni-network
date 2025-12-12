import Button from '../ui/Button';
import { Link } from 'react-router-dom';

const apiBase = import.meta.env.VITE_API_URL || '';
const resolveUrl = (path) => (path ? (path.startsWith('http') ? path : `${apiBase}${path}`) : null);

const MentorshipRequestCard = ({ request, type, onAccept, onDecline, onCancel }) => {
  const otherUser = type === 'incoming' ? request.sender : request.receiver;

  return (
    <div className="mentorship-card card">
      <div className="mentorship-card-header">
        <div className="flex items-center gap-3">
          <img
            src={resolveUrl(otherUser?.photo_url) || 'https://via.placeholder.com/50'}
            alt={otherUser?.name}
            className="w-12 h-12 rounded-full object-cover"
          />
          <div>
            <h4 className="font-semibold text-lg m-0">
              <Link to={`/profile/${otherUser?.user_id}`} className="hover:underline text-inherit">
                {otherUser?.name}
              </Link>
            </h4>
            <p className="text-sm text-secondary m-0">{otherUser?.headline || otherUser?.role}</p>
          </div>
        </div>
        <span className={`status-badge status-${request.status.toLowerCase()}`}>
          {request.status}
        </span>
      </div>

      <div className="mentorship-card-body mt-4">
        <p className="text-secondary text-sm mb-2 font-medium">Message:</p>
        <p className="text-secondary text-sm bg-secondary p-3 rounded border">
          {request.message || "No message provided."}
        </p>
        <p className="text-xs text-secondary mt-2">
          Sent on {new Date(request.created_at).toLocaleDateString()}
        </p>
      </div>

      {type === 'incoming' && request.status === 'PENDING' && (
        <div className="mentorship-card-actions mt-4 flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={() => onDecline(request.id)}>
            Decline
          </Button>
          <Button variant="primary" size="sm" onClick={() => onAccept(request.id)}>
            Accept
          </Button>
        </div>
      )}

      {type === 'outgoing' && request.status === 'PENDING' && onCancel && (
        <div className="mentorship-card-actions mt-4 flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={() => onCancel(request.id)}>
            Cancel Request
          </Button>
        </div>
      )}
    </div>
  );
};

export default MentorshipRequestCard;

