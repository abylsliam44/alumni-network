import { useState, useEffect } from 'react';
import { mentorshipApi } from '../api/mentorship';
import { useAuth } from '../hooks/useAuth';
import MentorshipRequestCard from '../components/mentorship/MentorshipRequestCard';
import MentorshipRelationshipCard from '../components/mentorship/MentorshipRelationshipCard';
import Button from '../components/ui/Button';
import { Link } from 'react-router-dom';

const Mentorship = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('active');
  const [relationships, setRelationships] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, [user?.id, user?.is_mentor]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [relationshipsData, outgoingData, incomingData] = await Promise.all([
        mentorshipApi.getRelationships(),
        mentorshipApi.getOutgoingRequests(),
        user?.is_mentor ? mentorshipApi.getIncomingRequests() : Promise.resolve([]),
      ]);
      setRelationships(relationshipsData);
      setOutgoingRequests(outgoingData);
      setIncomingRequests(incomingData);
    } catch (err) {
      console.error('Failed to fetch mentorship data', err);
      setError(err.response?.data?.detail || 'Failed to fetch mentorship data');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (requestId) => {
    try {
      await mentorshipApi.acceptRequest(requestId);
      fetchData(); // Refresh list
    } catch (err) {
      console.error('Failed to accept request', err);
      setError(err.response?.data?.detail || 'Failed to accept request');
    }
  };

  const handleDecline = async (requestId) => {
    try {
      await mentorshipApi.declineRequest(requestId);
      fetchData(); // Refresh list
    } catch (err) {
      console.error('Failed to decline request', err);
      setError(err.response?.data?.detail || 'Failed to decline request');
    }
  };

  const handleCancel = async (requestId) => {
    try {
      await mentorshipApi.cancelRequest(requestId);
      fetchData(); // Refresh list
    } catch (err) {
      console.error('Failed to cancel request', err);
      setError(err.response?.data?.detail || 'Failed to cancel request');
    }
  };

  const activeRelationships = relationships.filter((item) => item.status === 'ACTIVE');
  const completedRelationships = relationships.filter((item) => item.status === 'COMPLETED');
  const activeCount = activeRelationships.length;
  const completedCount = completedRelationships.length;

  return (
    <div className="mentorship-container">
      <div className="mentorship-header">
        <h1>Mentorship</h1>
        <p className="text-secondary">Manage your mentorships and requests.</p>
        <div className="mentorship-kpi-row">
          <span>{activeCount} active</span>
          <span>{completedCount} completed</span>
          <span>{incomingRequests.length} incoming</span>
        </div>
        {!user?.is_mentor && (
          <div className="mentorship-cta-wrap">
            <Link to="/directory">
              <Button variant="primary">Find a Mentor</Button>
            </Link>
          </div>
        )}
      </div>

      <div className="mentorship-tabs">
        <button
          className={`tab-button ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          Active Mentorships
        </button>
        <button
          className={`tab-button ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          Completed
        </button>
        {user?.is_mentor && (
          <button
            className={`tab-button ${activeTab === 'incoming' ? 'active' : ''}`}
            onClick={() => setActiveTab('incoming')}
          >
            Incoming Requests
          </button>
        )}
        <button
          className={`tab-button ${activeTab === 'outgoing' ? 'active' : ''}`}
          onClick={() => setActiveTab('outgoing')}
        >
          Outgoing Requests
        </button>
      </div>

      <div className="mentorship-content">
        {error && <div className="error-message mentorship-error">{error}</div>}
        {loading ? (
          <div className="loading-spinner">Loading...</div>
        ) : (
          <>
            {activeTab === 'active' && (
              <div className="mentorship-grid">
                {activeRelationships.length > 0 ? (
                  activeRelationships.map(rel => (
                    <MentorshipRelationshipCard
                      key={rel.id}
                      relationship={rel}
                      currentUserId={user.id}
                      onChanged={fetchData}
                    />
                  ))
                ) : (
                  <p className="mentorship-empty">No active mentorships found.</p>
                )}
              </div>
            )}

            {activeTab === 'completed' && (
              <div className="mentorship-grid">
                {completedRelationships.length > 0 ? (
                  completedRelationships.map(rel => (
                    <MentorshipRelationshipCard
                      key={rel.id}
                      relationship={rel}
                      currentUserId={user.id}
                      onChanged={fetchData}
                    />
                  ))
                ) : (
                  <p className="mentorship-empty">No completed mentorships yet.</p>
                )}
              </div>
            )}

            {activeTab === 'incoming' && (
              <div className="mentorship-grid">
                {incomingRequests.length > 0 ? (
                  incomingRequests.map(req => (
                    <MentorshipRequestCard
                      key={req.id}
                      request={req}
                      type="incoming"
                      onAccept={handleAccept}
                      onDecline={handleDecline}
                    />
                  ))
                ) : (
                  <p className="mentorship-empty">No incoming requests.</p>
                )}
              </div>
            )}

            {activeTab === 'outgoing' && (
              <div className="mentorship-grid">
                {outgoingRequests.length > 0 ? (
                  outgoingRequests.map(req => (
                    <MentorshipRequestCard
                      key={req.id}
                      request={req}
                      type="outgoing"
                      onCancel={handleCancel}
                    />
                  ))
                ) : (
                  <p className="mentorship-empty">No outgoing requests.</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Mentorship;
