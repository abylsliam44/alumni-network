import { Link } from 'react-router-dom';
import Button from '../ui/Button';

const apiBase = import.meta.env.VITE_API_URL || '';
const resolveUrl = (path) => (path ? (path.startsWith('http') ? path : `${apiBase}${path}`) : null);

const MentorshipRelationshipCard = ({ relationship, currentUserId }) => {
  const isMentor = relationship.mentor_id === currentUserId;
  const otherUser = isMentor ? relationship.mentee : relationship.mentor;
  const roleLabel = isMentor ? 'Mentee' : 'Mentor';

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
            <p className="text-sm text-gray-500 m-0">{roleLabel} • {otherUser?.headline || otherUser?.role}</p>
          </div>
        </div>
        <span className="status-badge status-active">Active</span>
      </div>

      <div className="mentorship-card-body mt-4">
        {relationship.goals && (
          <>
            <p className="text-gray-700 text-sm mb-2 font-medium">Goals:</p>
            <p className="text-gray-600 text-sm bg-gray-50 p-3 rounded border border-gray-100">
              {relationship.goals}
            </p>
          </>
        )}
        <p className="text-xs text-gray-400 mt-2">
          Started on {new Date(relationship.created_at).toLocaleDateString()}
        </p>
      </div>

      <div className="mentorship-card-actions mt-4 flex gap-2 justify-end">
        <Button variant="secondary" size="sm">
          Message
        </Button>
      </div>
    </div>
  );
};

export default MentorshipRelationshipCard;
