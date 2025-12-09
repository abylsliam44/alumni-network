import { Link } from 'react-router-dom';
import Button from '../ui/Button';
import Avatar from '../ui/Avatar';

const UserCard = ({
  user,
  status = 'none',
  addLoading = false,
  onAddFriend,
  onAccept,
  onDecline,
  isSelf = false,
}) => {
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  
  const resolveUrl = (path) => {
    if (!path) return null;
    return path.startsWith('http') ? path : `${apiBase}${path}`;
  };

  const renderActions = () => {
    if (isSelf) return null;
    if (status === 'friends') {
      return <span className="badge badge-primary w-full text-center">Friends</span>;
    }
    if (status === 'pending_in') {
      return (
        <div className="flex gap-2 w-full">
          <Button variant="primary" className="w-full" onClick={onAccept}>Accept</Button>
          <Button variant="secondary" className="w-full" onClick={onDecline}>Decline</Button>
        </div>
      );
    }
    if (status === 'pending_out') {
      return <Button variant="secondary" className="w-full" disabled>Pending</Button>;
    }
    return (
      <Button variant="primary" className="w-full" onClick={onAddFriend} disabled={addLoading}>
        {addLoading ? 'Sending...' : 'Add friend'}
      </Button>
    );
  };

  return (
    <div className="user-card">
      <div className="user-card-header">
        <Avatar
          src={resolveUrl(user.photo_url)}
          alt={user.name}
          size="lg"
          className="user-card-avatar"
        />
        {user.is_mentor && (
          <span className="badge badge-primary">Mentor</span> 
        )}
      </div>
      <div className="user-card-body">
        <h3 className="user-card-name">{user.name}</h3>
        <p className="user-card-headline">{user.mentor_headline || user.headline || user.role}</p>
        <p className="user-card-location">{user.location || 'Location not set'}</p>

        <div className="user-card-skills">
          {user.skills && user.skills.slice(0, 3).map((skill, index) => (
            <span key={index} className="skill-tag-sm">{skill}</span>
          ))}
          {user.skills && user.skills.length > 3 && (
            <span className="skill-tag-sm">+{user.skills.length - 3}</span>
          )}
        </div>
      </div>
      <div className="user-card-footer">
        <Link to={`/profile/${user.user_id}`} className="w-full">
          <Button variant="secondary" className="w-full">View Profile</Button>
        </Link>
        {renderActions()}
      </div>
    </div>
  );
};

export default UserCard;
