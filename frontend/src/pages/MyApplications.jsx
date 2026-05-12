import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { jobsApi } from '../api/jobs';
import ApplicationChat from '../components/ApplicationChat';
import Icon from '../components/ui/Icon';
import Pill from '../components/ui/Pill';

const STATUS_TONE = {
  SUBMITTED: 'blue',
  VIEWED: undefined,
  SHORTLISTED: 'warm',
  INTERVIEW: 'blue',
  REJECTED: 'err',
  HIRED: 'ok',
};

const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : 'Not scheduled');

const MyApplications = () => {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chatFor, setChatFor] = useState(null);

  const loadApplications = useCallback(async () => {
    setLoading(true);
    try {
      setApplications(await jobsApi.myApplications());
    } catch (err) {
      console.error('Failed to load applications', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadApplications(); }, [loadApplications]);

  const counts = useMemo(() => ({
    total: applications.length,
    interviews: applications.filter((item) => item.status === 'INTERVIEW').length,
    shortlisted: applications.filter((item) => item.status === 'SHORTLISTED').length,
  }), [applications]);

  const joinInterview = (application) => {
    const roomName = application.latest_interview?.room_name;
    if (!roomName) return;
    navigate(`/video-call/${encodeURIComponent(roomName)}?returnTo=${encodeURIComponent('/jobs/applications')}`, {
      state: { from: '/jobs/applications' },
    });
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>JOBS · MY APPLICATIONS</div>
          <h1 className="h1">Track every <i>application</i>.</h1>
        </div>
        <div className="page-head-actions">
          <Link to="/jobs" className="btn primary"><Icon name="briefcase" size={12} /> Browse jobs</Link>
        </div>
      </div>

      <div className="stat-strip" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        {[
          ['Applications', counts.total],
          ['Interviews', counts.interviews],
          ['Shortlisted', counts.shortlisted],
        ].map(([label, value]) => (
          <div key={label} className="stat">
            <div className="stat-label">{label}</div>
            <div className="stat-num">{value}</div>
            <div className="stat-sub">current status</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="loading-block">Loading applications...</div>
      ) : applications.length === 0 ? (
        <div className="empty-block">
          <Icon name="briefcase" size={28} />
          <h3>No applications yet</h3>
          <p>Apply to a job and your status, chat, and interviews will appear here.</p>
          <Link to="/jobs" className="btn primary">Browse jobs</Link>
        </div>
      ) : (
        <div className="responsive-card-grid wide">
          {applications.map((application) => (
            <article key={application.id} className="panel" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h3 className="h3">{application.job?.title}</h3>
                  <div className="mute" style={{ fontSize: 12 }}>{application.job?.company} · Applied {formatDateTime(application.applied_at)}</div>
                </div>
                <Pill tone={STATUS_TONE[application.status]} dot>{application.status}</Pill>
              </div>

              {application.latest_interview && (
                <div className="panel blue-tint" style={{ padding: 12 }}>
                  <div className="eyebrow" style={{ marginBottom: 4 }}>INTERVIEW</div>
                  <div style={{ fontSize: 12.5 }}>{formatDateTime(application.latest_interview.scheduled_at)}</div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'auto' }}>
                <Link className="btn sm" to={`/jobs/${application.job_id}`}>Open job</Link>
                <button className="btn sm" onClick={() => setChatFor(application)}><Icon name="msg" size={12} /> Chat</button>
                {application.latest_interview && (
                  <button className="btn sm primary" onClick={() => joinInterview(application)}><Icon name="video" size={12} /> Join interview</button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {chatFor && (
        <div className="modal-backdrop" onClick={() => setChatFor(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">APPLICATION CHAT</div>
                <h3>{chatFor.job?.title}</h3>
              </div>
              <button className="iconbtn" onClick={() => setChatFor(null)}><Icon name="close" size={14} /></button>
            </div>
            <div className="modal-body">
              <ApplicationChat applicationId={chatFor.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyApplications;
