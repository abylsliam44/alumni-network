import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { projectsApi, PROJECT_CATEGORIES, PROJECT_ROLES, PROJECT_STAGES } from '../api/projects';
import { profileApi } from '../api/profile';
import { useAuth } from '../hooks/useAuth';
import ApplyModal from '../components/projects/ApplyModal';
import ProjectCard from '../components/projects/ProjectCard';
import ProjectSidebar from '../components/projects/ProjectSidebar';
import SkillsMatchBadge from '../components/projects/SkillsMatchBadge';
import Icon from '../components/ui/Icon';
import Pill from '../components/ui/Pill';

const ProjectDetail = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [profile, setProfile] = useState(null);
  const [applications, setApplications] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [showApply, setShowApply] = useState(false);

  const isOwner = user?.id && project?.created_by_user_id === user.id;
  const hasApplied = Boolean(project?.has_applied);

  const loadProject = async () => {
    setLoading(true);
    try {
      const data = await projectsApi.get(projectId);
      setProject(data);
      try {
        const relatedData = await projectsApi.list({ category: data.category, limit: 4 });
        setRelated((relatedData.items || []).filter((item) => item.id !== data.id).slice(0, 3));
      } catch (relatedError) {
        console.error(relatedError);
        setRelated([]);
      }
    } catch (err) {
      setNotice({ type: 'error', message: err.response?.data?.detail || 'Failed to load project' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProject(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [projectId]);

  useEffect(() => {
    (async () => {
      try { setProfile(await profileApi.getMe()); } catch (err) { console.error(err); }
    })();
  }, []);

  useEffect(() => {
    if (!project || !isOwner) return;
    (async () => {
      try {
        const [apps, suggested] = await Promise.all([
          projectsApi.applications(project.id),
          projectsApi.candidates(project.id),
        ]);
        setApplications(apps || []);
        setCandidates(suggested || []);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [project, isOwner]);

  const handleApply = async (payload) => {
    try {
      await projectsApi.apply(project.id, payload);
      setShowApply(false);
      setNotice({ type: 'success', message: 'Application sent.' });
      await loadProject();
    } catch (err) {
      setNotice({ type: 'error', message: err.response?.data?.detail || 'Failed to apply' });
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this project?')) return;
    try {
      await projectsApi.remove(project.id);
      navigate('/projects');
    } catch (err) {
      setNotice({ type: 'error', message: err.response?.data?.detail || 'Failed to delete project' });
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
      <div className="project-breadcrumb">
        <Link to="/projects">PROJECTS</Link><span>/</span><span>{project.title.toUpperCase()}</span>
      </div>

      {notice && (
        <div className="panel" style={{ padding: 14, marginBottom: 16, color: notice.type === 'error' ? 'var(--err)' : 'var(--ok)' }}>
          {notice.message}
        </div>
      )}

      <div className="panel project-detail-hero">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            {PROJECT_CATEGORIES[project.category]} · {PROJECT_STAGES[project.project_stage]}
          </div>
          <h1 className="h1" style={{ fontSize: 34 }}>{project.title}</h1>
          <p className="dim" style={{ margin: '14px 0 0', maxWidth: 760, lineHeight: 1.6 }}>{project.short_description}</p>
        </div>
        <div className="mobile-full-actions project-detail-actions">
          {!isOwner && !hasApplied && (
            <button className="btn primary lg" onClick={() => setShowApply(true)}>
              <Icon name="send" size={14} /> Apply to join
            </button>
          )}
          {!isOwner && hasApplied && (
            <button className="btn lg" disabled>
              <Icon name="check" size={14} /> Application sent
            </button>
          )}
          {isOwner && (
            <>
              <Link to={`/projects/edit/${project.id}`} className="btn"><Icon name="edit" size={12} /> Edit</Link>
              <button className="btn ghost" onClick={handleDelete}><Icon name="trash" size={12} /> Delete</button>
            </>
          )}
          <SkillsMatchBadge score={project.match_score || 0} />
        </div>
      </div>

      <div className="responsive-two-col content-heavy">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>01 · PROJECT OVERVIEW</div>
          <div className="panel" style={{ padding: 18 }}>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>
              {project.full_description}
            </p>
          </div>

          {project.required_skills?.length > 0 && (
            <>
              <div className="eyebrow" style={{ margin: '24px 0 10px' }}>02 · SKILLS MATCHING</div>
              <div className="panel" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                  <div className="dim" style={{ fontSize: 13 }}>Required skills for this project</div>
                  <SkillsMatchBadge score={project.match_score || 0} />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {project.required_skills.map((skill) => (
                    <span key={skill} className={`chip skill${project.matched_skills?.includes(skill) ? ' blue' : ''}`}>{skill}</span>
                  ))}
                </div>
              </div>
            </>
          )}

          {isOwner && (
            <>
              <div className="eyebrow" style={{ margin: '24px 0 10px' }}>03 · APPLICATIONS</div>
              <div className="panel" style={{ padding: 16 }}>
                {applications.length === 0 ? (
                  <div className="empty-block" style={{ padding: 24 }}>
                    <Icon name="users" size={24} />
                    <h3>No applications yet</h3>
                    <p>Applicants will show up here with skill match scores.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {applications.map((app) => (
                      <div key={app.id} className="panel" style={{ padding: 12, background: 'var(--bg-2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                          <div>
                            <Link to={`/profile/${app.applicant_id}`} className="h3" style={{ fontSize: 13 }}>{app.applicant?.name || 'Applicant'}</Link>
                            <div className="mute" style={{ fontSize: 12 }}>Applied {new Date(app.applied_at).toLocaleDateString()}</div>
                          </div>
                          <SkillsMatchBadge score={app.match_score || 0} />
                        </div>
                        <p className="dim" style={{ fontSize: 12.5, lineHeight: 1.5 }}>{app.message}</p>
                        {app.skills?.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                            {app.skills.map((skill) => <span key={skill} className="chip skill">{skill}</span>)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="eyebrow" style={{ margin: '24px 0 10px' }}>04 · SUGGESTED CANDIDATES</div>
              <div className="panel" style={{ padding: 16 }}>
                {candidates.length === 0 ? (
                  <div className="empty-block" style={{ padding: 24 }}>
                    <Icon name="spark" size={24} />
                    <h3>No strong matches yet</h3>
                    <p>Members with matching profile skills will appear here.</p>
                  </div>
                ) : candidates.map((candidate) => (
                  <Link key={candidate.user.id} to={`/profile/${candidate.user.id}`} className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="avatar m">{(candidate.user.name || '?').slice(0, 2).toUpperCase()}</div>
                    <div>
                      <div className="h3" style={{ fontSize: 13 }}>{candidate.user.name}</div>
                      <div className="mute" style={{ fontSize: 11.5 }}>{candidate.matched_skills.join(', ')}</div>
                    </div>
                    <SkillsMatchBadge score={candidate.match_score} />
                  </Link>
                ))}
              </div>
            </>
          )}

          {related.length > 0 && (
            <>
              <div className="eyebrow" style={{ margin: '24px 0 10px' }}>RELATED PROJECTS</div>
              <div className="responsive-card-grid">
                {related.map((item) => <ProjectCard key={item.id} project={item} />)}
              </div>
            </>
          )}
        </div>

        <ProjectSidebar project={project} />
      </div>

      {project.tags?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 20 }}>
          {project.tags.map((tag) => <Pill key={tag}>#{tag}</Pill>)}
          {project.required_roles?.map((role) => <Pill key={role} tone="blue">{PROJECT_ROLES[role] || role}</Pill>)}
        </div>
      )}

      {showApply && <ApplyModal project={project} profile={profile} onClose={() => setShowApply(false)} onSubmit={handleApply} />}
    </div>
  );
};

export default ProjectDetail;
