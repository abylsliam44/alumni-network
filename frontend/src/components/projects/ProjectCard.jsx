import { Link } from 'react-router-dom';
import Pill from '../ui/Pill';
import Icon from '../ui/Icon';
import SkillsMatchBadge from './SkillsMatchBadge';
import { PROJECT_CATEGORIES, PROJECT_ROLES, PROJECT_STAGES } from '../../api/projects';

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const diff = Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const ProjectCard = ({ project }) => (
  <Link to={`/projects/${project.id}`} className="panel project-card">
    <div className="project-card-head">
      <div className="project-mark">
        {(project.title || '?').slice(0, 2).toUpperCase()}
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="h3">{project.title}</div>
        <div className="mute" style={{ fontSize: 12.5, marginTop: 2 }}>
          {project.creator?.name || 'Alumni project'} · {PROJECT_STAGES[project.project_stage] || project.project_stage}
        </div>
      </div>
    </div>

    <div className="project-card-pills">
      <Pill tone="blue">{PROJECT_CATEGORIES[project.category] || project.category}</Pill>
      {project.is_remote && <Pill>Remote</Pill>}
      {project.startup_idea && <Pill tone="warm">Startup idea</Pill>}
      {project.looking_for_cofounder && <Pill tone="warm">Co-founder</Pill>}
      <SkillsMatchBadge score={project.match_score || 0} />
    </div>

    <p className="dim project-card-copy">{project.short_description}</p>

    {project.required_roles?.length > 0 && (
      <div className="project-card-roles">
        {project.required_roles.slice(0, 3).map((role) => (
          <span key={role} className="chip skill">{PROJECT_ROLES[role] || role}</span>
        ))}
        {project.required_roles.length > 3 && <span className="chip skill">+{project.required_roles.length - 3}</span>}
      </div>
    )}

    <div className="project-card-foot">
      <span className="mono mute">{formatDate(project.created_at)}</span>
      <span className="mono project-card-link">View <Icon name="arrowR" size={11} /></span>
    </div>
  </Link>
);

export default ProjectCard;
