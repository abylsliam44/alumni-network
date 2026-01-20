import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { jobsApi } from '../api/jobs';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import ApplicationChat from '../components/ApplicationChat';
import axios from 'axios';

const JobDetail = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState(null); // My application
  const [showApplyModal, setShowApplyModal] = useState(false);

  // Apply Form State
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
      // 1. Get Presigned URL
      const { upload_url, file_url } = await jobsApi.getPresignedUrl(resumeFile.name, resumeFile.type);

      // 2. Upload to MinIO
      await axios.put(upload_url, resumeFile, {
        headers: { 'Content-Type': resumeFile.type }
      });

      // 3. Submit Application
      await jobsApi.apply(jobId, {
        resume_url: file_url,
        cover_letter: coverLetter
      });

      setShowApplyModal(false);
      fetchMyApplication();
      fetchJob(); // Update count
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

  if (loading) return <div>Loading...</div>;
  if (!job) return <div>Job not found</div>;

  const isCreator = user.id === job.created_by;
  const isAdmin = user.is_admin || (user.system_roles && user.system_roles.includes('JOB_MODERATOR'));
  const canApply = !isCreator && !isAdmin && !application && job.status === 'APPROVED';

  return (
    <div className="page job-detail-page">
      {/* Hero Section */}
      <div className="job-hero">
        <div className="hero-content">
          <Button variant="ghost" className="back-btn" onClick={() => navigate('/jobs')}>
            &larr; Back to Jobs
          </Button>
          <div className="hero-header">
            <div className="company-logo-large">
              {job.company.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="hero-title">{job.title}</h1>
              <div className="hero-meta">
                <span className="company-name">{job.company}</span>
                <span className="dot">•</span>
                <span>{job.location}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="job-content-container">
        <div className="job-main">
          {/* Application Status Banner */}
          {application && (
            <div className="status-banner">
              <h3>Application Status: <span className={`status-${application.status.toLowerCase()}`}>{application.status}</span></h3>
              <p>Applied on {new Date(application.applied_at).toLocaleDateString()}</p>
            </div>
          )}

          <div className="job-section elevated">
            <h2 className="section-title">Description</h2>
            <p className="job-description">{job.description}</p>
          </div>

          {job.required_skills && job.required_skills.length > 0 && (
            <div className="job-section elevated">
              <h2 className="section-title">Required Skills</h2>
              <div className="skills-grid">
                {job.required_skills.map(skill => (
                  <span key={skill} className="skill-pill large">{skill}</span>
                ))}
              </div>
            </div>
          )}

          {application && (
            <div className="job-section elevated">
              <h2 className="section-title">Application Chat</h2>
              <ApplicationChat applicationId={application.id} />
            </div>
          )}
        </div>

        <div className="job-sidebar">
          <div className="sidebar-card elevated">
            {/* Action Buttons */}
            {canApply && (
              <Button className="btn-primary w-full mb-4" size="lg" onClick={() => setShowApplyModal(true)}>
                Apply Now
              </Button>
            )}

            {/* Creator/Admin Actions */}
            {(isCreator || isAdmin) && (
              <div className="admin-actions">
                {isCreator && job.status === 'DRAFT' && (
                  <Button className="w-full mb-2" onClick={() => handleStatusChange('SUBMIT')}>Submit for Approval</Button>
                )}
                {isAdmin && job.status === 'PENDING' && (
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <Button onClick={() => handleStatusChange('APPROVE')} className="bg-green-600 text-white">Approve</Button>
                    <Button onClick={() => handleStatusChange('REJECT')} variant="secondary">Reject</Button>
                  </div>
                )}
                {(isCreator || isAdmin) && job.status === 'APPROVED' && (
                  <Button onClick={() => handleStatusChange('CLOSE')} variant="danger" className="w-full">Close Job</Button>
                )}
              </div>
            )}

            <div className="sidebar-info">
              <div className="info-item">
                <span className="label">Employment Type</span>
                <span className="value">{job.employment_type?.replace('_', ' ')}</span>
              </div>
              <div className="info-item">
                <span className="label">Format</span>
                <span className="value">{job.format}</span>
              </div>
              <div className="info-item">
                <span className="label">Salary</span>
                <span className="value">{job.salary_range || 'Not specified'}</span>
              </div>
              <div className="info-item">
                <span className="label">Posted Date</span>
                <span className="value">{new Date(job.created_at).toLocaleDateString()}</span>
              </div>
              <div className="info-item">
                <span className="label">Status</span>
                <span className={`status-badge ${job.status.toLowerCase()}`}>{job.status}</span>
              </div>
            </div>
          </div>

          {(isCreator || isAdmin) && (
            <div className="sidebar-card elevated mt-4">
              <h3 className="font-bold mb-2">Internal Stats</h3>
              <p>{job.applications_count} Applications</p>
            </div>
          )}
        </div>
      </div>

      {/* Apply Modal */}
      {showApplyModal && (
        <div className="modal-overlay">
          <div className="modal-content elevated">
            <h2 className="modal-title">Apply to {job.title}</h2>
            <form onSubmit={handleApply} className="apply-form">
              <div className="form-group">
                <label>Resume (PDF)</label>
                <div className="file-input-wrapper">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={e => setResumeFile(e.target.files[0])}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Cover Letter (Optional)</label>
                <textarea
                  rows={4}
                  value={coverLetter}
                  onChange={e => setCoverLetter(e.target.value)}
                  placeholder="Tell us why you're a good fit..."
                />
              </div>
              <div className="modal-actions">
                <Button type="button" variant="ghost" onClick={() => setShowApplyModal(false)}>Cancel</Button>
                <Button type="submit" className="btn-primary" disabled={uploading}>
                  {uploading ? 'Uploading...' : 'Submit Application'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .job-detail-page {
           background: var(--bg-primary);
           min-height: 100vh;
           padding-bottom: 4rem;
        }

        .job-hero {
           background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-primary) 100%);
           border-bottom: 1px solid var(--border-subtle);
           padding: 2rem 0 3rem;
           margin-bottom: -2rem;
        }

        .hero-content {
           max-width: 1200px;
           margin: 0 auto;
           padding: 0 1.5rem;
        }

        .back-btn { margin-bottom: 1.5rem; padding-left: 0; color: var(--text-secondary); }
        .back-btn:hover { color: var(--accent-primary); background: transparent; }

        .hero-header {
           display: flex;
           gap: 1.5rem;
           align-items: center;
        }

        .company-logo-large {
           width: 80px;
           height: 80px;
           background: var(--bg-elevated);
           border-radius: 20px;
           display: flex;
           align-items: center;
           justify-content: center;
           font-size: 2.5rem;
           font-weight: 800;
           color: var(--accent-primary);
           box-shadow: var(--shadow-md);
           border: 1px solid var(--border-subtle);
        }

        .hero-title {
           font-size: 2.5rem;
           font-weight: 800;
           margin: 0 0 0.5rem;
           color: var(--text-primary);
        }

        .hero-meta {
           display: flex;
           align-items: center;
           gap: 0.75rem;
           font-size: 1.1rem;
           color: var(--text-secondary);
        }
        .company-name { font-weight: 600; color: var(--text-primary); }
        .dot { color: var(--text-tertiary); }

        .job-content-container {
           max-width: 1200px;
           margin: 0 auto;
           padding: 0 1.5rem;
           display: grid;
           grid-template-columns: 1fr 350px;
           gap: 2rem;
           position: relative;
           z-index: 10;
        }

        .job-section {
           background: var(--bg-elevated);
           padding: 2rem;
           border-radius: 16px;
           border: 1px solid var(--border-subtle);
           margin-bottom: 2rem;
        }

        .section-title {
           font-size: 1.25rem;
           font-weight: 700;
           margin-bottom: 1.5rem;
           color: var(--text-primary);
        }

        .job-description {
           white-space: pre-wrap;
           line-height: 1.7;
           color: var(--text-secondary);
        }

        .skills-grid {
           display: flex;
           flex-wrap: wrap;
           gap: 0.75rem;
        }

        .skill-pill.large {
           padding: 0.5rem 1rem;
           font-size: 0.9rem;
           background: var(--bg-secondary);
           border-radius: 8px;
           border: 1px solid var(--border-color);
        }

        .status-banner {
           background: var(--accent-light-alpha);
           border: 1px solid var(--accent-light);
           padding: 1.5rem;
           border-radius: 12px;
           margin-bottom: 2rem;
        }
        .status-approved { color: var(--accent-green); }
        .status-rejected { color: var(--accent-red); }
        .status-pending { color: var(--accent-orange); }

        .sidebar-card {
           background: var(--bg-elevated);
           padding: 1.5rem;
           border-radius: 16px;
           border: 1px solid var(--border-subtle);
           position: sticky;
           top: 2rem;
        }

        .sidebar-info {
           display: flex;
           flex-col;
           gap: 1.25rem;
           margin-top: 1.5rem;
           padding-top: 1.5rem;
           border-top: 1px solid var(--border-subtle);
        }

        .info-item {
           display: flex;
           flex-direction: column;
           gap: 0.25rem;
        }

        .label { font-size: 0.85rem; color: var(--text-secondary); font-weight: 500; }
        .value { font-size: 1rem; color: var(--text-primary); font-weight: 600; }

        .modal-overlay {
           position: fixed;
           inset: 0;
           background: rgba(0,0,0,0.6);
           backdrop-filter: blur(4px);
           z-index: 1000;
           display: flex;
           align-items: center;
           justify-content: center;
           padding: 1rem;
        }

        .modal-content {
           background: var(--bg-elevated);
           width: 100%;
           max-width: 500px;
           padding: 2rem;
           border-radius: 20px;
        }

        .apply-form .form-group { margin-bottom: 1.5rem; }
        .apply-form label { display: block; margin-bottom: 0.5rem; font-weight: 600; }
        .apply-form textarea, .apply-form input[type="file"] {
           width: 100%;
           padding: 0.75rem;
           border-radius: 8px;
           background: var(--bg-secondary);
           border: 1px solid var(--border-color);
        }

        .modal-actions { display: flex; justify-content: flex-end; gap: 1rem; }

        @media (max-width: 768px) {
           .job-content-container { grid-template-columns: 1fr; }
           .sidebar-card { position: static; }
           .hero-header { flex-direction: column; text-align: center; }
        }
      `}</style>
    </div>
  );
};

export default JobDetail;
