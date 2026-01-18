import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { jobsApi } from '../api/jobs';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const Jobs = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    query: '',
    location: '',
    job_type: ''
  });

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async (filterParams = {}) => {
    setLoading(true);
    try {
      const data = await jobsApi.list(filterParams);
      setJobs(data.items);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    // Remove empty filters
    const activeFilters = Object.fromEntries(
      Object.entries(filters).filter(([_, v]) => v)
    );
    loadJobs(activeFilters);
  };

  return (
    <div className="page-container p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Jobs & Opportunities</h1>
          <p className="text-gray-600">Find your next role or hire talent.</p>
        </div>
        <Button onClick={() => navigate('/jobs/create')}>Post a Job</Button>
      </div>

      {/* Filters */}
      <Card className="mb-6 p-4">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium mb-1">Search</label>
            <input
              type="text"
              placeholder="Title, Company, or Keywords"
              className="w-full border rounded p-2"
              value={filters.query}
              onChange={e => setFilters({ ...filters, query: e.target.value })}
            />
          </div>
          <div className="w-[200px]">
            <label className="block text-sm font-medium mb-1">Location</label>
            <input
              type="text"
              placeholder="City, Remote..."
              className="w-full border rounded p-2"
              value={filters.location}
              onChange={e => setFilters({ ...filters, location: e.target.value })}
            />
          </div>
          <div className="w-[150px]">
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              className="w-full border rounded p-2"
              value={filters.job_type}
              onChange={e => setFilters({ ...filters, job_type: e.target.value })}
            >
              <option value="">All</option>
              <option value="FULL_TIME">Full Time</option>
              <option value="PART_TIME">Part Time</option>
              <option value="INTERNSHIP">Internship</option>
              <option value="CONTRACT">Contract</option>
            </select>
          </div>
          <Button type="submit" variant="secondary">Filter</Button>
        </form>
      </Card>

      {/* List */}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="grid gap-4">
          {jobs.length === 0 ? (
            <div className="text-center py-10 text-gray-500">No jobs found.</div>
          ) : (
            jobs.map(job => (
              <Card key={job.id} className="hover:shadow-md transition-shadow">
                <div className="flex justify-between">
                  <div onClick={() => navigate(`/jobs/${job.id}`)} className="cursor-pointer">
                    <h3 className="text-xl font-semibold text-primary">{job.title}</h3>
                    <p className="font-medium">{job.company}</p>
                    <div className="flex gap-2 mt-2 text-sm text-gray-600">
                      <span>📍 {job.location || 'Remote'}</span>
                      <span>💼 {job.employment_type.replace('_', ' ')}</span>
                      <span>💰 {job.salary_range || 'Salary N/A'}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-between">
                    <span className="text-xs text-gray-400">
                      Posted {new Date(job.created_at).toLocaleDateString()}
                    </span>
                    <Link to={`/jobs/${job.id}`} className="text-primary hover:underline">View Details &rarr;</Link>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Jobs;
