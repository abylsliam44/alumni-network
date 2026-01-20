import { Link } from 'react-router-dom';
import { resolveUrl } from '../../utils/image';

const UserCard = ({
  user,
  index = 0,
  status = 'none',
  addLoading = false,
  onAddFriend,
  onAccept,
  onDecline,
  isSelf = false,
}) => {

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderStatus = () => {
    if (isSelf) return null;

    if (status === 'friends') {
      return <span className="ucard-status ucard-status-connected">Connected</span>;
    }
    if (status === 'pending_out') {
      return <span className="ucard-status ucard-status-pending">Request Sent</span>;
    }
    if (status === 'pending_in') {
      return <span className="ucard-status ucard-status-incoming">Incoming Request</span>;
    }
    return null;
  };

  const renderActions = () => {
    if (isSelf) return null;

    if (status === 'friends') {
      return (
        <Link to={`/profile/${user.user_id}`} className="ucard-btn ucard-btn-secondary">
          View Profile
        </Link>
      );
    }

    if (status === 'pending_in') {
      return (
        <div className="ucard-actions-row">
          <button className="ucard-btn ucard-btn-primary" onClick={onAccept}>
            Accept
          </button>
          <button className="ucard-btn ucard-btn-ghost" onClick={onDecline}>
            Decline
          </button>
        </div>
      );
    }

    if (status === 'pending_out') {
      return (
        <Link to={`/profile/${user.user_id}`} className="ucard-btn ucard-btn-secondary">
          View Profile
        </Link>
      );
    }

    return (
      <div className="ucard-actions-row">
        <button
          className="ucard-btn ucard-btn-primary"
          onClick={onAddFriend}
          disabled={addLoading}
        >
          {addLoading ? 'Sending...' : 'Connect'}
        </button>
        <Link to={`/profile/${user.user_id}`} className="ucard-btn ucard-btn-ghost">
          Profile
        </Link>
      </div>
    );
  };

  const photoUrl = resolveUrl(user.photo_url);

  return (
    <article
      className="ucard"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="ucard-header">
        {photoUrl ? (
          <img src={photoUrl} alt={user.name} className="ucard-avatar" />
        ) : (
          <div className="ucard-avatar ucard-avatar-placeholder">
            {getInitials(user.name)}
          </div>
        )}
        {renderStatus()}
      </div>

      <div className="ucard-body">
        <h3 className="ucard-name">{user.name}</h3>
        <p className="ucard-headline">
          {user.mentor_headline || user.headline || user.role}
        </p>

        {user.location && (
          <p className="ucard-location">{user.location}</p>
        )}

        {user.skills && user.skills.length > 0 && (
          <div className="ucard-skills">
            {user.skills.slice(0, 4).map((skill, idx) => (
              <span key={idx} className="ucard-skill">{skill}</span>
            ))}
            {user.skills.length > 4 && (
              <span className="ucard-skill ucard-skill-more">
                +{user.skills.length - 4}
              </span>
            )}
          </div>
        )}

        {user.is_mentor && (
          <div className="ucard-mentor-badge">
            Available for mentorship
          </div>
        )}
      </div>

      <div className="ucard-footer">
        {renderActions()}
      </div>
    </article>
  );
};

export default UserCard;
