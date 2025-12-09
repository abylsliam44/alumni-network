import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { connectionsApi } from '../api/connections';
import { messagesApi } from '../api/messages';

const Friends = () => {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await connectionsApi.friends();
        setFriends(data.friends || []);
      } catch (err) {
        setError('Failed to load friends. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const startChat = async (userId) => {
    try {
      const convo = await messagesApi.startConversation(userId);
      navigate(`/messages?chat=${convo.conversation_id}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to start conversation. Make sure you are friends.');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Friends</h1>
        <p className="text-secondary">Your connections and quick actions.</p>
      </div>

      {loading && (
        <Card>
          <p className="text-secondary">Loading friends...</p>
        </Card>
      )}

      {!loading && error && (
        <Card>
          <p className="text-secondary">{error}</p>
        </Card>
      )}

      {!loading && !error && (
        <div className="users-grid">
          {friends.length === 0 ? (
            <Card>
              <p className="text-secondary">You have no friends yet. Send or accept a connection request.</p>
            </Card>
          ) : (
            friends.map((f) => (
              <Card key={f.user.id} className="user-card">
                <div className="user-card-header" />
                <div className="user-card-body">
                  <img
                    src={f.user.photo_url || 'https://api.dicebear.com/7.x/initials/svg?seed=' + f.user.name}
                    alt={f.user.name}
                    className="user-card-avatar"
                  />
                  <h3 className="user-card-name">{f.user.name}</h3>
                  <p className="user-card-headline">{f.user.is_mentor ? 'Mentor' : f.user.role}</p>
                </div>
                <div className="user-card-footer" style={{ display: 'flex', gap: 8 }}>
                  <Button className="btn-primary" onClick={() => startChat(f.user.id)}>
                    Message
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Friends;
