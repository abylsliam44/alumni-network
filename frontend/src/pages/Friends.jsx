import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { connectionsApi } from '../api/connections';
import { messagesApi } from '../api/messages';
import { useAuth } from '../hooks/useAuth';
import Avatar from '../components/ui/Avatar';
import Pill from '../components/ui/Pill';
import Icon from '../components/ui/Icon';
import { resolveUrl } from '../utils/image';

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

  useEffect(() => {
    if (searchParams.get('tab') === 'requests') setActiveTab('requests');
  }, [searchParams]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true); setError(null);
    try {
      const [f, c] = await Promise.all([connectionsApi.friends(), connectionsApi.list()]);
      setFriends(f.friends || []);
      setConnections(c || []);
    } catch (err) {
      setError('Failed to load data. Please try again.');
    } finally { setLoading(false); }
  };

  const incomingRequests = useMemo(() => {
    if (!currentUser) return [];
    return connections.filter((c) => c.status === 'PENDING' && c.recipient_id === currentUser.id);
  }, [connections, currentUser]);

  const outgoingRequests = useMemo(() => {
    if (!currentUser) return [];
    return connections.filter((c) => c.status === 'PENDING' && c.requester_id === currentUser.id);
  }, [connections, currentUser]);

  const handleAccept = async (id) => {
    setResponding((p) => ({ ...p, [id]: 'a' }));
    try { await connectionsApi.respond(id, 'ACCEPTED'); await loadData(); }
    catch { setError('Failed to accept request'); }
    finally { setResponding((p) => { const x = { ...p }; delete x[id]; return x; }); }
  };

  const handleDecline = async (id) => {
    setResponding((p) => ({ ...p, [id]: 'd' }));
    try { await connectionsApi.respond(id, 'DECLINED'); await loadData(); }
    catch { setError('Failed to decline request'); }
    finally { setResponding((p) => { const x = { ...p }; delete x[id]; return x; }); }
  };

  const startChat = async (userId) => {
    try {
      const convo = await messagesApi.startConversation(userId);
      navigate(`/messages?chat=${convo.conversation_id}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to start conversation. Make sure you are connected.');
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = friends.filter((f) => f.user.name.toLowerCase().includes(term));
    switch (sort) {
      case 'az': list = [...list].sort((a, b) => a.user.name.localeCompare(b.user.name)); break;
      case 'za': list = [...list].sort((a, b) => b.user.name.localeCompare(a.user.name)); break;
      default:
        list = [...list].sort((a, b) =>
          Number(b.user.is_mentor) - Number(a.user.is_mentor) || a.user.name.localeCompare(b.user.name),
        );
    }
    return list;
  }, [friends, search, sort]);

  const totalMentors = useMemo(() => friends.filter((f) => f.user.is_mentor).length, [friends]);

  const tabs = [
    { k: 'friends', label: 'Connections', count: friends.length },
    { k: 'requests', label: 'Incoming', count: incomingRequests.length },
    { k: 'sent', label: 'Sent', count: outgoingRequests.length },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            CONNECTIONS · {friends.length} TOTAL · {totalMentors} MENTORS
          </div>
          <h1 className="h1">Your <i>network</i>.</h1>
        </div>
        <div className="page-head-actions">
          <button className="btn" onClick={() => navigate('/directory')}><Icon name="users" size={14} /> Find more</button>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 24 }}>
        {tabs.map((t) => (
          <button key={t.k} className={`tab${activeTab === t.k ? ' active' : ''}`} onClick={() => setActiveTab(t.k)}>
            {t.label} <span className="count">{t.count}</span>
          </button>
        ))}
      </div>

      {error && <div className="error-message">{error}</div>}
      {loading && <div className="loading-block">Loading…</div>}

      {!loading && activeTab === 'friends' && (
        <>
          <div className="mobile-filter-row" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <input
              type="search"
              placeholder="Search connections…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: '0 1 320px' }}
            />
            <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ flex: '0 0 200px' }}>
              <option value="mentors">Mentors first</option>
              <option value="az">Name A → Z</option>
              <option value="za">Name Z → A</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="empty-block">
              <Icon name="users" size={28} />
              <h3>No connections yet</h3>
              <p>Browse the directory and send connection requests.</p>
              <button className="btn sm" onClick={() => navigate('/directory')}>Browse directory</button>
            </div>
          ) : (
            <div className="dir-grid">
              {filtered.map((f) => (
                <div key={f.user.id} className="panel mobile-row-grid" style={{ padding: 16, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 14, alignItems: 'center' }}>
                  <Avatar src={resolveUrl(f.user.photo_url)} name={f.user.name} size="m" />
                  <div style={{ minWidth: 0 }}>
                    <div className="h3" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {f.user.name}
                      {f.user.is_mentor && <Pill tone="blue" dot>Mentor</Pill>}
                    </div>
                    <div className="mute mono" style={{ fontSize: 10.5, marginTop: 2 }}>{(f.user.role || '').toUpperCase()}</div>
                  </div>
                  <div className="mobile-row-actions" style={{ display: 'flex', gap: 6 }}>
                    <button className="btn sm" onClick={() => navigate(`/profile/${f.user.id}`)}>Profile</button>
                    <button className="btn sm primary" onClick={() => startChat(f.user.id)}><Icon name="msg" size={12} /> Message</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!loading && activeTab === 'requests' && (
        <>
          {incomingRequests.length === 0 ? (
            <div className="empty-block">
              <Icon name="bell" size={28} />
              <h3>No pending requests</h3>
              <p>When someone sends you a connection request, it will appear here.</p>
            </div>
          ) : (
            <div className="dir-grid">
              {incomingRequests.map((conn) => (
                <div key={conn.id} className="panel mobile-row-grid" style={{ padding: 16, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 14, alignItems: 'center' }}>
                  <Avatar src={resolveUrl(conn.requester?.photo_url)} name={conn.requester?.name} size="m" />
                  <div style={{ minWidth: 0 }}>
                    <div className="h3">{conn.requester?.name || 'Unknown'}</div>
                    <div className="mute mono" style={{ fontSize: 10.5, marginTop: 2 }}>
                      {(conn.requester?.role || '').toUpperCase()} · {new Date(conn.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="mobile-row-actions" style={{ display: 'flex', gap: 6 }}>
                    <button className="btn sm ghost" onClick={() => handleDecline(conn.id)} disabled={responding[conn.id]}>
                      {responding[conn.id] === 'd' ? 'Declining…' : 'Decline'}
                    </button>
                    <button className="btn sm primary" onClick={() => handleAccept(conn.id)} disabled={responding[conn.id]}>
                      {responding[conn.id] === 'a' ? 'Accepting…' : 'Accept'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!loading && activeTab === 'sent' && (
        <>
          {outgoingRequests.length === 0 ? (
            <div className="empty-block">
              <Icon name="send" size={28} />
              <h3>No sent requests</h3>
              <p>Connection requests you've sent will appear here.</p>
            </div>
          ) : (
            <div className="dir-grid">
              {outgoingRequests.map((conn) => (
                <div key={conn.id} className="panel mobile-row-grid" style={{ padding: 16, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 14, alignItems: 'center' }}>
                  <Avatar src={resolveUrl(conn.recipient?.photo_url)} name={conn.recipient?.name} size="m" />
                  <div style={{ minWidth: 0 }}>
                    <div className="h3">{conn.recipient?.name || 'Unknown'}</div>
                    <div className="mute mono" style={{ fontSize: 10.5, marginTop: 2 }}>
                      {(conn.recipient?.role || '').toUpperCase()} · sent {new Date(conn.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Pill>Pending</Pill>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Friends;
