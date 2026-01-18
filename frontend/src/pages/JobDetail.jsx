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
    <div className="page-container p-4">
      <Button variant="ghost" onClick={() => navigate('/jobs')}>&larr; Back to Jobs</Button>

      <Card className="mt-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">{job.title}</h1>
            <p className="text-lg text-gray-600">{job.company} • {job.location}</p>
            <div className="flex gap-2 mt-2">
              <span className="badge">{job.format}</span>
              <span className="badge">{job.employment_type}</span>
              <span className={`badge ${job.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100'}`}>
                {job.status}
              </span>
            </div>
          </div>
          {/* Actions for Creator/Admin */}
          <div className="flex flex-col gap-2">
            {isCreator && job.status === 'DRAFT' && (
              <Button onClick={() => handleStatusChange('SUBMIT')}>Submit for Approval</Button>
            )}
            {isAdmin && job.status === 'PENDING' && (
              <>
                <Button onClick={() => handleStatusChange('APPROVE')} className="bg-green-600 text-white">Approve</Button>
                <Button onClick={() => handleStatusChange('REJECT')} variant="secondary">Reject</Button>
              </>
            )}
            {(isCreator || isAdmin) && job.status === 'APPROVED' && (
              <Button onClick={() => handleStatusChange('CLOSE')} variant="danger">Close Job</Button>
            )}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <h3 className="font-semibold">Description</h3>
            <p className="whitespace-pre-wrap">{job.description}</p>
          </div>

          {job.required_skills && job.required_skills.length > 0 && (
            <div>
              <h3 className="font-semibold">Required Skills</h3>
              <div className="flex gap-2 flex-wrap">
                {job.required_skills.map(skill => (
                  <span key={skill} className="px-2 py-1 bg-gray-100 rounded text-sm">{skill}</span>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="font-semibold">Salary</h3>
            <p>{job.salary_range || 'Not specified'}</p>
          </div>
        </div>

        {/* Applicant Section */}
        {canApply && (
          <div className="mt-8 pt-6 border-t">
            <Button size="lg" onClick={() => setShowApplyModal(true)}>Apply Now</Button>
          </div>
        )}

        {application && (
          <div className="mt-8 pt-6 border-t bg-blue-50 p-4 rounded">
            <h3 className="font-semibold text-blue-800">Application Status: {application.status}</h3>
            <p>Applied on {new Date(application.applied_at).toLocaleDateString()}</p>
            <div className="mt-4">
              <ApplicationChat applicationId={application.id} />
            </div>
          </div>
        )}
      </Card>

      {/* Applications List for Creator */}
      {(isCreator || isAdmin) && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Applications ({job.applications_count})</h2>
          {/* Note: In real app, fetch list of apps here or link to dashboard */}
          <p>Applications management usage is to be implemented in dashboard.</p>
        </div>
      )}

      {/* Apply Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Apply to {job.title}</h2>
            <form onSubmit={handleApply} className="space-y-4">
              <div>
                <label className="block mb-1 font-medium">Resume (PDF)</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={e => setResumeFile(e.target.files[0])}
                  required
                />
              </div>
              <div>
                <label className="block mb-1 font-medium">Cover Letter (Optional)</label>
                <textarea
                  className="w-full border rounded p-2"
                  rows={4}
                  value={coverLetter}
                  onChange={e => setCoverLetter(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setShowApplyModal(false)}>Cancel</Button>
                <Button type="submit" disabled={uploading}>
                  {uploading ? 'Uploading...' : 'Submit Application'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobDetail;
