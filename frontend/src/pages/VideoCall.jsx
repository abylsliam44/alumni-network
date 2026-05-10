import { useCallback, useMemo } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import JitsiMeet, { normalizeJitsiRoomName } from '../components/JitsiMeet';
import { useAuth } from '../hooks/useAuth';

const VideoCall = () => {
  const { roomName: routeRoomName = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const conversationId = searchParams.get('conversation');
  const roomName = normalizeJitsiRoomName(routeRoomName);
  const returnTo = location.state?.from || (conversationId ? `/messages?chat=${conversationId}` : '/messages');
  const displayName = user?.name || user?.email || 'Guest';

  const handleReadyToClose = useCallback(() => {
    navigate(returnTo);
  }, [navigate, returnTo]);

  return (
    <div className="video-call-page">
      <header className="video-call-header">
        <div>
          <Link to={returnTo} className="video-call-back">
            Back to messages
          </Link>
          <h1>Video Call</h1>
        </div>
        {roomName && <span className="video-call-room">{roomName}</span>}
      </header>

      <JitsiMeet
        roomName={roomName}
        displayName={displayName}
        email={user?.email || ''}
        onReadyToClose={handleReadyToClose}
      />
    </div>
  );
};

export default VideoCall;
