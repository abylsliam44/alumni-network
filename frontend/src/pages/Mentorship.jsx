import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { mentorshipApi } from '../api/mentorship';
import { useAuth } from '../hooks/useAuth';
import MentorshipRequestCard from '../components/mentorship/MentorshipRequestCard';
import MentorshipRelationshipCard from '../components/mentorship/MentorshipRelationshipCard';
import Icon from '../components/ui/Icon';
import Pill from '../components/ui/Pill';

const Mentorship = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('active');
  const [relationships, setRelationships] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { fetchData(); /* eslint-disable-line */ }, [user?.id, user?.is_mentor]);

  const fetchData = async () => {
    setLoading(true); setError(null);
    try {
      const [rel, out, incoming] = await Promise.all([
        mentorshipApi.getRelationships(),
        mentorshipApi.getOutgoingRequests(),
        user?.is_mentor ? mentorshipApi.getIncomingRequests() : Promise.resolve([]),
      ]);
      setRelationships(rel);
      setOutgoingRequests(out);
      setIncomingRequests(incoming);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch mentorship data');
    } finally { setLoading(false); }
  };

  const handleAccept = async (id) => {
    try { await mentorshipApi.acceptRequest(id); fetchData(); }
    catch (err) { setError(err.response?.data?.detail || 'Failed to accept request'); }
  };
  const handleDecline = async (id) => {
    try { await mentorshipApi.declineRequest(id); fetchData(); }
    catch (err) { setError(err.response?.data?.detail || 'Failed to decline request'); }
  };
  const handleCancel = async (id) => {
    try { await mentorshipApi.cancelRequest(id); fetchData(); }
    catch (err) { setError(err.response?.data?.detail || 'Failed to cancel request'); }
  };

  const activeRel = relationships.filter((r) => r.status === 'ACTIVE');
  const completedRel = relationships.filter((r) => r.status === 'COMPLETED');

  const tabs = [
    { k: 'active', label: 'Active', count: activeRel.length },
    { k: 'completed', label: 'Completed', count: completedRel.length },
    ...(user?.is_mentor ? [{ k: 'incoming', label: 'Incoming', count: incomingRequests.length }] : []),
    { k: 'outgoing', label: 'Outgoing', count: outgoingRequests.length },
  ];

  const renderList = (items, type) => {
    if (loading) return <div className="loading-block">Loading…</div>;
    if (items.length === 0) {
      return (
        <div className="empty-block">
          <Icon name="graph" size={28} />
          <h3>Nothing here yet</h3>
          <p>{type === 'incoming' ? 'When students request mentorship, they show up here.' : type === 'outgoing' ? 'Send a mentorship request to a mentor in the directory.' : 'You have no mentorships in this state.'}</p>
          {type !== 'incoming' && <Link to="/directory" className="btn sm">Find a mentor</Link>}
        </div>
      );
    }
    return (
      <div className="responsive-card-grid mentorship">
        {items}
      </div>
    );
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            MENTORSHIP · {activeRel.length} ACTIVE · {incomingRequests.length} INCOMING
          </div>
          <h1 className="h1">
            Manage your <i>mentorships</i><br />and <i>requests</i>.
          </h1>
        </div>
        <div className="page-head-actions">
          <Link to="/directory" className="btn"><Icon name="users" size={14} /> Browse mentors</Link>
          {user?.role === 'ALUMNI' && !user?.is_mentor && (
            <Link to="/become-mentor" className="btn primary">Become a mentor <Icon name="arrowR" size={12} /></Link>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <Pill tone="blue" dot>{activeRel.length} active</Pill>
        <Pill tone="ok" dot>{completedRel.length} completed</Pill>
        <Pill tone="warm" dot>{incomingRequests.length} incoming</Pill>
        <Pill>{outgoingRequests.length} outgoing</Pill>
      </div>

      <div className="tabs" style={{ marginBottom: 24 }}>
        {tabs.map((t) => (
          <button key={t.k} className={`tab${activeTab === t.k ? ' active' : ''}`} onClick={() => setActiveTab(t.k)}>
            {t.label} <span className="count">{t.count}</span>
          </button>
        ))}
      </div>

      {error && <div className="error-message">{error}</div>}

      {activeTab === 'active' && renderList(
        activeRel.map((rel) => (
          <MentorshipRelationshipCard key={rel.id} relationship={rel} currentUserId={user.id} onChanged={fetchData} />
        )),
        'active',
      )}
      {activeTab === 'completed' && renderList(
        completedRel.map((rel) => (
          <MentorshipRelationshipCard key={rel.id} relationship={rel} currentUserId={user.id} onChanged={fetchData} />
        )),
        'completed',
      )}
      {activeTab === 'incoming' && renderList(
        incomingRequests.map((r) => (
          <MentorshipRequestCard key={r.id} request={r} type="incoming" onAccept={handleAccept} onDecline={handleDecline} />
        )),
        'incoming',
      )}
      {activeTab === 'outgoing' && renderList(
        outgoingRequests.map((r) => (
          <MentorshipRequestCard key={r.id} request={r} type="outgoing" onCancel={handleCancel} />
        )),
        'outgoing',
      )}
    </div>
  );
};

export default Mentorship;
