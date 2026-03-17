import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { jobsApi } from '../api/jobs';
import { useAuth } from '../context/AuthContext';
import ApplicationChat from '../components/ApplicationChat';
import axios from 'axios';

const EMPLOYMENT_TYPES = {
  FULL_TIME: { label: 'Full Time', color: 'var(--text-primary)', bg: 'var(--bg-secondary)' },
  PART_TIME: { label: 'Part Time', color: 'var(--text-primary)', bg: 'var(--bg-secondary)' },
  INTERNSHIP: { label: 'Internship', color: 'var(--text-primary)', bg: 'var(--bg-secondary)' },
  CONTRACT: { label: 'Contract', color: 'var(--text-primary)', bg: 'var(--bg-secondary)' },
};

const STATUS_CONFIG = {
  DRAFT: { label: 'Draft', color: 'var(--text-secondary)', bg: 'var(--bg-secondary)' },
  PENDING: { label: 'Pending Review', color: 'var(--text-secondary)', bg: 'var(--bg-secondary)' },
  APPROVED: { label: 'Active', color: 'var(--text-primary)', bg: 'var(--bg-secondary)' },
  REJECTED: { label: 'Rejected', color: 'var(--text-secondary)', bg: 'var(--bg-secondary)' },
  CLOSED: { label: 'Closed', color: 'var(--text-secondary)', bg: 'var(--bg-secondary)' },
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

  useEffect(() => {
    fetchJob();
    fetchMyApplication();
  }, [jobId]);

  const fetchJob = async () => {
    try {
      const data = await jobsApi.get(jobId);
      setJob(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyApplication = async () => {
    try {
      const apps = await jobsApi.myApplications();
      const myApp = apps.find(a => a.job_id === jobId);
      setApplication(myApp);
    } catch (e) {
      console.error(e);
    }
  };

  const handleApply = async (e) => {
    e.preventDefault();
    if (!resumeFile) return alert("Please upload a resume");

    setUploading(true);
    try {
      const { upload_url, file_url } = await jobsApi.getPresignedUrl(resumeFile.name, resumeFile.type);

      await axios.put(upload_url, resumeFile, {
        headers: { 'Content-Type': resumeFile.type }
      });

      await jobsApi.apply(jobId, {
        resume_url: file_url,
        cover_letter: coverLetter
      });

      setShowApplyModal(false);
      fetchMyApplication();
      fetchJob();
      alert("Application Submitted!");
    } catch (err) {
      console.error(err);
      alert("Application failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleStatusChange = async (action) => {
    try {
      if (action === 'SUBMIT') await jobsApi.submit(jobId);
      if (action === 'APPROVE') await jobsApi.approve(jobId);
      if (action === 'REJECT') await jobsApi.reject(jobId);
      if (action === 'CLOSE') await jobsApi.close(jobId);
      fetchJob();
    } catch (e) {
      console.error(e);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="job-detail-loading">
        <div className="loading-spinner" />
        <p>Loading job details...</p>
        <style>{`
          .job-detail-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 60vh;
            gap: 16px;
            color: var(--text-secondary);
          }
          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid var(--border-color);
            border-top-color: var(--text-primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="job-not-found">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <h2>Job Not Found</h2>
        <p>This job posting may have been removed or doesn't exist.</p>
        <button onClick={() => navigate('/jobs')}>Back to Jobs</button>
        <style>{`
          .job-not-found {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 60vh;
            text-align: center;
            color: var(--text-secondary);
            gap: 16px;
          }
          .job-not-found svg { color: var(--text-tertiary); }
          .job-not-found h2 { color: var(--text-primary); margin: 0; }
          .job-not-found p { margin: 0; max-width: 300px; }
          .job-not-found button {
            margin-top: 8px;
            padding: 12px 24px;
            background: var(--text-primary);
            color: var(--bg-primary);
            border: none;
            border-radius: 10px;
            font-weight: 500;
            cursor: pointer;
          }
        `}</style>
      </div>
    );
  }

  const isCreator = user.id === job.created_by;
  const isAdmin =
    user.is_admin ||
    user.role === 'STAFF' ||
    (user.system_roles && user.system_roles.includes('JOB_MODERATOR'));
  const canApply = !isCreator && !isAdmin && !application && job.status === 'APPROVED';
  const typeConfig = EMPLOYMENT_TYPES[job.employment_type] || EMPLOYMENT_TYPES.FULL_TIME;
  const statusConfig = STATUS_CONFIG[job.status] || STATUS_CONFIG.DRAFT;

  return (
    <div className="job-detail-container">
      {/* Breadcrumb */}
      <nav className="job-breadcrumb">
        <Link to="/jobs" className="breadcrumb-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Jobs
        </Link>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 5l7 7-7 7" />
        </svg>
        <span className="breadcrumb-current">{job.title}</span>
      </nav>

      {/* Main Content */}
      <div className="job-detail-layout">
        {/* Left Column - Job Details */}
        <main className="job-detail-main">
          {/* Header Card */}
          <header className="job-header-card">
            <div className="job-header-top">
              <div className="job-company-logo">
                {job.company.charAt(0).toUpperCase()}
              </div>
              <div className="job-header-info">
                <div className="job-title-row">
                  <h1 className="job-detail-title">{job.title}</h1>
                  <span
                    className="job-status-badge"
                    style={{ color: statusConfig.color, backgroundColor: statusConfig.bg }}
                  >
                    {statusConfig.label}
                  </span>
                </div>
                <div className="job-meta-row">
                  <span className="job-company-name">{job.company}</span>
                  <span className="meta-dot">•</span>
                  <span className="job-location-text">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {job.location || 'Remote'}
                  </span>
                </div>
              </div>
            </div>

            <div className="job-header-tags">
              <span
                className="job-type-badge"
                style={{ color: typeConfig.color, backgroundColor: typeConfig.bg }}
              >
                {typeConfig.label}
              </span>
              <span className="job-format-badge">
                {job.format === 'REMOTE' ? 'Remote' : job.format === 'HYBRID' ? 'Hybrid' : 'On-site'}
              </span>
              {job.salary_range && (
                <span className="job-salary-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {job.salary_range}
                </span>
              )}
            </div>

            <div className="job-header-meta">
              <span className="meta-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                Posted {formatDate(job.created_at)}
              </span>
              {(isCreator || isAdmin) && (
                <span className="meta-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                  </svg>
                  {job.applications_count || 0} applications
                </span>
              )}
            </div>
          </header>

          {/* Application Status Banner */}
          {application && (
            <div className="application-status-card">
              <div className="status-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="status-content">
                <h3>Application Submitted</h3>
                <p>Status: <strong>{application.status}</strong> • Applied on {formatDate(application.applied_at)}</p>
              </div>
            </div>
          )}

          {/* Description Section */}
          <section className="job-section">
            <h2 className="section-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14,2 14,8 20,8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10,9 9,9 8,9" />
              </svg>
              Job Description
            </h2>
            <div className="description-content">
              {job.description}
            </div>
          </section>

          {/* Skills Section */}
          {job.required_skills && job.required_skills.length > 0 && (
            <section className="job-section">
              <h2 className="section-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
                </svg>
                Required Skills
              </h2>
              <div className="skills-list">
                {job.required_skills.map((skill, idx) => (
                  <span key={idx} className="skill-tag">{skill}</span>
                ))}
              </div>
            </section>
          )}

          {/* Application Chat */}
          {application && (
            <section className="job-section">
              <h2 className="section-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
                Messages
              </h2>
              <ApplicationChat applicationId={application.id} />
            </section>
          )}
        </main>

        {/* Right Column - Sidebar */}
        <aside className="job-detail-sidebar">
          {/* Apply Card */}
          <div className="sidebar-card apply-card">
            {canApply && (
              <>
                <button className="apply-btn" onClick={() => setShowApplyModal(true)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                  Apply Now
                </button>
                <p className="apply-hint">Your application will be sent directly to the employer</p>
              </>
            )}

            {application && (
              <div className="already-applied">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>You've applied to this job</span>
              </div>
            )}

            {/* Admin/Creator Actions */}
            {(isCreator || isAdmin) && (
              <div className="admin-actions">
                {isCreator && job.status === 'DRAFT' && (
                  <button className="action-btn submit" onClick={() => handleStatusChange('SUBMIT')}>
                    Submit for Review
                  </button>
                )}
                {isAdmin && job.status === 'PENDING' && (
                  <>
                    <button className="action-btn approve" onClick={() => handleStatusChange('APPROVE')}>
                      Approve
                    </button>
                    <button className="action-btn reject" onClick={() => handleStatusChange('REJECT')}>
                      Reject
                    </button>
                  </>
                )}
                {(isCreator || isAdmin) && job.status === 'APPROVED' && (
                  <button className="action-btn close" onClick={() => handleStatusChange('CLOSE')}>
                    Close Position
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Job Info Card */}
          <div className="sidebar-card info-card">
            <h3 className="info-card-title">Job Details</h3>
            <div className="info-list">
              <div className="info-row">
                <span className="info-label">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
                  </svg>
                  Employment
                </span>
                <span className="info-value">{typeConfig.label}</span>
              </div>
              <div className="info-row">
                <span className="info-label">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Location
                </span>
                <span className="info-value">{job.location || 'Not specified'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                  </svg>
                  Work Mode
                </span>
                <span className="info-value">
                  {job.format === 'REMOTE' ? 'Remote' : job.format === 'HYBRID' ? 'Hybrid' : 'On-site'}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Salary
                </span>
                <span className="info-value">{job.salary_range || 'Not disclosed'}</span>
              </div>
            </div>
          </div>

          {/* Company Card */}
          <div className="sidebar-card company-card">
            <h3 className="info-card-title">About Company</h3>
            <div className="company-preview">
              <div className="company-logo-small">
                {job.company.charAt(0).toUpperCase()}
              </div>
              <div className="company-info">
                <span className="company-name-text">{job.company}</span>
                <span className="company-location">{job.location || 'Remote'}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Apply Modal */}
      {showApplyModal && (
        <div className="modal-backdrop" onClick={() => setShowApplyModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Apply to {job.title}</h2>
              <button className="modal-close" onClick={() => setShowApplyModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleApply} className="modal-form">
              <div className="form-group">
                <label>Resume (PDF, DOC, DOCX)</label>
                <div className={`file-upload-zone ${resumeFile ? 'has-file' : ''}`}>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={e => setResumeFile(e.target.files[0])}
                    required
                  />
                  {resumeFile ? (
                    <div className="file-info">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14,2 14,8 20,8" />
                      </svg>
                      <span>{resumeFile.name}</span>
                    </div>
                  ) : (
                    <div className="upload-placeholder">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                      </svg>
                      <span>Click or drag to upload</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>Cover Letter (Optional)</label>
                <textarea
                  rows={5}
                  value={coverLetter}
                  onChange={e => setCoverLetter(e.target.value)}
                  placeholder="Introduce yourself and explain why you're a great fit for this role..."
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowApplyModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={uploading}>
                  {uploading ? (
                    <>
                      <span className="btn-spinner" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Application'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .job-detail-container {
          min-height: 100vh;
          padding-bottom: 4rem;
        }

        /* Breadcrumb */
        .job-breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 24px;
          font-size: 14px;
          color: var(--text-secondary);
        }

        .breadcrumb-link {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--text-secondary);
          text-decoration: none;
          transition: color 0.2s;
        }

        .breadcrumb-link:hover {
          color: var(--text-primary);
        }

        .breadcrumb-current {
          color: var(--text-primary);
          font-weight: 500;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Layout */
        .job-detail-layout {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 32px;
        }

        /* Header Card */
        .job-header-card {
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 28px;
          margin-bottom: 24px;
        }

        .job-header-top {
          display: flex;
          gap: 20px;
          margin-bottom: 20px;
        }

        .job-company-logo {
          width: 72px;
          height: 72px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--bg-secondary), var(--border-color));
          border-radius: 16px;
          font-size: 2rem;
          font-weight: 700;
          color: var(--text-primary);
          flex-shrink: 0;
        }

        .job-header-info {
          flex: 1;
          min-width: 0;
        }

        .job-title-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 8px;
        }

        .job-detail-title {
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
          line-height: 1.2;
        }

        .job-status-badge {
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }

        .job-meta-row {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--text-secondary);
          font-size: 15px;
        }

        .job-company-name {
          font-weight: 600;
          color: var(--text-primary);
        }

        .meta-dot {
          color: var(--text-tertiary);
        }

        .job-location-text {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .job-header-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 20px;
        }

        .job-type-badge {
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
        }

        .job-format-badge {
          padding: 6px 12px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          font-size: 13px;
          color: var(--text-secondary);
        }

        .job-salary-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
        }

        .job-header-meta {
          display: flex;
          gap: 20px;
          padding-top: 16px;
          border-top: 1px solid var(--border-subtle);
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
          color: var(--text-secondary);
        }

        /* Application Status */
        .application-status-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          margin-bottom: 24px;
        }

        .status-icon {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          color: var(--text-primary);
        }

        .status-content h3 {
          margin: 0 0 4px;
          font-size: 16px;
          color: var(--text-primary);
        }

        .status-content p {
          margin: 0;
          font-size: 14px;
          color: var(--text-secondary);
        }

        /* Sections */
        .job-section {
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 28px;
          margin-bottom: 24px;
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 20px;
        }

        .section-title svg {
          color: var(--text-secondary);
        }

        .description-content {
          white-space: pre-wrap;
          line-height: 1.7;
          color: var(--text-secondary);
          font-size: 15px;
        }

        .skills-list {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .skill-tag {
          padding: 8px 16px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          font-size: 14px;
          color: var(--text-primary);
        }

        /* Sidebar */
        .job-detail-sidebar {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .sidebar-card {
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 24px;
        }

        .apply-card {
          position: sticky;
          top: 24px;
        }

        .apply-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          padding: 16px;
          background: var(--text-primary);
          color: var(--bg-primary);
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .apply-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        }

        .apply-hint {
          margin: 12px 0 0;
          font-size: 13px;
          color: var(--text-tertiary);
          text-align: center;
        }

        .already-applied {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 16px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          color: var(--text-primary);
          font-weight: 500;
        }

        .admin-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 16px;
        }

        .action-btn {
          width: 100%;
          padding: 12px;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-btn.submit {
          background: var(--bg-secondary);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
        }

        .action-btn.approve {
          background: var(--text-primary);
          color: var(--bg-primary);
        }

        .action-btn.reject {
          background: var(--bg-secondary);
          color: var(--text-secondary);
          border: 1px solid var(--border-color);
        }

        .action-btn.close {
          background: var(--bg-secondary);
          color: var(--text-secondary);
          border: 1px solid var(--border-color);
        }

        .info-card-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 16px;
        }

        .info-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .info-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: var(--text-secondary);
        }

        .info-value {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary);
        }

        .company-preview {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .company-logo-small {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--bg-secondary), var(--border-color));
          border-radius: 10px;
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .company-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .company-name-text {
          font-weight: 600;
          color: var(--text-primary);
        }

        .company-location {
          font-size: 13px;
          color: var(--text-secondary);
        }

        /* Modal */
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }

        .modal-content {
          width: 100%;
          max-width: 520px;
          background: var(--bg-elevated);
          border-radius: 20px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 24px 0;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .modal-close {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-secondary);
          border: none;
          border-radius: 8px;
          color: var(--text-secondary);
          cursor: pointer;
        }

        .modal-close:hover {
          background: var(--border-color);
          color: var(--text-primary);
        }

        .modal-form {
          padding: 24px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary);
          margin-bottom: 8px;
        }

        .file-upload-zone {
          position: relative;
          border: 2px dashed var(--border-color);
          border-radius: 12px;
          padding: 32px;
          text-align: center;
          transition: all 0.2s;
          cursor: pointer;
        }

        .file-upload-zone:hover {
          border-color: var(--text-primary);
        }

        .file-upload-zone.has-file {
          border-style: solid;
          background: var(--bg-secondary);
        }

        .file-upload-zone input {
          position: absolute;
          inset: 0;
          opacity: 0;
          cursor: pointer;
        }

        .upload-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          color: var(--text-secondary);
        }

        .file-info {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: var(--text-primary);
          font-weight: 500;
        }

        .modal-form textarea {
          width: 100%;
          padding: 14px;
          border: 1px solid var(--border-color);
          border-radius: 10px;
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-size: 15px;
          resize: vertical;
          transition: all 0.2s;
        }

        .modal-form textarea:focus {
          outline: none;
          border-color: var(--text-primary);
          background: var(--bg-primary);
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding-top: 8px;
        }

        .btn-secondary,
        .btn-primary {
          padding: 12px 24px;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-secondary {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
        }

        .btn-secondary:hover {
          border-color: var(--text-primary);
        }

        .btn-primary {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--text-primary);
          border: none;
          color: var(--bg-primary);
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .btn-primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .btn-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid currentColor;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Responsive */
        @media (max-width: 968px) {
          .job-detail-layout {
            grid-template-columns: 1fr;
          }

          .job-detail-sidebar {
            order: -1;
          }

          .apply-card {
            position: static;
          }
        }

        @media (max-width: 600px) {
          .job-header-top {
            flex-direction: column;
            align-items: flex-start;
          }

          .job-detail-title {
            font-size: 1.5rem;
          }

          .job-title-row {
            flex-direction: column;
            align-items: flex-start;
          }

          .modal-content {
            margin: 0 16px;
          }
        }
      `}</style>
    </div>
  );
};

export default JobDetail;
