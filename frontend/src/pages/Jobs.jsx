import { useEffect, useState } from 'react';
import { jobsApi } from '../api/jobs';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const Jobs = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await jobsApi.list({ limit: 20 });
      setJobs(data.items);
    } finally {
      setLoading(false);
    }
  };

  const apply = async (id) => {
    try {
      await jobsApi.apply(id, { cover_letter: 'Interested in this role' });
      alert('Application submitted');
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to apply');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Jobs & opportunities</h1>
        <p>Browse roles posted by alumni and companies.</p>
      </div>
      {loading ? (
        <div className="loading-spinner">Loading jobs...</div>
      ) : (
        <div className="grid-vertical">
          {jobs.map((job) => (
            <Card key={job.id}>
              <div className="card-top">
                <div>
                  <p className="eyebrow">{job.company}</p>
                  <h3>{job.title}</h3>
                  <p className="text-secondary">{job.location || 'Remote'}</p>
                </div>
                <Button variant="primary" onClick={() => apply(job.id)}>View & Apply</Button>
              </div>
              <div className="card-meta">
                <span>{job.job_type}</span>
                {job.salary_range && <span>{job.salary_range}</span>}
                <span>{job.applications_count} applications</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Jobs;

