import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Avatar from '../components/ui/Avatar';
import { connectionsApi } from '../api/connections';
import { messagesApi } from '../api/messages';
import { useAuth } from '../hooks/useAuth';

const Friends = () => {
  const { user: currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [friends, setFriends] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('mentors');
  const [activeTab, setActiveTab] = useState('friends');
  const [responding, setResponding] = useState({});
  const navigate = useNavigate();
  const apiBase = import.meta.env.VITE_API_URL || '';

  const resolveUrl = (path) => {
    if (!path) return null;
    return path.startsWith('http') ? path : `${apiBase}${path}`;
  };

  // Check URL params for tab
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'requests') {
      setActiveTab('requests');
    }
  }, [searchParams]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [friendsData, connectionsData] = await Promise.all([
        connectionsApi.friends(),
        connectionsApi.list()
      ]);
      setFriends(friendsData.friends || []);
      setConnections(connectionsData || []);
    } catch (err) {
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Filter incoming pending requests
  const incomingRequests = useMemo(() => {
    if (!currentUser) return [];
    return connections.filter(
      conn => conn.status === 'PENDING' && conn.recipient_id === currentUser.id
    );
  }, [connections, currentUser]);

  // Filter outgoing pending requests
  const outgoingRequests = useMemo(() => {
    if (!currentUser) return [];
    return connections.filter(
      conn => conn.status === 'PENDING' && conn.requester_id === currentUser.id
    );
  }, [connections, currentUser]);

  const handleAccept = async (connectionId) => {
    setResponding(prev => ({ ...prev, [connectionId]: 'accepting' }));
    try {
      await connectionsApi.respond(connectionId, 'ACCEPTED');
      await loadData();
    } catch (err) {
      setError('Failed to accept request');
    } finally {
      setResponding(prev => {
        const copy = { ...prev };
        delete copy[connectionId];
        return copy;
      });
    }
  };

  const handleDecline = async (connectionId) => {
    setResponding(prev => ({ ...prev, [connectionId]: 'declining' }));
    try {
      await connectionsApi.respond(connectionId, 'DECLINED');
      await loadData();
    } catch (err) {
      setError('Failed to decline request');
    } finally {
      setResponding(prev => {
        const copy = { ...prev };
        delete copy[connectionId];
        return copy;
      });
    }
  };

  const startChat = async (userId) => {
    try {
      const convo = await messagesApi.startConversation(userId);
      navigate(`/messages?chat=${convo.conversation_id}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to start conversation. Make sure you are friends.');
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = friends.filter((f) => f.user.name.toLowerCase().includes(term));

    switch (sort) {
      case 'az':
        list = [...list].sort((a, b) => a.user.name.localeCompare(b.user.name));
        break;
      case 'za':
        list = [...list].sort((a, b) => b.user.name.localeCompare(a.user.name));
        break;
      case 'mentors':
      default:
        list = [...list].sort((a, b) => Number(b.user.is_mentor) - Number(a.user.is_mentor) || a.user.name.localeCompare(b.user.name));
        break;
    }
    return list;
  }, [friends, search, sort]);

  const totalMentors = useMemo(() => friends.filter((f) => f.user.is_mentor).length, [friends]);

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="friends-page">
      <header className="friends-header">
        <div className="friends-title-block">
          <h1>Friends</h1>
          <p>Manage your connections and friend requests</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="friends-tabs">
        <button
          className={`friends-tab ${activeTab === 'friends' ? 'active' : ''}`}
          onClick={() => setActiveTab('friends')}
        >
          Friends
          <span className="friends-tab-count">{friends.length}</span>
        </button>
        <button
          className={`friends-tab ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          Requests
          {incomingRequests.length > 0 && (
            <span className="friends-tab-count friends-tab-count-new">{incomingRequests.length}</span>
          )}
        </button>
        <button
          className={`friends-tab ${activeTab === 'sent' ? 'active' : ''}`}
          onClick={() => setActiveTab('sent')}
        >
          Sent
          <span className="friends-tab-count">{outgoingRequests.length}</span>
        </button>
      </div>

      {loading && (
        <div className="friends-loading">
          <div className="friends-loading-bar"></div>
          <span>Loading...</span>
        </div>
      )}

      {!loading && error && (
        <div className="friends-error">
          <p>{error}</p>
          <button onClick={loadData}>Try again</button>
        </div>
      )}

      {!loading && !error && activeTab === 'friends' && (
        <>
          {/* Search and Filter */}
          <div className="friends-controls">
            <input
              type="text"
              placeholder="Search friends..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="friends-search"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="friends-sort"
            >
              <option value="mentors">Mentors first</option>
              <option value="az">Name A → Z</option>
              <option value="za">Name Z → A</option>
            </select>
            <span className="friends-stats">
              {friends.length} friends · {totalMentors} mentors
            </span>
          </div>

          {/* Friends List */}
          <div className="friends-list">
            {filtered.length === 0 ? (
              <div className="friends-empty">
                <p>No friends found</p>
                <span>Connect with people in the Directory</span>
              </div>
            ) : (
              filtered.map((f, idx) => (
                <div key={f.user.id} className="friends-item" style={{ animationDelay: `${idx * 30}ms` }}>
                  <div className="friends-item-avatar">
                    {f.user.photo_url ? (
                      <img src={resolveUrl(f.user.photo_url)} alt={f.user.name} />
                    ) : (
                      <div className="friends-avatar-placeholder">{getInitials(f.user.name)}</div>
                    )}
                  </div>
                  <div className="friends-item-info">
                    <div className="friends-item-name">
                      {f.user.name}
                      {f.user.is_mentor && <span className="friends-mentor-badge">Mentor</span>}
                    </div>
                    <span className="friends-item-role">{f.user.role}</span>
                  </div>
                  <div className="friends-item-actions">
                    <button className="friends-btn friends-btn-primary" onClick={() => startChat(f.user.id)}>
                      Message
                    </button>
                    <button className="friends-btn friends-btn-secondary" onClick={() => navigate(`/profile/${f.user.id}`)}>
                      Profile
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {!loading && !error && activeTab === 'requests' && (
        <div className="friends-requests">
          {incomingRequests.length === 0 ? (
            <div className="friends-empty">
              <p>No pending requests</p>
              <span>When someone sends you a friend request, it will appear here</span>
            </div>
          ) : (
            incomingRequests.map((conn, idx) => (
              <div key={conn.id} className="friends-request-item" style={{ animationDelay: `${idx * 30}ms` }}>
                <div className="friends-item-avatar">
                  {conn.requester?.photo_url ? (
                    <img src={resolveUrl(conn.requester.photo_url)} alt={conn.requester.name} />
                  ) : (
                    <div className="friends-avatar-placeholder">{getInitials(conn.requester?.name)}</div>
                  )}
                </div>
                <div className="friends-item-info">
                  <div className="friends-item-name">{conn.requester?.name || 'Unknown User'}</div>
                  <span className="friends-item-role">{conn.requester?.role}</span>
                  <span className="friends-request-time">
                    {new Date(conn.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="friends-item-actions">
                  <button
                    className="friends-btn friends-btn-accept"
                    onClick={() => handleAccept(conn.id)}
                    disabled={responding[conn.id]}
                  >
                    {responding[conn.id] === 'accepting' ? 'Accepting...' : 'Accept'}
                  </button>
                  <button
                    className="friends-btn friends-btn-decline"
                    onClick={() => handleDecline(conn.id)}
                    disabled={responding[conn.id]}
                  >
                    {responding[conn.id] === 'declining' ? 'Declining...' : 'Decline'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {!loading && !error && activeTab === 'sent' && (
        <div className="friends-requests">
          {outgoingRequests.length === 0 ? (
            <div className="friends-empty">
              <p>No sent requests</p>
              <span>Friend requests you've sent will appear here</span>
            </div>
          ) : (
            outgoingRequests.map((conn, idx) => (
              <div key={conn.id} className="friends-request-item friends-request-sent" style={{ animationDelay: `${idx * 30}ms` }}>
                <div className="friends-item-avatar">
                  {conn.recipient?.photo_url ? (
                    <img src={resolveUrl(conn.recipient.photo_url)} alt={conn.recipient.name} />
                  ) : (
                    <div className="friends-avatar-placeholder">{getInitials(conn.recipient?.name)}</div>
                  )}
                </div>
                <div className="friends-item-info">
                  <div className="friends-item-name">{conn.recipient?.name || 'Unknown User'}</div>
                  <span className="friends-item-role">{conn.recipient?.role}</span>
                  <span className="friends-request-time">
                    Sent {new Date(conn.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="friends-item-actions">
                  <span className="friends-pending-badge">Pending</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Friends;
