import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { mentorshipApi } from '../api/mentorship';
import { useAuth } from '../hooks/useAuth';
import MentorshipRequestCard from '../components/mentorship/MentorshipRequestCard';
import MentorshipRelationshipCard from '../components/mentorship/MentorshipRelationshipCard';
import Avatar from '../components/ui/Avatar';
import Icon from '../components/ui/Icon';
import Pill from '../components/ui/Pill';
import { resolveUrl } from '../utils/image';

const ROLE_LABEL = { STUDENT: 'Student', ALUMNI: 'Alumni', STAFF: 'Staff', HR: 'HR' };

const Mentorship = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('active');
  const [selectedRelId, setSelectedRelId] = useState(null);
  const [relationships, setRelationships] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { fetchData(); /* eslint-disable-line */ }, [user?.id, user?.is_mentor]);

  const activeRel = useMemo(() => relationships.filter((r) => r.status === 'ACTIVE'), [relationships]);
  const completedRel = useMemo(() => relationships.filter((r) => r.status === 'COMPLETED'), [relationships]);
  const currentRelList = activeTab === 'completed' ? completedRel : activeRel;
  const selectedRel = currentRelList.find((rel) => rel.id === selectedRelId) || currentRelList[0] || null;

  useEffect(() => {
    if (activeTab === 'requests') return;
    if (!currentRelList.length) {
      setSelectedRelId(null);
      return;
    }
    if (!currentRelList.some((rel) => rel.id === selectedRelId)) {
      setSelectedRelId(currentRelList[0].id);
    }
  }, [activeTab, currentRelList, selectedRelId]);

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
    try { await mentorshipApi.acceptRequest(id); await fetchData(); setActiveTab('active'); }
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

  const tabs = [
    { k: 'active', label: 'Active', count: activeRel.length },
    { k: 'requests', label: 'Requests', count: incomingRequests.length + outgoingRequests.filter((r) => r.status === 'PENDING').length },
    { k: 'completed', label: 'Completed', count: completedRel.length },
  ];

  const renderEmpty = (type) => (
    <div className="empty-block">
      <Icon name="graph" size={28} />
      <h3>Nothing here yet</h3>
      <p>{type === 'requests' ? 'Send a request or wait for incoming mentor requests.' : 'No mentorship workspace in this state yet.'}</p>
      <Link to="/directory" className="btn sm">Browse mentors</Link>
    </div>
  );

  const renderRelationshipList = () => {
    if (loading) return <div className="loading-block">Loading mentorships...</div>;
    if (!currentRelList.length) return renderEmpty(activeTab);

    return (
      <div className="mentor-workspace-list">
        {currentRelList.map((rel) => {
          const isMentor = rel.mentor_id === user?.id;
          const other = isMentor ? rel.mentee : rel.mentor;
          const milestones = rel.plan?.milestones || [];
          const complete = milestones.filter((m) => typeof m !== 'string' && m.completed).length;
          const progress = milestones.length ? Math.round((complete / milestones.length) * 100) : 0;
          return (
            <button
              key={rel.id}
              type="button"
              className={`mentor-workspace-item${selectedRel?.id === rel.id ? ' active' : ''}`}
              onClick={() => setSelectedRelId(rel.id)}
            >
              <Avatar src={resolveUrl(other?.photo_url)} name={other?.name} size="m" />
              <span>
                <strong>{other?.name || 'Mentorship'}</strong>
                <small>{isMentor ? 'Mentee' : `${ROLE_LABEL[other?.role] || other?.role || 'Mentor'} mentor`} - {progress}%</small>
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  const renderWorkspace = () => {
    if (loading) return null;
    if (!selectedRel) return null;
    return (
      <MentorshipRelationshipCard
        relationship={selectedRel}
        currentUserId={user.id}
        onChanged={fetchData}
      />
    );
  };

  const renderRequests = () => {
    if (loading) return <div className="loading-block">Loading requests...</div>;
    if (!incomingRequests.length && !outgoingRequests.length) return renderEmpty('requests');
    return (
      <div className="mentor-request-grid">
        {user?.is_mentor && (
          <div>
            <div className="eyebrow" style={{ marginBottom: 12 }}>INCOMING</div>
            {incomingRequests.length ? (
              <div className="responsive-card-grid mentorship">
                {incomingRequests.map((r) => (
                  <MentorshipRequestCard key={r.id} request={r} type="incoming" onAccept={handleAccept} onDecline={handleDecline} />
                ))}
              </div>
            ) : renderEmpty('incoming')}
          </div>
        )}
        <div>
          <div className="eyebrow" style={{ marginBottom: 12 }}>OUTGOING</div>
          {outgoingRequests.length ? (
            <div className="responsive-card-grid mentorship">
              {outgoingRequests.map((r) => (
                <MentorshipRequestCard key={r.id} request={r} type="outgoing" onCancel={handleCancel} />
              ))}
            </div>
          ) : renderEmpty('outgoing')}
        </div>
      </div>
    );
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            MENTORSHIP - {activeRel.length} ACTIVE - {incomingRequests.length} INCOMING
          </div>
          <h1 className="h1">
            Your mentorship <i>workspace</i>.
          </h1>
        </div>
        <div className="page-head-actions">
          <Link to="/directory" className="btn"><Icon name="users" size={14} /> Browse mentors</Link>
          {!user?.is_mentor && (
            <Link to="/become-mentor" className="btn primary">Become a mentor <Icon name="arrowR" size={12} /></Link>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <Pill tone="blue" dot>{activeRel.length} active</Pill>
        <Pill tone="warm" dot>{incomingRequests.length} incoming</Pill>
        <Pill>{outgoingRequests.length} outgoing</Pill>
        <Pill tone="ok" dot>{completedRel.length} completed</Pill>
      </div>

      <div className="tabs" style={{ marginBottom: 24 }}>
        {tabs.map((t) => (
          <button key={t.k} className={`tab${activeTab === t.k ? ' active' : ''}`} onClick={() => setActiveTab(t.k)}>
            {t.label} <span className="count">{t.count}</span>
          </button>
        ))}
      </div>

      {error && <div className="error-message">{error}</div>}

      {activeTab === 'requests' ? renderRequests() : (
        <div className="mentor-workspace-shell">
          <aside className="mentor-workspace-sidebar">
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              {activeTab === 'completed' ? 'COMPLETED RELATIONSHIPS' : 'ACTIVE RELATIONSHIPS'}
            </div>
            {renderRelationshipList()}
          </aside>
          <section className="mentor-workspace-detail">
            {renderWorkspace() || renderEmpty(activeTab)}
          </section>
        </div>
      )}
    </div>
  );
};

export default Mentorship;
