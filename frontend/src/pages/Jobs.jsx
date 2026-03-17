import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { jobsApi } from '../api/jobs';
import PageIntro from '../components/PageIntro';
import { useAuth } from '../context/AuthContext';

const EMPLOYMENT_TYPES = {
  FULL_TIME: { label: 'Full Time', color: 'var(--text-primary)', bg: 'var(--bg-secondary)' },
  PART_TIME: { label: 'Part Time', color: 'var(--text-primary)', bg: 'var(--bg-secondary)' },
  INTERNSHIP: { label: 'Internship', color: 'var(--text-primary)', bg: 'var(--bg-secondary)' },
  CONTRACT: { label: 'Contract', color: 'var(--text-primary)', bg: 'var(--bg-secondary)' },
};

const FORMAT_CONFIG = {
  ONSITE: { icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', label: 'On-site' },
  REMOTE: { icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z', label: 'Remote' },
  HYBRID: { icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4', label: 'Hybrid' },
};

const Jobs = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    query: '',
    location: '',
    job_type: ''
  });

  useEffect(() => {
    loadJobs();
  }, [page]);

  const loadJobs = async (filterParams = {}) => {
    setLoading(true);
    try {
      const params = { page, limit: 12, ...filterParams };
      Object.keys(params).forEach(key => {
        if (params[key] === '') delete params[key];
      });
      const data = await jobsApi.list(params);
      setJobs(data.items);
      setTotalPages(data.pages);
      setTotal(data.total || data.items.length);
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

  const handleClearFilters = () => {
    setFilters({ query: '', location: '', job_type: '' });
    loadJobs({});
  };

  const canCreateJob = user && (user.role === 'ALUMNI' || user.is_admin);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff} days ago`;
    if (diff < 30) return `${Math.floor(diff / 7)} weeks ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="jobs-page-container">
      <PageIntro
        eyebrow={(
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Career Opportunities
          </>
        )}
        title="Jobs"
        subtitle="Discover opportunities from the alumni network and connect with companies that value AITU talent."
        side={(
          <div className="page-intro-side-stack">
            <div className="page-intro-metrics">
              <div className="page-intro-metric">
                <span className="page-intro-metric-value">{total}+</span>
                <span className="page-intro-metric-label">Open Positions</span>
              </div>
              <div className="page-intro-metric">
                <span className="page-intro-metric-value">50+</span>
                <span className="page-intro-metric-label">Companies Hiring</span>
              </div>
              <div className="page-intro-metric">
                <span className="page-intro-metric-value">24h</span>
                <span className="page-intro-metric-label">Avg Response</span>
              </div>
            </div>

            {canCreateJob && (
              <div className="page-intro-actions">
                <button className="page-intro-button" onClick={() => navigate('/jobs/create')}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 4v16m8-8H4" />
                  </svg>
                  Post a Job
                </button>
              </div>
            )}
          </div>
        )}
      />

      {/* Search Section */}
      <section className="jobs-search-section">
        <form onSubmit={handleSearch} className="jobs-search-form">
          <div className="jobs-search-field jobs-search-main">
            <svg className="jobs-search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Job title, company, or keywords..."
              value={filters.query}
              onChange={e => setFilters({ ...filters, query: e.target.value })}
            />
          </div>

          <div className="jobs-search-field jobs-search-location">
            <svg className="jobs-search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <input
              type="text"
              placeholder="City or Remote"
              value={filters.location}
              onChange={e => setFilters({ ...filters, location: e.target.value })}
            />
          </div>

          <div className="jobs-search-field jobs-search-type">
            <svg className="jobs-search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <select
              value={filters.job_type}
              onChange={e => setFilters({ ...filters, job_type: e.target.value })}
            >
              <option value="">All Types</option>
              <option value="FULL_TIME">Full Time</option>
              <option value="PART_TIME">Part Time</option>
              <option value="INTERNSHIP">Internship</option>
              <option value="CONTRACT">Contract</option>
            </select>
          </div>

          <button type="submit" className="jobs-search-btn">
            <span>Search Jobs</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </form>

        {(filters.query || filters.location || filters.job_type) && (
          <div className="jobs-active-filters">
            <span className="jobs-filters-label">Active filters:</span>
            {filters.query && (
              <span className="jobs-filter-tag">
                "{filters.query}"
                <button onClick={() => setFilters({ ...filters, query: '' })}>×</button>
              </span>
            )}
            {filters.location && (
              <span className="jobs-filter-tag">
                {filters.location}
                <button onClick={() => setFilters({ ...filters, location: '' })}>×</button>
              </span>
            )}
            {filters.job_type && (
              <span className="jobs-filter-tag">
                {EMPLOYMENT_TYPES[filters.job_type]?.label}
                <button onClick={() => setFilters({ ...filters, job_type: '' })}>×</button>
              </span>
            )}
            <button className="jobs-clear-all" onClick={handleClearFilters}>
              Clear all
            </button>
          </div>
        )}
      </section>

      {/* Jobs Content */}
      <section className="jobs-content-section">
        {loading ? (
          <div className="jobs-loading">
            <div className="jobs-loading-grid">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="jobs-skeleton-card">
                  <div className="jobs-skeleton-header">
                    <div className="jobs-skeleton-logo" />
                    <div className="jobs-skeleton-text">
                      <div className="jobs-skeleton-title" />
                      <div className="jobs-skeleton-subtitle" />
                    </div>
                  </div>
                  <div className="jobs-skeleton-badges" />
                  <div className="jobs-skeleton-body" />
                  <div className="jobs-skeleton-footer" />
                </div>
              ))}
            </div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="jobs-empty-state">
            <div className="jobs-empty-illustration">
              <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
                <circle cx="60" cy="60" r="50" fill="var(--bg-secondary)" />
                <path d="M45 50h30v25a5 5 0 01-5 5H50a5 5 0 01-5-5V50z" fill="var(--border-color)" />
                <path d="M40 45a5 5 0 015-5h30a5 5 0 015 5v5H40v-5z" fill="var(--text-secondary)" opacity="0.5" />
                <rect x="50" y="55" width="20" height="3" rx="1.5" fill="var(--text-tertiary)" />
                <rect x="50" y="62" width="15" height="3" rx="1.5" fill="var(--text-tertiary)" />
              </svg>
            </div>
            <h3 className="jobs-empty-title">No jobs found</h3>
            <p className="jobs-empty-text">
              We couldn't find any jobs matching your criteria.
              Try adjusting your filters or check back later.
            </p>
            <div className="jobs-empty-actions">
              <button className="jobs-empty-btn-secondary" onClick={handleClearFilters}>
                Clear Filters
              </button>
              {canCreateJob && (
                <button className="jobs-empty-btn-primary" onClick={() => navigate('/jobs/create')}>
                  Post a Job
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="jobs-results-header">
              <span className="jobs-results-count">
                Showing <strong>{jobs.length}</strong> of <strong>{total}</strong> jobs
              </span>
            </div>

            <div className="jobs-grid">
              {jobs.map((job, index) => {
                const typeConfig = EMPLOYMENT_TYPES[job.employment_type] || { label: job.employment_type, color: '#6B7280', bg: 'rgba(107, 114, 128, 0.1)' };
                const formatConfig = FORMAT_CONFIG[job.format] || FORMAT_CONFIG.ONSITE;

                return (
                  <article
                    key={job.id}
                    className="job-card"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="job-card-header">
                      <div className="job-company-logo">
                        {job.company ? job.company.charAt(0).toUpperCase() : 'C'}
                      </div>
                      <div className="job-header-info">
                        <h3 className="job-title">{job.title}</h3>
                        <div className="job-company-location">
                          <span className="job-company">{job.company}</span>
                          <span className="job-dot">•</span>
                          <span className="job-location">{job.location || 'Remote'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="job-tags">
                      <span
                        className="job-type-tag"
                        style={{
                          color: typeConfig.color,
                          backgroundColor: typeConfig.bg
                        }}
                      >
                        {typeConfig.label}
                      </span>
                      <span className="job-format-tag">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d={formatConfig.icon} />
                        </svg>
                        {formatConfig.label}
                      </span>
                    </div>

                    {job.salary_range && (
                      <div className="job-salary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{job.salary_range}</span>
                      </div>
                    )}

                    {job.required_skills && job.required_skills.length > 0 && (
                      <div className="job-skills">
                        {job.required_skills.slice(0, 4).map((skill, idx) => (
                          <span key={idx} className="job-skill">{skill}</span>
                        ))}
                        {job.required_skills.length > 4 && (
                          <span className="job-skill job-skill-more">
                            +{job.required_skills.length - 4}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="job-card-footer">
                      <span className="job-posted">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        {formatDate(job.created_at)}
                      </span>
                      <Link to={`/jobs/${job.id}`} className="job-view-btn">
                        View Details
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="jobs-pagination">
                <button
                  className="jobs-page-btn"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>

                <div className="jobs-page-numbers">
                  {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }

                    return (
                      <button
                        key={i}
                        className={`jobs-page-num ${page === pageNum ? 'active' : ''}`}
                        onClick={() => setPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  className="jobs-page-btn"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <style>{`
        .jobs-page-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          gap: 24px;
          padding-bottom: 3rem;
        }

        /* Hero Section */
        .jobs-hero-section {
          position: relative;
          padding: 3rem 0;
          margin-bottom: 2rem;
          overflow: hidden;
        }

        .jobs-hero-bg {
          position: absolute;
          inset: 0;
          z-index: 0;
        }

        .jobs-hero-gradient {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg,
            rgba(0, 0, 0, 0.02) 0%,
            rgba(0, 0, 0, 0.03) 50%,
            rgba(0, 0, 0, 0.01) 100%
          );
        }

        [data-theme='dark'] .jobs-hero-gradient {
          background: linear-gradient(135deg,
            rgba(255, 255, 255, 0.02) 0%,
            rgba(255, 255, 255, 0.03) 50%,
            rgba(255, 255, 255, 0.01) 100%
          );
        }

        .jobs-hero-pattern {
          position: absolute;
          inset: 0;
          opacity: 0.4;
          background-image: radial-gradient(circle at 1px 1px, var(--border-color) 1px, transparent 0);
          background-size: 24px 24px;
        }

        .jobs-hero-content {
          position: relative;
          z-index: 1;
        }

        .jobs-hero-text {
          max-width: 640px;
          margin-bottom: 2rem;
        }

        .jobs-hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          border-radius: 100px;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
          margin-bottom: 16px;
        }

        .jobs-hero-badge svg {
          color: var(--text-primary);
        }

        .jobs-hero-title {
          font-size: 2.5rem;
          font-weight: 700;
          line-height: 1.2;
          color: var(--text-primary);
          margin: 0 0 16px;
          letter-spacing: -0.02em;
        }

        .jobs-hero-highlight {
          color: var(--text-primary);
          font-style: italic;
        }

        .jobs-hero-subtitle {
          font-size: 1.125rem;
          line-height: 1.6;
          color: var(--text-secondary);
          margin: 0;
          max-width: 480px;
        }

        .jobs-hero-stats {
          display: flex;
          align-items: center;
          gap: 24px;
          padding: 20px 24px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          width: fit-content;
        }

        .jobs-stat-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .jobs-stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .jobs-stat-label {
          font-size: 13px;
          color: var(--text-secondary);
        }

        .jobs-stat-divider {
          width: 1px;
          height: 40px;
          background: var(--border-color);
        }

        .jobs-post-btn {
          position: absolute;
          top: 3rem;
          right: 0;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          background: var(--text-primary);
          color: var(--bg-primary);
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .jobs-post-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        }

        /* Search Section */
        .jobs-search-section {
          margin-bottom: 0;
        }

        .jobs-search-form {
          display: flex;
          gap: 12px;
          padding: 16px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          box-shadow: var(--shadow-sm);
        }

        .jobs-search-field {
          position: relative;
          display: flex;
          align-items: center;
        }

        .jobs-search-main {
          flex: 2;
          min-width: 200px;
        }

        .jobs-search-location {
          flex: 1;
          min-width: 150px;
        }

        .jobs-search-type {
          flex: 1;
          min-width: 140px;
        }

        .jobs-search-icon {
          position: absolute;
          left: 14px;
          color: var(--text-tertiary);
          pointer-events: none;
        }

        .jobs-search-field input,
        .jobs-search-field select {
          width: 100%;
          min-height: 48px;
          padding: 14px 14px 14px 46px;
          border: 1px solid var(--border-color);
          border-radius: 14px;
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-size: 15px;
          transition: all 0.2s;
        }

        .jobs-search-field input:focus,
        .jobs-search-field select:focus {
          outline: none;
          border-color: var(--text-primary);
          background: var(--bg-primary);
        }

        .jobs-search-field input::placeholder {
          color: var(--text-tertiary);
        }

        .jobs-search-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: 48px;
          padding: 14px 28px;
          background: var(--text-primary);
          color: var(--bg-primary);
          border: none;
          border-radius: 14px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .jobs-search-btn:hover {
          transform: scale(1.02);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .jobs-active-filters {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
          padding: 0 4px;
        }

        .jobs-filters-label {
          font-size: 13px;
          color: var(--text-secondary);
        }

        .jobs-filter-tag {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          font-size: 13px;
          color: var(--text-primary);
        }

        .jobs-filter-tag button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          padding: 0;
          background: transparent;
          border: none;
          color: var(--text-tertiary);
          cursor: pointer;
          font-size: 14px;
        }

        .jobs-filter-tag button:hover {
          color: var(--text-primary);
        }

        .jobs-clear-all {
          padding: 6px 12px;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          text-decoration: underline;
        }

        .jobs-clear-all:hover {
          text-decoration: underline;
        }

        /* Content Section */
        .jobs-content-section {
          padding-bottom: 0;
        }

        .jobs-results-header {
          margin-bottom: 1.5rem;
        }

        .jobs-results-count {
          font-size: 14px;
          color: var(--text-secondary);
        }

        .jobs-results-count strong {
          color: var(--text-primary);
        }

        /* Jobs Grid */
        .jobs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
          gap: 20px;
        }

        /* Job Card */
        .job-card {
          display: flex;
          flex-direction: column;
          padding: 24px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          animation: fadeInUp 0.4s ease-out forwards;
          opacity: 0;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .job-card:hover {
          border-color: var(--text-secondary);
          transform: translateY(-4px);
          box-shadow: 0 20px 40px -12px rgba(0, 0, 0, 0.1);
        }

        .job-card-header {
          display: flex;
          gap: 14px;
          margin-bottom: 16px;
        }

        .job-company-logo {
          width: 52px;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--bg-secondary), var(--border-color));
          border-radius: 12px;
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-primary);
          flex-shrink: 0;
        }

        .job-header-info {
          flex: 1;
          min-width: 0;
        }

        .job-title {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .job-company-location {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: var(--text-secondary);
        }

        .job-company {
          font-weight: 500;
          color: var(--text-primary);
        }

        .job-dot {
          color: var(--text-tertiary);
        }

        .job-location {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .job-tags {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .job-type-tag {
          padding: 5px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .job-format-tag {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          font-size: 12px;
          color: var(--text-secondary);
        }

        .job-salary {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
          font-size: 15px;
          font-weight: 500;
          color: var(--text-primary);
        }

        .job-salary svg {
          color: var(--text-secondary);
        }

        .job-skills {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 20px;
        }

        .job-skill {
          padding: 4px 10px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          font-size: 12px;
          color: var(--text-secondary);
        }

        .job-skill-more {
          background: var(--bg-tertiary, var(--bg-secondary));
          color: var(--text-tertiary);
        }

        .job-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: auto;
          padding-top: 16px;
          border-top: 1px solid var(--border-subtle);
        }

        .job-posted {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: var(--text-tertiary);
        }

        .job-view-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary);
          text-decoration: none;
          transition: all 0.2s;
        }

        .job-view-btn:hover {
          background: var(--text-primary);
          color: var(--bg-primary);
          border-color: var(--text-primary);
        }

        /* Empty State */
        .jobs-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 96px 24px;
          text-align: center;
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          border-radius: 24px;
          box-shadow: var(--shadow-sm);
        }

        .jobs-empty-illustration {
          margin-bottom: 24px;
        }

        .jobs-empty-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 8px;
        }

        .jobs-empty-text {
          font-size: 15px;
          color: var(--text-secondary);
          margin: 0 0 24px;
          max-width: 400px;
        }

        .jobs-empty-actions {
          display: flex;
          gap: 12px;
        }

        .jobs-empty-btn-secondary,
        .jobs-empty-btn-primary {
          padding: 12px 24px;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .jobs-empty-btn-secondary {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
        }

        .jobs-empty-btn-secondary:hover {
          border-color: var(--text-primary);
        }

        .jobs-empty-btn-primary {
          background: var(--text-primary);
          border: none;
          color: var(--bg-primary);
        }

        .jobs-empty-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        /* Loading State */
        .jobs-loading-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
          gap: 20px;
        }

        .jobs-skeleton-card {
          padding: 24px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          border-radius: 16px;
        }

        .jobs-skeleton-header {
          display: flex;
          gap: 14px;
          margin-bottom: 16px;
        }

        .jobs-skeleton-logo {
          width: 52px;
          height: 52px;
          background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--border-color) 50%, var(--bg-secondary) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 12px;
        }

        .jobs-skeleton-text {
          flex: 1;
        }

        .jobs-skeleton-title {
          width: 70%;
          height: 20px;
          background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--border-color) 50%, var(--bg-secondary) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 4px;
          margin-bottom: 8px;
        }

        .jobs-skeleton-subtitle {
          width: 50%;
          height: 16px;
          background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--border-color) 50%, var(--bg-secondary) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 4px;
        }

        .jobs-skeleton-badges {
          width: 40%;
          height: 28px;
          background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--border-color) 50%, var(--bg-secondary) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 6px;
          margin-bottom: 16px;
        }

        .jobs-skeleton-body {
          width: 100%;
          height: 60px;
          background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--border-color) 50%, var(--bg-secondary) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .jobs-skeleton-footer {
          width: 60%;
          height: 20px;
          background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--border-color) 50%, var(--bg-secondary) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 4px;
        }

        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* Pagination */
        .jobs-pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          margin-top: 3rem;
        }

        .jobs-page-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 18px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.2s;
        }

        .jobs-page-btn:hover:not(:disabled) {
          border-color: var(--text-primary);
        }

        .jobs-page-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .jobs-page-numbers {
          display: flex;
          gap: 4px;
        }

        .jobs-page-num {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s;
        }

        .jobs-page-num:hover {
          background: var(--bg-secondary);
          color: var(--text-primary);
        }

        .jobs-page-num.active {
          background: var(--text-primary);
          color: var(--bg-primary);
        }

        /* Responsive */
        @media (max-width: 968px) {
          .jobs-hero-title {
            font-size: 2rem;
          }

          .jobs-hero-stats {
            flex-wrap: wrap;
          }

          .jobs-stat-divider {
            display: none;
          }

          .jobs-post-btn {
            position: static;
            margin-top: 1.5rem;
            width: fit-content;
          }

          .jobs-hero-content {
            display: flex;
            flex-direction: column;
          }

          .jobs-search-form {
            flex-direction: column;
          }

          .jobs-search-main,
          .jobs-search-location,
          .jobs-search-type {
            min-width: 100%;
          }

          .jobs-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 480px) {
          .jobs-hero-section {
            padding: 2rem 0;
          }

          .jobs-hero-title {
            font-size: 1.75rem;
          }

          .jobs-hero-stats {
            padding: 16px;
          }

          .jobs-stat-value {
            font-size: 1.25rem;
          }

          .job-card {
            padding: 20px;
          }

          .jobs-pagination {
            flex-wrap: wrap;
          }

          .jobs-page-numbers {
            order: -1;
            width: 100%;
            justify-content: center;
            margin-bottom: 12px;
          }
        }
      `}</style>
    </div>
  );
};

export default Jobs;
