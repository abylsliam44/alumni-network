import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { jobsApi } from '../api/jobs';
import { useAuth } from '../hooks/useAuth';
import { canModerateJobs, canPostJobs } from '../utils/jobPermissions';
import ApplicationChat from '../components/ApplicationChat';
import Icon from '../components/ui/Icon';
import Pill from '../components/ui/Pill';

const STATUS_OPTIONS = ['SUBMITTED', 'VIEWED', 'SHORTLISTED', 'INTERVIEW', 'REJECTED', 'HIRED'];

const STATUS_TONE = {
  SUBMITTED: 'blue',
  VIEWED: undefined,
  SHORTLISTED: 'warm',
  INTERVIEW: 'blue',
  REJECTED: 'err',
  HIRED: 'ok',
};

const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : 'Not scheduled');

const formatInputDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatInputTime = (date) => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const defaultInterviewDateTime = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  return { date: formatInputDate(date), time: formatInputTime(date) };
};

const toLocalDateTimePayload = (dateValue, timeValue) => {
  if (!dateValue || !timeValue) return null;
  const date = new Date(`${dateValue}T${timeValue}`);
  return Number.isNaN(date.getTime()) ? null : `${dateValue}T${timeValue}:00`;
};

const Hiring = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ query: '', status: '', job_id: '' });
  const [scheduleFor, setScheduleFor] = useState(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [chatFor, setChatFor] = useState(null);
  const [actionLoading, setActionLoading] = useState('');

  const canUseHiring = canPostJobs(user) || canModerateJobs(user);

  const loadData = useCallback(async (nextFilters = filters) => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(nextFilters).filter(([, value]) => value));
      const [apps, jobsData] = await Promise.all([
        jobsApi.receivedApplications(params),
        jobsApi.list({ limit: 50 }),
      ]);
      setApplications(apps || []);
      setJobs(jobsData.items || []);
    } catch (err) {
      console.error('Failed to load hiring workspace', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (!canUseHiring) {
      navigate('/jobs');
      return;
    }
    loadData();
  }, [canUseHiring, loadData, navigate]);

  const metrics = useMemo(() => ({
    total: applications.length,
    newCount: applications.filter((item) => item.status === 'SUBMITTED').length,
    interviews: applications.filter((item) => item.status === 'INTERVIEW').length,
    hired: applications.filter((item) => item.status === 'HIRED').length,
  }), [applications]);

  const applyFilters = (e) => {
    e.preventDefault();
    loadData(filters);
  };

  const updateStatus = async (application, status) => {
    setActionLoading(`${application.id}-${status}`);
    try {
      await jobsApi.updateApplicationStatus(application.id, status);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update application');
    } finally {
      setActionLoading('');
    }
  };

  const downloadResume = async (application) => {
    setActionLoading(`${application.id}-resume`);
    try {
      if (application.status === 'SUBMITTED') {
        await jobsApi.updateApplicationStatus(application.id, 'VIEWED');
      }
      const url = await jobsApi.getResumeDownload(application.id);
      window.open(url, '_blank', 'noopener,noreferrer');
      await loadData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to open resume');
    } finally {
      setActionLoading('');
    }
  };

  const openSchedule = (application) => {
    const next = defaultInterviewDateTime();
    setScheduleFor(application);
    setScheduleDate(next.date);
    setScheduleTime(next.time);
  };

  const closeSchedule = () => {
    setScheduleFor(null);
    setScheduleDate('');
    setScheduleTime('');
  };

  const submitSchedule = async (e) => {
    e.preventDefault();
    const iso = toLocalDateTimePayload(scheduleDate, scheduleTime);
    if (!scheduleFor || !iso) return;
    setActionLoading(`${scheduleFor.id}-schedule`);
    try {
      await jobsApi.scheduleInterview(scheduleFor.id, iso);
      closeSchedule();
      await loadData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to schedule interview');
    } finally {
      setActionLoading('');
    }
  };

  const joinInterview = (application) => {
    const roomName = application.latest_interview?.room_name;
    if (!roomName) return;
    navigate(`/video-call/${encodeURIComponent(roomName)}?returnTo=${encodeURIComponent('/jobs/hiring')}`, {
      state: { from: '/jobs/hiring' },
    });
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>JOBS · HIRING</div>
          <h1 className="h1">Manage your <i>applicant pipeline</i>.</h1>
        </div>
        <div className="page-head-actions">
          <Link to="/jobs/create" className="btn primary"><Icon name="plus" size={12} /> Post a job</Link>
        </div>
      </div>

      <div className="stat-strip" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        {[
          ['Applications', metrics.total],
          ['New', metrics.newCount],
          ['Interviews', metrics.interviews],
          ['Hired', metrics.hired],
        ].map(([label, value]) => (
          <div key={label} className="stat">
            <div className="stat-label">{label}</div>
            <div className="stat-num">{value}</div>
            <div className="stat-sub">current pipeline</div>
          </div>
        ))}
      </div>

      <div className="panel" style={{ padding: 16, marginBottom: 20 }}>
        <form onSubmit={applyFilters} className="filter-grid jobs">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Search</label>
            <input value={filters.query} onChange={(e) => setFilters({ ...filters, query: e.target.value })} placeholder="Applicant, job, company..." />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Status</label>
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All</option>
              {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Job</label>
            <select value={filters.job_id} onChange={(e) => setFilters({ ...filters, job_id: e.target.value })}>
              <option value="">All jobs</option>
              {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
            </select>
          </div>
          <button className="btn primary" type="submit"><Icon name="search" size={12} /> Filter</button>
          <button type="button" className="btn ghost" onClick={() => { const clear = { query: '', status: '', job_id: '' }; setFilters(clear); loadData(clear); }}>Clear</button>
        </form>
      </div>

      {loading ? (
        <div className="loading-block">Loading applications...</div>
      ) : applications.length === 0 ? (
        <div className="empty-block">
          <Icon name="briefcase" size={28} />
          <h3>No applications yet</h3>
          <p>New applicants will appear here after students or alumni apply.</p>
        </div>
      ) : (
        <div className="responsive-card-grid wide">
          {applications.map((application) => (
            <article key={application.id} className="panel" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h3 className="h3">{application.applicant?.name || 'Applicant'}</h3>
                  <div className="mute" style={{ fontSize: 12 }}>{application.applicant?.email}</div>
                </div>
                <Pill tone={STATUS_TONE[application.status]} dot>{application.status}</Pill>
              </div>

              <div className="panel" style={{ padding: 12, background: 'var(--bg-2)' }}>
                <div className="h3" style={{ fontSize: 13 }}>{application.job?.title}</div>
                <div className="mute" style={{ fontSize: 12 }}>{application.job?.company} · Applied {formatDateTime(application.applied_at)}</div>
              </div>

              {application.cover_letter && (
                <p className="dim" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {application.cover_letter}
                </p>
              )}

              {application.latest_interview && (
                <div className="panel blue-tint" style={{ padding: 12 }}>
                  <div className="eyebrow" style={{ marginBottom: 4 }}>INTERVIEW</div>
                  <div style={{ fontSize: 12.5 }}>{formatDateTime(application.latest_interview.scheduled_at)}</div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'auto' }}>
                <button className="btn sm" onClick={() => downloadResume(application)} disabled={actionLoading === `${application.id}-resume`}>
                  <Icon name="download" size={12} /> Resume
                </button>
                <button className="btn sm" onClick={() => setChatFor(application)}><Icon name="msg" size={12} /> Chat</button>
                <button className="btn sm" onClick={() => openSchedule(application)}><Icon name="calendar" size={12} /> Interview</button>
                {application.latest_interview && <button className="btn sm primary" onClick={() => joinInterview(application)}><Icon name="video" size={12} /> Join</button>}
                <button className="btn sm" onClick={() => updateStatus(application, 'SHORTLISTED')} disabled={actionLoading === `${application.id}-SHORTLISTED`}>Shortlist</button>
                <button className="btn sm ghost" onClick={() => updateStatus(application, 'REJECTED')} disabled={actionLoading === `${application.id}-REJECTED`}>Reject</button>
                <button className="btn sm primary" onClick={() => updateStatus(application, 'HIRED')} disabled={actionLoading === `${application.id}-HIRED`}>Hire</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {scheduleFor && (
        <div className="modal-backdrop" onClick={closeSchedule}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">SCHEDULE INTERVIEW</div>
                <h3>{scheduleFor.applicant?.name}</h3>
              </div>
              <button className="iconbtn" onClick={closeSchedule}><Icon name="close" size={14} /></button>
            </div>
            <form onSubmit={submitSchedule}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Date</label>
                    <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Time</label>
                    <input type="time" step="900" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} required />
                  </div>
                </div>
              </div>
              <div className="modal-foot">
                <button type="button" className="btn ghost" onClick={closeSchedule}>Cancel</button>
                <button type="submit" className="btn primary">Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {chatFor && (
        <div className="modal-backdrop" onClick={() => setChatFor(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">APPLICATION CHAT</div>
                <h3>{chatFor.applicant?.name}</h3>
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

export default Hiring;
