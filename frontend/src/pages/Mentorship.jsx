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
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'active') {
        const data = await mentorshipApi.getRelationships();
        setRelationships(data);
      } else if (activeTab === 'incoming') {
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

  return (
    <div className="mentorship-container">
      <div className="mentorship-header mb-8">
        <h1>Mentorship</h1>
        <p className="text-secondary">Manage your mentorships and requests.</p>
        <div className="mt-4">
          <Link to="/directory">
            <Button variant="primary">Find a Mentor</Button>
          </Link>
        </div>
      </div>

      <div className="mentorship-tabs">
        <button
          className={`tab-button ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          Active Mentorships
        </button>
        <button
          className={`tab-button ${activeTab === 'incoming' ? 'active' : ''}`}
          onClick={() => setActiveTab('incoming')}
        >
          Incoming Requests
        </button>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {relationships.length > 0 ? (
                  relationships.map(rel => (
                    <MentorshipRelationshipCard
                      key={rel.id}
                      relationship={rel}
                      currentUserId={user.id}
                    />
                  ))
                ) : (
                  <p className="text-gray-500 col-span-2 text-center py-8">No active mentorships found.</p>
                )}
              </div>
            )}

            {activeTab === 'incoming' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  <p className="text-gray-500 col-span-2 text-center py-8">No incoming requests.</p>
                )}
              </div>
            )}

            {activeTab === 'outgoing' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {outgoingRequests.length > 0 ? (
                  outgoingRequests.map(req => (
                    <MentorshipRequestCard
                      key={req.id}
                      request={req}
                      type="outgoing"
                    />
                  ))
                ) : (
                  <p className="text-gray-500 col-span-2 text-center py-8">No outgoing requests.</p>
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
