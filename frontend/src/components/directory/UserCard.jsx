import { Link } from 'react-router-dom';
import Button from '../ui/Button';

const UserCard = ({ user }) => {
  return (
    <div className="user-card">
      <div className="user-card-header">
        <img
          src={user.photo_url ? `http://localhost:8000${user.photo_url}` : 'https://via.placeholder.com/150'}
          alt={user.name}
          className="user-card-avatar"
        />
      </div>
      <div className="user-card-body">
        <h3 className="user-card-name">{user.name}</h3>
        <p className="user-card-headline">{user.headline || user.role}</p>
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
      </div>
    </div>
  );
};

export default UserCard;
