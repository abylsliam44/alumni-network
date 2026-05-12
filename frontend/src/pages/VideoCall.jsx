import { useCallback, useMemo } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import JitsiMeet, { normalizeJitsiRoomName } from '../components/JitsiMeet';
import { useAuth } from '../hooks/useAuth';
import Icon from '../components/ui/Icon';

const VideoCall = () => {
  const { roomName: routeRoomName = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const conversationId = searchParams.get('conversation');
  const explicitReturnTo = searchParams.get('returnTo');
  const roomName = normalizeJitsiRoomName(routeRoomName);
  const returnTo = location.state?.from || explicitReturnTo || (conversationId ? `/messages?chat=${conversationId}` : '/messages');
  const backLabel = returnTo.startsWith('/mentorship')
    ? 'Back to mentorship'
    : returnTo.startsWith('/jobs')
      ? 'Back to jobs'
      : 'Back to messages';
  const displayName = user?.name || user?.email || 'Guest';

  const handleReadyToClose = useCallback(() => navigate(returnTo), [navigate, returnTo]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <header style={{ padding: '14px 24px', borderBottom: '1px solid var(--line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flex: '0 0 auto' }}>
        <div>
          <Link to={returnTo} className="mute mono" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="arrowL" size={12} /> {backLabel.toUpperCase()}
          </Link>
          <div className="h2" style={{ marginTop: 4 }}>Video call</div>
        </div>
        {roomName && (
          <span className="pill mono" title={roomName}>
            <span className="pulse-dot" /> {roomName}
          </span>
        )}
      </header>

      <div style={{ flex: 1, padding: 16, minHeight: 0 }}>
        <div className="jitsi-container">
          <JitsiMeet roomName={roomName} displayName={displayName} email={user?.email || ''} onReadyToClose={handleReadyToClose} />
        </div>
      </div>
    </div>
  );
};

export default VideoCall;
