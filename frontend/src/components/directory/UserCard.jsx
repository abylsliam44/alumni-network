import { Link } from 'react-router-dom';
import Avatar from '../ui/Avatar';
import Pill from '../ui/Pill';
import { resolveUrl } from '../../utils/image';

const ROLE_LABEL = { STUDENT: 'Student', ALUMNI: 'Alumni', STAFF: 'Staff', HR: 'HR' };

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
  const photoUrl = resolveUrl(user.photo_url);
  const roleLabel = ROLE_LABEL[user.role] || user.role;
  const mentorLabel = `${roleLabel} mentor`;
  const headline = user.mentor_headline || user.headline || `${roleLabel} - Alumni Networking Platform`;
  const capacity = user.is_mentor && user.mentor_max_mentees
    ? `${user.mentor_active_mentees || 0}/${user.mentor_max_mentees}`
    : null;

  const renderActions = () => {
    if (isSelf) {
      return <Link to={`/profile/${user.user_id}`} className="btn sm">Open profile</Link>;
    }
    if (status === 'friends') {
      return (
        <>
          <Link to={`/profile/${user.user_id}`} className="btn sm">View profile</Link>
        </>
      );
    }
    if (status === 'pending_in') {
      return (
        <>
          <button className="btn sm ghost" onClick={onDecline}>Decline</button>
          <button className="btn sm primary" onClick={onAccept}>Accept</button>
        </>
      );
    }
    if (status === 'pending_out') {
      return <Link to={`/profile/${user.user_id}`} className="btn sm">Pending - view profile</Link>;
    }
    return (
      <>
        <Link to={`/profile/${user.user_id}`} className="btn sm">Profile</Link>
        <button className="btn sm primary" onClick={onAddFriend} disabled={addLoading}>
          {addLoading ? 'Sending...' : '+ Connect'}
        </button>
      </>
    );
  };

  return (
    <article className="panel" style={{ padding: 16, animation: `fadein 0.25s ease-out ${index * 30}ms both`, opacity: 1 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14 }}>
        <Avatar src={photoUrl} name={user.name} size="l" />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <h3 className="h3">{user.name}</h3>
            {isSelf && <Pill>You</Pill>}
            {user.is_mentor && (
              user.mentor_capacity_status === 'FULL'
                ? <Pill tone="warm" dot>{mentorLabel} - full</Pill>
                : <Pill tone="blue" dot>{mentorLabel}{capacity ? ` - ${capacity}` : ''}</Pill>
            )}
            {status === 'friends' && <Pill tone="ok" dot>Connected</Pill>}
            {status === 'pending_out' && <Pill>Request sent</Pill>}
            {status === 'pending_in' && <Pill tone="warm" dot>Incoming</Pill>}
          </div>
          <div className="dim" style={{ fontSize: 13, marginBottom: 4 }}>{headline}</div>
          <div className="mute mono" style={{ fontSize: 10.5, marginBottom: 10 }}>
            {[
              user.location,
              user.graduation_year ? `Class of ${user.graduation_year}` : null,
            ].filter(Boolean).join(' - ').toUpperCase() || 'OPEN TO CONNECT'}
          </div>

          {user.skills && user.skills.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
              {user.skills.slice(0, 5).map((s, idx) => (
                <span key={idx} className="chip skill">{s}</span>
              ))}
              {user.skills.length > 5 && (
                <span className="chip skill">+{user.skills.length - 5}</span>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {renderActions()}
          </div>
        </div>
      </div>
    </article>
  );
};

export default UserCard;
