import { Link, useNavigate } from 'react-router-dom';
import Button from '../ui/Button';
import { messagesApi } from '../../api/messages';

const apiBase = import.meta.env.VITE_API_URL || '';
const resolveUrl = (path) => (path ? (path.startsWith('http') ? path : `${apiBase}${path}`) : null);

const MentorshipRelationshipCard = ({ relationship, currentUserId }) => {
  const navigate = useNavigate();
  const isMentor = relationship.mentor_id === currentUserId;
  const otherUser = isMentor ? relationship.mentee : relationship.mentor;
  const roleLabel = isMentor ? 'Mentee' : 'Mentor';

  const handleMessage = async () => {
    if (!otherUser?.user_id) return;
    try {
      const convo = await messagesApi.startConversation(otherUser.user_id);
      navigate(`/messages?chat=${convo.conversation_id}`);
    } catch (err) {
      console.error('Failed to start conversation', err);
    }
  };

  return (
    <div className="mentorship-card card">
      <div className="mentorship-card-header flex items-center justify-between">
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
            <p className="text-sm text-secondary m-0">{roleLabel} • {otherUser?.headline || otherUser?.role}</p>
          </div>
        </div>
        <span className="status-badge status-active">Active</span>
      </div>

      <div className="mentorship-card-body mt-4">
        {relationship.goals && (
          <>
            <p className="text-secondary text-sm mb-2 font-medium">Goals:</p>
            <p className="text-secondary text-sm bg-secondary p-3 rounded border">
              {relationship.goals}
            </p>
          </>
        )}
        <p className="text-xs text-secondary mt-2">
          Started on {new Date(relationship.created_at).toLocaleDateString()}
        </p>
      </div>

      <div className="mentorship-card-actions mt-4 flex gap-2 justify-end">
        <Button variant="secondary" size="sm" onClick={handleMessage}>
          Message
        </Button>
      </div>
    </div>
  );
};

export default MentorshipRelationshipCard;

