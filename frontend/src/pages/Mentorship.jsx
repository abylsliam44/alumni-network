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

  useEffect(() => {
    fetchData();
  }, [activeTab, user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'active') {
        const data = await mentorshipApi.getRelationships();
        setRelationships(data);
      } else if (activeTab === 'incoming') {
        if (!user?.is_mentor) {
          setIncomingRequests([]);
          return;
        }
        const data = await mentorshipApi.getIncomingRequests();
        setIncomingRequests(data);
      } else if (activeTab === 'outgoing') {
        const data = await mentorshipApi.getOutgoingRequests();
        setOutgoingRequests(data);
      }
    } catch (err) {
      console.error('Failed to fetch mentorship data', err);
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
    }
  };

  const handleDecline = async (requestId) => {
    try {
      await mentorshipApi.declineRequest(requestId);
      fetchData(); // Refresh list
    } catch (err) {
      console.error('Failed to decline request', err);
    }
  };

  const handleCancel = async (requestId) => {
    try {
      await mentorshipApi.cancelRequest(requestId);
      fetchData(); // Refresh list
    } catch (err) {
      console.error('Failed to cancel request', err);
    }
  };

  return (
    <div className="mentorship-container">
      <div className="mentorship-header">
        <h1>Mentorship</h1>
        <p className="text-secondary">Manage your mentorships and requests.</p>
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
        {loading ? (
          <div className="loading-spinner">Loading...</div>
        ) : (
          <>
            {activeTab === 'active' && (
              <div className="mentorship-grid">
                {relationships.length > 0 ? (
                  relationships.map(rel => (
                    <MentorshipRelationshipCard
                      key={rel.id}
                      relationship={rel}
                      currentUserId={user.id}
                    />
                  ))
                ) : (
                  <p className="mentorship-empty">No active mentorships found.</p>
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
