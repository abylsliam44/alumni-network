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
  const roleLabelMap = {
    STUDENT: 'Student',
    ALUMNI: 'Alumni',
    STAFF: 'Staff',
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const photoUrl = resolveUrl(user.photo_url);
  const roleLabel = roleLabelMap[user.role] || user.role;
  const primaryHeadline = user.mentor_headline || user.headline || `${roleLabel} community member`;
  const capacityLabel = user.is_mentor && user.mentor_max_mentees
    ? `${user.mentor_active_mentees || 0}/${user.mentor_max_mentees} mentees`
    : null;

  const renderStatus = () => {
    if (isSelf) {
      return <span className="ucard-status ucard-status-self">You</span>;
    }

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
    if (isSelf) {
      return (
        <Link to={`/profile/${user.user_id}`} className="ucard-btn ucard-btn-secondary">
          Open Profile
        </Link>
      );
    }

    if (status === 'friends') {
      return (
        <>
          <span className="ucard-action-note">Already in your network</span>
          <Link to={`/profile/${user.user_id}`} className="ucard-btn ucard-btn-secondary">
            View Profile
          </Link>
        </>
      );
    }

    if (status === 'pending_in') {
      return (
        <>
          <span className="ucard-action-note">This person sent you a connection request</span>
          <div className="ucard-actions-row">
            <button className="ucard-btn ucard-btn-primary" onClick={onAccept}>
              Accept
            </button>
            <button className="ucard-btn ucard-btn-ghost" onClick={onDecline}>
              Decline
            </button>
          </div>
        </>
      );
    }

    if (status === 'pending_out') {
      return (
        <>
          <span className="ucard-action-note">Your request is waiting for a response</span>
          <Link to={`/profile/${user.user_id}`} className="ucard-btn ucard-btn-secondary">
            View Profile
          </Link>
        </>
      );
    }

    return (
      <>
        <span className="ucard-action-note">Reach out or review the full profile first</span>
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
      </>
    );
  };

  return (
    <article
      className="ucard"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="ucard-main">
        <div className="ucard-avatar-wrap">
          {photoUrl ? (
            <img src={photoUrl} alt={user.name} className="ucard-avatar" />
          ) : (
            <div className="ucard-avatar ucard-avatar-placeholder">
              {getInitials(user.name)}
            </div>
          )}
        </div>

        <div className="ucard-content">
          <div className="ucard-topline">
            <div className="ucard-name-block">
              <h3 className="ucard-name">{user.name}</h3>
              <div className="ucard-meta-inline">
                <span className="ucard-role-pill">{roleLabel}</span>
                {user.is_mentor && (
                  <span className="ucard-mentor-badge">Mentor</span>
                )}
                {capacityLabel && (
                  <span className={`ucard-status ${user.mentor_capacity_status === 'FULL' ? 'ucard-status-pending' : 'ucard-status-connected'}`}>
                    {user.mentor_capacity_status === 'FULL' ? 'Full' : capacityLabel}
                  </span>
                )}
                {renderStatus()}
              </div>
            </div>
          </div>

          <p className="ucard-headline">{primaryHeadline}</p>

          <div className="ucard-meta-row">
            {user.location && <span>{user.location}</span>}
            {user.graduation_year && <span>Class of {user.graduation_year}</span>}
            {!user.location && !user.graduation_year && <span>Open to alumni network connections</span>}
          </div>

          {user.skills && user.skills.length > 0 && (
            <div className="ucard-skills">
              {user.skills.slice(0, 5).map((skill, idx) => (
                <span key={idx} className="ucard-skill">{skill}</span>
              ))}
              {user.skills.length > 5 && (
                <span className="ucard-skill ucard-skill-more">
                  +{user.skills.length - 5}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="ucard-side">
        {renderActions()}
      </div>
    </article>
  );
};

export default UserCard;
