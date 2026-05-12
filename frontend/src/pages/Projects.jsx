import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { projectsApi } from '../api/projects';
import ProjectCard from '../components/projects/ProjectCard';
import ProjectFilters from '../components/projects/ProjectFilters';
import Icon from '../components/ui/Icon';

const initialFilters = {
  query: '',
  category: '',
  required_role: '',
  skills: '',
  remote_only: false,
  startup_only: false,
  university_only: false,
  sort: 'latest',
};

const Projects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [filters, setFilters] = useState(initialFilters);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(filters.query), 350);
    return () => clearTimeout(timeout);
  }, [filters.query]);

  const activeFilters = useMemo(
    () => Object.entries(filters).filter(([key, value]) => key !== 'sort' && Boolean(value)).length,
    [filters],
  );

  const buildParams = () => {
    const params = { ...filters, query: debouncedQuery, page, limit: 12 };
    Object.keys(params).forEach((key) => {
      if (params[key] === '' || params[key] === false) delete params[key];
    });
    return params;
  };

  const loadProjects = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await projectsApi.list(buildParams());
      setProjects(data.items || []);
      setTotalPages(data.pages || 1);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProjects(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [page, debouncedQuery]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadProjects();
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    setDebouncedQuery('');
    setPage(1);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>PROJECT BOARD · {total} PROJECT{total === 1 ? '' : 'S'}</div>
          <h1 className="h1">
            Build with alumni,<br />
            <i>from idea to first users</i>.
          </h1>
        </div>
        <div className="page-head-actions">
          <Link to="/projects/create" className="btn primary">
            <Icon name="plus" size={12} /> Publish project
          </Link>
        </div>
      </div>

      <ProjectFilters
        filters={filters}
        setFilters={(next) => { setFilters(next); if (page !== 1) setPage(1); }}
        onSubmit={handleSubmit}
        onClear={clearFilters}
        activeFilters={activeFilters}
      />

      {error && <div className="panel" style={{ padding: 14, marginBottom: 16, color: 'var(--err)' }}>{error}</div>}

      {loading ? (
        <div className="project-skeleton-grid">
          {Array.from({ length: 6 }).map((_, index) => <div key={index} className="panel project-skeleton" />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="empty-block">
          <Icon name="bookmark" size={28} />
          <h3>No projects found</h3>
          <p>Try different filters or publish the first idea for collaborators.</p>
          <button className="btn primary" onClick={() => navigate('/projects/create')}>
            <Icon name="plus" size={12} /> Publish project
          </button>
        </div>
      ) : (
        <>
          <div className="responsive-card-grid">
            {projects.map((project) => <ProjectCard key={project.id} project={project} />)}
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

export default Projects;
