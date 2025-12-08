import Button from '../ui/Button';
import { Link } from 'react-router-dom';

const MentorshipRequestCard = ({ request, type, onAccept, onDecline }) => {
  const otherUser = type === 'incoming' ? request.sender : request.receiver;

  return (
    <div className="mentorship-card card">
      <div className="mentorship-card-header">
        <div className="flex items-center gap-3">
          <img
            src={otherUser?.photo_url ? `http://localhost:8000${otherUser.photo_url}` : 'https://via.placeholder.com/50'}
            alt={otherUser?.name}
            className="w-12 h-12 rounded-full object-cover"
          />
          <div>
            <h4 className="font-semibold text-lg m-0">
              <Link to={`/profile/${otherUser?.user_id}`} className="hover:underline text-inherit">
                {otherUser?.name}
              </Link>
            </h4>
            <p className="text-sm text-gray-500 m-0">{otherUser?.headline || otherUser?.role}</p>
          </div>
        </div>
        <span className={`status-badge status-${request.status.toLowerCase()}`}>
          {request.status}
        </span>
      </div>

      <div className="mentorship-card-body mt-4">
        <p className="text-gray-700 text-sm mb-2 font-medium">Message:</p>
        <p className="text-gray-600 text-sm bg-gray-50 p-3 rounded border border-gray-100">
          {request.message || "No message provided."}
        </p>
        <p className="text-xs text-gray-400 mt-2">
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
    </div>
  );
};

export default MentorshipRequestCard;
