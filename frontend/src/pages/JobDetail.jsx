import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { jobsApi } from '../api/jobs';
import { useAuth } from '../hooks/useAuth';
import { canModerateJobs } from '../utils/jobPermissions';
import ApplicationChat from '../components/ApplicationChat';
import Pill from '../components/ui/Pill';
import Icon from '../components/ui/Icon';
import axios from 'axios';

const EMPLOYMENT_LABEL = {
  FULL_TIME: 'Full-time', PART_TIME: 'Part-time', INTERNSHIP: 'Internship', CONTRACT: 'Contract',
};

const STATUS_TONE = {
  DRAFT: undefined, PENDING: 'warm', APPROVED: 'ok', REJECTED: 'err', CLOSED: undefined,
  SUBMITTED: 'blue', VIEWED: undefined, SHORTLISTED: 'warm', INTERVIEW: 'blue', HIRED: 'ok',
};

const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
const formatDateTime = (dateStr) => (dateStr ? new Date(dateStr).toLocaleString() : 'Not scheduled');
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

const JobDetail = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [resumeFile, setResumeFile] = useState(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [uploading, setUploading] = useState(false);
  const [applications, setApplications] = useState([]);
  const [chatFor, setChatFor] = useState(null);
  const [scheduleFor, setScheduleFor] = useState(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  useEffect(() => { fetchJob(); fetchMyApplication(); /* eslint-disable-line */ }, [jobId, user?.id]);

  const fetchJob = async () => {
    try {
      const data = await jobsApi.get(jobId);
      setJob(data);
      if (user?.id === data.created_by || canModerateJobs(user)) fetchApplications();
    }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchApplications = async () => {
    try { setApplications(await jobsApi.getApplications(jobId)); }
    catch (err) { console.error(err); }
  };

  const fetchMyApplication = async () => {
    try {
      const apps = await jobsApi.myApplications();
      setApplication(apps.find((a) => a.job_id === jobId));
    } catch (err) { console.error(err); }
  };

  const handleApply = async (e) => {
    e.preventDefault();
    if (!resumeFile) return;
    setUploading(true);
    try {
      const { upload_url, object_name } = await jobsApi.getPresignedUrl(resumeFile.name, resumeFile.type);
      await axios.put(upload_url, resumeFile, { headers: { 'Content-Type': resumeFile.type } });
      await jobsApi.apply(jobId, { resume_object_name: object_name, cover_letter: coverLetter });
      setShowApplyModal(false);
      fetchMyApplication(); fetchJob();
    } catch (err) { console.error(err); alert('Application failed.'); }
    finally { setUploading(false); }
  };

  const handleStatusChange = async (action) => {
    try {
      if (action === 'SUBMIT') await jobsApi.submit(jobId);
      if (action === 'APPROVE') await jobsApi.approve(jobId);
      if (action === 'REJECT') await jobsApi.reject(jobId);
      if (action === 'CLOSE') await jobsApi.close(jobId);
      fetchJob();
    } catch (err) { console.error(err); }
  };

  const updateApplicationStatus = async (app, status) => {
    try {
      await jobsApi.updateApplicationStatus(app.id, status);
      fetchApplications(); fetchJob();
    } catch (err) { alert(err.response?.data?.detail || 'Failed to update application'); }
  };

  const downloadResume = async (app) => {
    try {
      if (app.status === 'SUBMITTED') await jobsApi.updateApplicationStatus(app.id, 'VIEWED');
      const url = await jobsApi.getResumeDownload(app.id);
      window.open(url, '_blank', 'noopener,noreferrer');
      fetchApplications(); fetchJob();
    } catch (err) { alert(err.response?.data?.detail || 'Failed to open resume'); }
  };

  const openSchedule = (app) => {
    const next = defaultInterviewDateTime();
    setScheduleFor(app);
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
    try {
      await jobsApi.scheduleInterview(scheduleFor.id, iso);
      closeSchedule();
      fetchApplications(); fetchJob();
    } catch (err) { alert(err.response?.data?.detail || 'Failed to schedule interview'); }
  };

  const joinInterview = (app) => {
    const roomName = app.latest_interview?.room_name;
    if (!roomName) return;
    navigate(`/video-call/${encodeURIComponent(roomName)}?returnTo=${encodeURIComponent(`/jobs/${jobId}`)}`, {
      state: { from: `/jobs/${jobId}` },
    });
  };

  if (loading) return <div className="page"><div className="loading-block">Loading job…</div></div>;
  if (!job) return (
    <div className="page">
      <div className="empty-block">
        <Icon name="alert" size={28} />
        <h3>Job not found</h3>
        <p>This job posting may have been removed or doesn't exist.</p>
        <button className="btn" onClick={() => navigate('/jobs')}>Back to jobs</button>
      </div>
    </div>
  );

  const isCreator = user?.id === job.created_by;
  const isAdmin = canModerateJobs(user);
  const canApply = ['STUDENT', 'ALUMNI'].includes(user?.role) && !isCreator && !isAdmin && !application && job.status === 'APPROVED';

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
        <Link to="/jobs" style={{ color: 'var(--ink-3)' }}>JOBS</Link>
        <span>/</span>
        <span style={{ color: 'var(--ink-2)' }}>{job.title.toUpperCase()}</span>
      </div>

      <div className="panel" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 280 }}>
            <div style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--bg-2)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', fontFamily: 'var(--mono)', color: 'var(--ink-2)', fontSize: 18, fontWeight: 600 }}>
              {(job.company || '?').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="mute mono" style={{ fontSize: 10.5, letterSpacing: '0.06em', marginBottom: 4 }}>
                {(job.company || '').toUpperCase()} · {(job.location || 'REMOTE').toUpperCase()}
              </div>
              <h1 className="h1" style={{ fontSize: 28 }}>{job.title}</h1>
            </div>
          </div>
          <div className="mobile-full-actions" style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            {canApply && (
              <button className="btn primary lg" onClick={() => setShowApplyModal(true)}>
                <Icon name="send" size={14} /> Apply now
              </button>
            )}
            {application && (
              <Pill tone="ok" dot>Applied · {application.status}</Pill>
            )}
            <Pill tone={STATUS_TONE[job.status]} dot>{job.status}</Pill>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
          {job.employment_type && <Pill tone="blue" dot>{EMPLOYMENT_LABEL[job.employment_type] || job.employment_type}</Pill>}
          {job.format && <Pill>{job.format === 'REMOTE' ? 'Remote' : job.format === 'HYBRID' ? 'Hybrid' : 'On-site'}</Pill>}
          {job.salary_range && <Pill tone="warm">{job.salary_range}</Pill>}
          <Pill>Posted {formatDate(job.created_at)}</Pill>
          {(isCreator || isAdmin) && <Pill>{job.applications_count || 0} applications</Pill>}
        </div>
      </div>

      <div className="responsive-two-col">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>01 · ABOUT THE ROLE</div>
          <div className="panel" style={{ padding: 18 }}>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>
              {job.description}
            </p>
          </div>

          {job.required_skills && job.required_skills.length > 0 && (
            <>
              <div className="eyebrow" style={{ margin: '24px 0 10px' }}>02 · REQUIRED SKILLS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {job.required_skills.map((s, i) => <span key={i} className="chip skill">{s}</span>)}
              </div>
            </>
          )}

          {application && (
            <>
              <div className="eyebrow" style={{ margin: '24px 0 10px' }}>03 · APPLICATION CHAT</div>
              <div className="panel" style={{ padding: 16 }}>
                <ApplicationChat applicationId={application.id} />
              </div>
            </>
          )}

          {(isCreator || isAdmin) && (
            <>
              <div className="eyebrow" style={{ margin: '24px 0 10px' }}>03 · APPLICATIONS</div>
              <div className="panel" style={{ padding: 16 }}>
                {applications.length === 0 ? (
                  <div className="empty-block" style={{ padding: 24 }}>
                    <Icon name="users" size={24} />
                    <h3>No applicants yet</h3>
                    <p>Applications will show up here after candidates apply.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {applications.map((app) => (
                      <div key={app.id} className="panel" style={{ padding: 12, background: 'var(--bg-2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                          <div>
                            <div className="h3" style={{ fontSize: 13 }}>{app.applicant?.name || 'Applicant'}</div>
                            <div className="mute" style={{ fontSize: 12 }}>{app.applicant?.email} · Applied {formatDateTime(app.applied_at)}</div>
                          </div>
                          <Pill tone={STATUS_TONE[app.status]} dot>{app.status}</Pill>
                        </div>
                        {app.latest_interview && (
                          <div className="mute" style={{ fontSize: 12, marginTop: 8 }}>
                            Interview: {formatDateTime(app.latest_interview.scheduled_at)}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                          <button className="btn sm" onClick={() => downloadResume(app)}><Icon name="download" size={12} /> Resume</button>
                          <button className="btn sm" onClick={() => setChatFor(app)}><Icon name="msg" size={12} /> Chat</button>
                          <button className="btn sm" onClick={() => openSchedule(app)}><Icon name="calendar" size={12} /> Interview</button>
                          {app.latest_interview && <button className="btn sm primary" onClick={() => joinInterview(app)}><Icon name="video" size={12} /> Join</button>}
                          <button className="btn sm" onClick={() => updateApplicationStatus(app, 'SHORTLISTED')}>Shortlist</button>
                          <button className="btn sm ghost" onClick={() => updateApplicationStatus(app, 'REJECTED')}>Reject</button>
                          <button className="btn sm primary" onClick={() => updateApplicationStatus(app, 'HIRED')}>Hire</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>JOB DETAILS</div>
          <div className="panel" style={{ padding: 16 }}>
            {[
              ['Employment', EMPLOYMENT_LABEL[job.employment_type] || '—'],
              ['Location', job.location || 'Not specified'],
              ['Work mode', job.format === 'REMOTE' ? 'Remote' : job.format === 'HYBRID' ? 'Hybrid' : 'On-site'],
              ['Salary', job.salary_range || 'Not disclosed'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: '1px solid var(--line-soft)', fontSize: 12.5 }}>
                <span className="mute mono" style={{ fontSize: 10.5 }}>{k.toUpperCase()}</span>
                <span style={{ color: 'var(--ink)' }}>{v}</span>
              </div>
            ))}
          </div>

          {(isCreator || isAdmin) && (
            <>
              <div className="eyebrow" style={{ margin: '20px 0 10px' }}>ACTIONS</div>
              <div className="panel" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {isCreator && job.status === 'DRAFT' && (
                  <button className="btn primary block" onClick={() => handleStatusChange('SUBMIT')}>Submit for review</button>
                )}
                {isAdmin && job.status === 'PENDING' && (
                  <>
                    <button className="btn block" onClick={() => handleStatusChange('APPROVE')}>Approve</button>
                    <button className="btn ghost block" onClick={() => handleStatusChange('REJECT')}>Reject</button>
                  </>
                )}
                {(isCreator || isAdmin) && job.status === 'APPROVED' && (
                  <button className="btn block" onClick={() => handleStatusChange('CLOSE')}>Close position</button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {showApplyModal && (
        <div className="modal-backdrop" onClick={() => setShowApplyModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="eyebrow" style={{ marginBottom: 4 }}>APPLY</div>
                <h3>{job.title}</h3>
              </div>
              <button className="iconbtn" onClick={() => setShowApplyModal(false)}><Icon name="close" size={14} /></button>
            </div>
            <form onSubmit={handleApply} style={{ display: 'contents' }}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Resume (PDF, DOC, DOCX)</label>
                  <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setResumeFile(e.target.files[0])} required style={{ padding: 8 }} />
                  {resumeFile && <div className="help" style={{ color: 'var(--ok)', marginTop: 6 }}>✓ {resumeFile.name}</div>}
                </div>
                <div className="form-group">
                  <label>Cover letter (optional)</label>
                  <textarea rows={5} value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} placeholder="Introduce yourself…" />
                </div>
              </div>
              <div className="modal-foot">
                <button type="button" className="btn ghost" onClick={() => setShowApplyModal(false)}>Cancel</button>
                <button type="submit" className="btn primary" disabled={uploading}>{uploading ? 'Submitting…' : 'Submit application'}</button>
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

      {scheduleFor && (
        <div className="modal-backdrop" onClick={closeSchedule}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">SCHEDULE INTERVIEW</div>
                <h3>{scheduleFor.applicant?.name || 'Applicant'}</h3>
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
                <button type="submit" className="btn primary">Schedule interview</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobDetail;
