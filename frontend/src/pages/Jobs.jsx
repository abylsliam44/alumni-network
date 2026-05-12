import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { jobsApi } from '../api/jobs';
import { useAuth } from '../hooks/useAuth';
import { canPostJobs } from '../utils/jobPermissions';
import Pill from '../components/ui/Pill';
import Icon from '../components/ui/Icon';

const EMPLOYMENT_LABEL = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  INTERNSHIP: 'Internship',
  CONTRACT: 'Contract',
};

const STATUS_TONE = {
  DRAFT: undefined,
  PENDING: 'warm',
  APPROVED: 'ok',
  REJECTED: 'err',
  CLOSED: undefined,
};

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff}d ago`;
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const Jobs = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ query: '', location: '', job_type: '' });

  useEffect(() => { loadJobs(); /* eslint-disable-line */ }, [page]);

  const loadJobs = async (filterParams = {}) => {
    setLoading(true);
    try {
      const params = { page, limit: 12, ...filterParams };
      Object.keys(params).forEach((k) => { if (params[k] === '') delete params[k]; });
      const data = await jobsApi.list(params);
      setJobs(data.items || []);
      setTotalPages(data.pages || 1);
      setTotal(data.total || (data.items || []).length);
    } catch (err) { console.error('Failed to load jobs', err); }
    finally { setLoading(false); }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    const active = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    loadJobs(active);
  };

  const handleClearFilters = () => {
    setFilters({ query: '', location: '', job_type: '' });
    setPage(1);
    loadJobs({});
  };

  const canCreateJob = canPostJobs(user);
  const activeFilters = Object.values(filters).filter(Boolean).length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            JOBS · {total} OPEN POSITION{total === 1 ? '' : 'S'}
          </div>
          <h1 className="h1">
            Hand-picked from <i>alumni-led teams</i>.
          </h1>
        </div>
        <div className="page-head-actions">
          {canCreateJob && (
            <button className="btn primary" onClick={() => navigate('/jobs/create')}>
              <Icon name="plus" size={12} /> Post a job
            </button>
          )}
        </div>
      </div>

      <div className="panel" style={{ padding: 16, marginBottom: 20 }}>
        <form onSubmit={handleSearch} className="filter-grid jobs">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Search</label>
            <input type="search" value={filters.query} onChange={(e) => setFilters({ ...filters, query: e.target.value })} placeholder="Title, company, skills…" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Location</label>
            <input type="text" value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })} placeholder="Almaty, remote…" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Type</label>
            <select value={filters.job_type} onChange={(e) => setFilters({ ...filters, job_type: e.target.value })}>
              <option value="">All</option>
              {Object.entries(EMPLOYMENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <button type="submit" className="btn primary"><Icon name="search" size={12} /> Search</button>
          {activeFilters > 0 && <button type="button" className="btn ghost" onClick={handleClearFilters}>Clear</button>}
        </form>
      </div>

      {loading ? (
        <div className="loading-block">Loading jobs…</div>
      ) : jobs.length === 0 ? (
        <div className="empty-block">
          <Icon name="briefcase" size={28} />
          <h3>No jobs found</h3>
          <p>Try adjusting your filters or check back later for new postings.</p>
          {canCreateJob && (
            <button className="btn primary" onClick={() => navigate('/jobs/create')}>
              <Icon name="plus" size={12} /> Post a job
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="responsive-card-grid">
            {jobs.map((job) => (
              <Link key={job.id} to={`/jobs/${job.id}`} className="panel" style={{ padding: 16, textDecoration: 'none', color: 'var(--ink)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg-2)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                    {(job.company || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="h3">{job.title}</div>
                    <div className="mute" style={{ fontSize: 12.5, marginTop: 2 }}>{job.company} · {job.location || 'Remote'}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {job.employment_type && <Pill tone="blue" dot>{EMPLOYMENT_LABEL[job.employment_type] || job.employment_type}</Pill>}
                  {job.format && <Pill>{job.format === 'REMOTE' ? 'Remote' : job.format === 'HYBRID' ? 'Hybrid' : 'On-site'}</Pill>}
                  {job.salary_range && <Pill tone="warm">{job.salary_range}</Pill>}
                  {job.status && job.status !== 'APPROVED' && <Pill tone={STATUS_TONE[job.status]} dot>{job.status}</Pill>}
                </div>

                {job.description && (
                  <p className="dim" style={{ fontSize: 12.5, lineHeight: 1.5, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {job.description}
                  </p>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--line-soft)', paddingTop: 10, marginTop: 'auto' }}>
                  <span className="mono mute" style={{ fontSize: 10.5 }}>{job.created_at ? formatDate(job.created_at) : ''}</span>
                  <span className="mono" style={{ fontSize: 10.5, color: 'var(--blue)' }}>View → </span>
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 24 }}>
              <button className="btn sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
                <Icon name="chevronL" size={12} /> Prev
              </button>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', alignSelf: 'center', padding: '0 12px' }}>
                Page {page} / {totalPages}
              </span>
              <button className="btn sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
                Next <Icon name="chevronR" size={12} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Jobs;
