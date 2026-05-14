import { Link } from 'react-router-dom';
import Avatar from '../ui/Avatar';
import Pill from '../ui/Pill';
import { resolveUrl } from '../../utils/image';

const STATUS_TONE = { PENDING: 'warm', ACCEPTED: 'ok', DECLINED: 'err', CANCELLED: undefined, COMPLETED: 'blue' };

const MentorshipRequestCard = ({ request, type, onAccept, onDecline, onCancel }) => {
  const otherUser = type === 'incoming' ? request.sender : request.receiver;
  const goals = request.goals || [];
  const tone = STATUS_TONE[request.status];

  return (
    <div className="panel" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <Avatar src={resolveUrl(otherUser?.photo_url)} name={otherUser?.name} size="m" />
          <div style={{ minWidth: 0 }}>
            <h4 className="h3">
              <Link to={`/profile/${otherUser?.user_id}`} style={{ color: 'var(--ink)' }}>
                {otherUser?.name}
              </Link>
            </h4>
            <div className="mute mono" style={{ fontSize: 10.5, marginTop: 2 }}>
              {(otherUser?.headline || otherUser?.role || '').toUpperCase()}
            </div>
          </div>
        </div>
        <Pill tone={tone} dot>{request.status}</Pill>
      </div>

      {goals.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
          {goals.map((g) => <span key={g} className="chip skill">{g}</span>)}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <span className="pill">{request.expected_duration || 'Duration TBD'}</span>
        <span className="pill">{request.preferred_format || 'Format TBD'}</span>
        <span className="pill">{request.meeting_frequency || 'Frequency TBD'}</span>
      </div>

      <div className="eyebrow" style={{ marginBottom: 6 }}>MESSAGE</div>
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line-soft)', padding: 10, borderRadius: 7, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
        {request.message || 'No message provided.'}
      </div>

      {request.decline_reason && (
        <>
          <div className="eyebrow" style={{ margin: '12px 0 6px' }}>DECLINE REASON</div>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line-soft)', padding: 10, borderRadius: 7, fontSize: 12.5, color: 'var(--ink-2)' }}>
            {request.decline_reason}
          </div>
        </>
      )}

      <div className="mono mute" style={{ fontSize: 10, marginTop: 12 }}>
        SENT - {new Date(request.created_at).toLocaleDateString()}
      </div>

      {type === 'incoming' && request.status === 'PENDING' && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 14 }}>
          <button className="btn sm ghost" onClick={() => onDecline(request.id)}>Decline</button>
          <button className="btn sm primary" onClick={() => onAccept(request.id)}>Accept</button>
        </div>
      )}

      {type === 'outgoing' && request.status === 'PENDING' && onCancel && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 14 }}>
          <button className="btn sm ghost" onClick={() => onCancel(request.id)}>Cancel</button>
        </div>
      )}
    </div>
  );
};

export default MentorshipRequestCard;
