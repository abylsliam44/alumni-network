import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatProjectError, projectsApi } from '../api/projects';
import ProjectForm from '../components/projects/ProjectForm';
import Icon from '../components/ui/Icon';

const ProjectEdit = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setProject(await projectsApi.get(projectId));
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load project');
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    setError('');
    try {
      const updated = await projectsApi.update(projectId, payload);
      navigate(`/projects/${updated.id}`);
    } catch (err) {
      setError(formatProjectError(err, 'Failed to update project'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="page"><div className="loading-block">Loading project...</div></div>;
  if (!project) return (
    <div className="page">
      <div className="empty-block">
        <Icon name="alert" size={28} />
        <h3>Project not found</h3>
        <Link to="/projects" className="btn">Back to projects</Link>
      </div>
    </div>
  );

  return (
    <div className="page">
      <div className="project-breadcrumb"><Link to="/projects">PROJECTS</Link><span>/</span><span>EDIT</span></div>
      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>EDIT PROJECT</div>
          <h1 className="h1">Keep the project signal sharp.</h1>
        </div>
      </div>
      {error && <div className="panel" style={{ padding: 14, marginBottom: 16, color: 'var(--err)', whiteSpace: 'pre-line' }}>{error}</div>}
      <ProjectForm initialProject={project} onSubmit={handleSubmit} submitting={submitting} />
    </div>
  );
};

export default ProjectEdit;
