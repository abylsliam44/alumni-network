import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatProjectError, projectsApi } from '../api/projects';
import ProjectForm from '../components/projects/ProjectForm';

const ProjectCreate = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    setError('');
    try {
      const project = await projectsApi.create(payload);
      navigate(`/projects/${project.id}`);
    } catch (err) {
      setError(formatProjectError(err, 'Failed to create project'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <div className="project-breadcrumb"><Link to="/projects">PROJECTS</Link><span>/</span><span>CREATE</span></div>
      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>NEW PROJECT</div>
          <h1 className="h1">Publish a project and find your team.</h1>
        </div>
      </div>
      {error && <div className="panel" style={{ padding: 14, marginBottom: 16, color: 'var(--err)', whiteSpace: 'pre-line' }}>{error}</div>}
      <ProjectForm onSubmit={handleSubmit} submitting={submitting} />
    </div>
  );
};

export default ProjectCreate;
