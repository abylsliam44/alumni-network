import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { jobsApi } from '../api/jobs';
import { useAuth } from '../hooks/useAuth';
import ApplicationChat from '../components/ApplicationChat';
import Pill from '../components/ui/Pill';
import Icon from '../components/ui/Icon';
import axios from 'axios';

const EMPLOYMENT_LABEL = {
  FULL_TIME: 'Full-time', PART_TIME: 'Part-time', INTERNSHIP: 'Internship', CONTRACT: 'Contract',
};

const STATUS_TONE = {
  DRAFT: undefined, PENDING: 'warm', APPROVED: 'ok', REJECTED: 'err', CLOSED: undefined,
};

const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

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

  useEffect(() => { fetchJob(); fetchMyApplication(); /* eslint-disable-line */ }, [jobId]);

  const fetchJob = async () => {
    try { setJob(await jobsApi.get(jobId)); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
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
      const { upload_url, file_url } = await jobsApi.getPresignedUrl(resumeFile.name, resumeFile.type);
      await axios.put(upload_url, resumeFile, { headers: { 'Content-Type': resumeFile.type } });
      await jobsApi.apply(jobId, { resume_url: file_url, cover_letter: coverLetter });
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

  const isCreator = user.id === job.created_by;
  const isAdmin = user.is_admin || user.role === 'STAFF' || (user.system_roles && user.system_roles.includes('JOB_MODERATOR'));
  const canApply = !isCreator && !isAdmin && !application && job.status === 'APPROVED';

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
    </div>
  );
};

export default JobDetail;
