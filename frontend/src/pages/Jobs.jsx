import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { jobsApi } from '../api/jobs';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const EMPLOYMENT_TYPES = {
  FULL_TIME: { label: 'Full Time', color: 'var(--accent-blue)' },
  PART_TIME: { label: 'Part Time', color: 'var(--accent-green)' },
  INTERNSHIP: { label: 'Internship', color: 'var(--accent-purple)' },
  CONTRACT: { label: 'Contract', color: 'var(--accent-orange)' },
};

const FORMAT_ICONS = {
  ONSITE: '🏢',
  REMOTE: '🌐',
  HYBRID: '🔄',
};

const Jobs = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    query: '',
    location: '',
    employment_type: ''
  });

  useEffect(() => {
    loadJobs();
  }, [page]);

  const loadJobs = async (filterParams = {}) => {
    setLoading(true);
    try {
      const params = { page, limit: 12, ...filterParams };
      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (params[key] === '') delete params[key];
      });
      const data = await jobsApi.list(params);
      setJobs(data.items);
      setTotalPages(data.pages);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const activeFilters = Object.fromEntries(
      Object.entries(filters).filter(([_, v]) => v)
    );
    loadJobs(activeFilters);
  };

  const canCreateJob = user && (user.role === 'ALUMNI' || user.is_admin);

  return (
    <div className="page jobs-page">
      <div className="jobs-hero">
        <div className="hero-content">
          <h1>Find Your Dream Job</h1>
          <p>Discover opportunities, internships, and career paths with our alumni network.</p>
        </div>
        <div className="hero-actions">
          {canCreateJob && (
            <Button
              className="btn-primary"
              onClick={() => navigate('/jobs/create')}
            >
              + Post a Job
            </Button>
          )}
        </div>
      </div>

      {/* Modern Filter Bar */}
      <div className="jobs-filters-bar elevated">
        <form onSubmit={handleSearch} className="filters-container">
          <div className="search-wrapper">
            <input
              type="text"
              placeholder="Search by title, company, or keywords..."
              value={filters.query}
              onChange={e => setFilters({ ...filters, query: e.target.value })}
              className="filter-input-text"
            />
          </div>

          <div className="location-wrapper">
            <input
              type="text"
              placeholder="Location (e.g. London)"
              value={filters.location}
              onChange={e => setFilters({ ...filters, location: e.target.value })}
              className="filter-input-text"
            />
          </div>

          <div className="select-wrapper">
            <select
              value={filters.employment_type}
              onChange={e => setFilters({ ...filters, employment_type: e.target.value })}
              className="filter-select"
            >
              <option value="">All Types</option>
              <option value="FULL_TIME">Full Time</option>
              <option value="PART_TIME">Part Time</option>
              <option value="INTERNSHIP">Internship</option>
              <option value="CONTRACT">Contract</option>
            </select>
          </div>

          <Button type="submit" className="btn-primary btn-search">
            Search
          </Button>
        </form>
      </div>

      {/* Jobs List */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading jobs...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="empty-state-card elevated">
          <div className="empty-icon">💼</div>
          <h3>No jobs found</h3>
          <p>
            No job postings match your criteria. Try adjusting filters.
          </p>
          {canCreateJob && (
            <Button className="btn-secondary" onClick={() => navigate('/jobs/create')}>
              Post a Job
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="jobs-grid">
            {jobs.map(job => {
              const initial = job.company ? job.company.charAt(0).toUpperCase() : 'C';
              return (
                <Card key={job.id} className="job-card-modern elevated">
                  <div className="job-header">
                    <div className="company-logo-placeholder">
                      {initial}
                    </div>
                    <div className="job-header-text">
                      <h3 className="job-title" title={job.title}>{job.title}</h3>
                      <div className="company-row">
                        <span className="company-name">{job.company}</span>
                        <span className="dot">•</span>
                        <span className="location">{job.location || 'Remote'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="job-badges">
                    <span
                      className="job-type-pill"
                      style={{
                        color: EMPLOYMENT_TYPES[job.employment_type]?.color || 'var(--text-secondary)',
                        backgroundColor: `${EMPLOYMENT_TYPES[job.employment_type]?.color || '#666'}15`
                      }}
                    >
                      {EMPLOYMENT_TYPES[job.employment_type]?.label || job.employment_type?.replace('_', ' ')}
                    </span>
                    <span className="format-pill">
                      {FORMAT_ICONS[job.format]} {job.format === 'ONSITE' ? 'On-site' : job.format === 'HYBRID' ? 'Hybrid' : 'Remote'}
                    </span>
                  </div>

                  <div className="job-salary">
                    {job.salary_range ? (
                      <>
                        <span className="salary-icon">💰</span>
                        {job.salary_range}
                      </>
                    ) : (
                      <span className="text-tertiary">Salary not specified</span>
                    )}
                  </div>

                  <div className="job-skills-list">
                    {job.required_skills && job.required_skills.slice(0, 3).map((skill, idx) => (
                      <span key={idx} className="skill-pill">{skill}</span>
                    ))}
                    {job.required_skills && job.required_skills.length > 3 && (
                      <span className="skill-pill more">+{job.required_skills.length - 3}</span>
                    )}
                  </div>

                  <div className="job-footer">
                    <span className="posted-date">
                      {new Date(job.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    <Link to={`/jobs/${job.id}`} className="view-link">
                      Details
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <Button
                className="btn-secondary btn-sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </Button>
              <span className="page-info">Page {page} of {totalPages}</span>
              <Button
                className="btn-secondary btn-sm"
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <style>{`
        .jobs-page {
          /* Layout handled by AppShell */
        }

        /* Hero */
        .jobs-hero {
          background: var(--bg-primary);
          padding: 2rem 0;
          margin-bottom: 2rem;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 1px solid var(--border-color);
        }
        
        .hero-content h1 {
          font-size: 1.875rem;
          font-weight: 700;
          margin: 0 0 0.5rem;
          color: var(--text-primary);
        }
        
        .hero-content p {
          font-size: 1rem;
          color: var(--text-secondary);
        }

        .hero-actions {
          display: flex;
          gap: 1rem;
        }

        /* Filter Bar */
        .jobs-filters-bar {
           background: var(--bg-elevated);
           padding: 1rem;
           border-radius: 16px;
           margin-bottom: 2.5rem;
           border: 1px solid var(--border-subtle);
        }

        .filters-container {
           display: flex;
           gap: 1rem;
           align-items: center;
           flex-wrap: wrap;
        }

        .search-wrapper, .location-wrapper {
           flex: 2;
           min-width: 200px;
        }

        .filter-input-text {
           width: 100%;
           padding: 0.75rem 1rem;
           border-radius: 12px;
           border: 1px solid var(--border-color);
           background: var(--bg-secondary);
           transition: all 0.2s;
        }
        
        .filter-input-text:focus {
           background: var(--bg-primary);
           border-color: var(--accent-primary);
           outline: none;
           box-shadow: 0 0 0 3px var(--accent-light);
        }

        .select-wrapper {
           flex: 1;
           min-width: 150px;
        }

        .filter-select {
           width: 100%;
           padding: 0.75rem 1rem;
           border-radius: 12px;
           border: 1px solid var(--border-color);
           background: var(--bg-secondary);
           color: var(--text-primary);
        }
        
        .btn-search {
           padding: 0.75rem 2rem;
           border-radius: 12px;
        }

        /* Jobs Grid */
        .jobs-grid {
           display: grid;
           grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
           gap: 1.5rem;
        }

        .job-card-modern {
           padding: 1.5rem;
           border-radius: 16px;
           background: var(--bg-elevated);
           border: 1px solid var(--border-subtle);
           transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
           display: flex;
           flex-direction: column;
           position: relative;
        }

        .job-card-modern:hover {
           transform: translateY(-5px);
           box-shadow: 0 20px 40px -5px rgba(0,0,0,0.1);
           border-color: var(--accent-hover);
        }

        .job-header {
           display: flex;
           gap: 1rem;
           margin-bottom: 1rem;
        }

        .company-logo-placeholder {
           width: 48px;
           height: 48px;
           background: linear-gradient(135deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%);
           border-radius: 12px;
           display: flex;
           align-items: center;
           justify-content: center;
           font-size: 1.5rem;
           font-weight: 700;
           color: var(--text-secondary);
           border: 1px solid var(--border-color);
        }

        .job-header-text {
           flex: 1;
           min-width: 0;
        }

        .job-title {
           font-size: 1.15rem;
           font-weight: 700;
           margin: 0 0 0.25rem;
           white-space: nowrap;
           overflow: hidden;
           text-overflow: ellipsis;
        }

        .company-row {
           display: flex;
           align-items: center;
           gap: 0.5rem;
           font-size: 0.9rem;
           color: var(--text-secondary);
        }
        
        .company-name { font-weight: 500; color: var(--text-primary); }
        .dot { color: var(--text-tertiary); }
        .location { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .job-badges {
           display: flex;
           gap: 0.5rem;
           margin-bottom: 1rem;
           flex-wrap: wrap;
        }

        .job-type-pill {
           font-size: 0.7rem;
           font-weight: 700;
           padding: 0.2rem 0.6rem;
           border-radius: 6px;
           text-transform: uppercase;
        }
        
        .format-pill {
           font-size: 0.75rem;
           padding: 0.2rem 0.6rem;
           border-radius: 6px;
           background: var(--bg-secondary);
           color: var(--text-secondary);
           border: 1px solid var(--border-color);
        }

        .job-salary {
           font-size: 0.9rem;
           font-weight: 500;
           color: var(--text-primary);
           margin-bottom: 1rem;
           display: flex;
           align-items: center;
           gap: 0.5rem;
        }
        .salary-icon { font-size: 1.1rem; }
        .text-tertiary { color: var(--text-tertiary); font-weight: 400; }

        .job-skills-list {
           display: flex;
           gap: 0.5rem;
           margin-bottom: 1.5rem;
           flex-wrap: wrap;
        }

        .skill-pill {
           font-size: 0.75rem;
           padding: 0.25rem 0.75rem;
           background: var(--bg-secondary);
           border-radius: 20px;
           color: var(--text-secondary);
           border: 1px solid var(--border-color);
        }
        .skill-pill.more {
           background: var(--bg-tertiary);
           color: var(--text-tertiary);
        }

        .job-footer {
           margin-top: auto;
           display: flex;
           justify-content: space-between;
           align-items: center;
           padding-top: 1rem;
           border-top: 1px solid var(--border-subtle);
        }

        .posted-date {
           font-size: 0.8rem;
           color: var(--text-tertiary);
        }

        .view-link {
           font-size: 0.9rem;
           font-weight: 600;
           color: var(--accent-primary);
           text-decoration: none;
        }
        .view-link:hover { text-decoration: underline; }

        .empty-state-card { text-align: center; padding: 4rem; border-radius: 20px; background: var(--bg-elevated); }
        .empty-icon { font-size: 3rem; margin-bottom: 1rem; }

        .pagination { display: flex; justify-content: center; gap: 1rem; margin-top: 2rem; align-items: center; }
        .page-info { color: var(--text-secondary); font-size: 0.9rem; }

        @media (max-width: 768px) {
           .jobs-hero { flex-direction: column; align-items: flex-start; gap: 1.5rem; }
           .filters-container { flex-direction: column; align-items: stretch; }
           .search-wrapper, .location-wrapper, .select-wrapper { min-width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default Jobs;
