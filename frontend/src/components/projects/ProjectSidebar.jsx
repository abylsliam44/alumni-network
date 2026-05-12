import { Link } from 'react-router-dom';
import Pill from '../ui/Pill';
import Icon from '../ui/Icon';
import SkillsMatchBadge from './SkillsMatchBadge';
import { PROJECT_CATEGORIES, PROJECT_ROLES, PROJECT_STAGES } from '../../api/projects';

const row = (label, value) => (
  <div className="project-side-row">
    <span>{label}</span>
    <b>{value || 'Not specified'}</b>
  </div>
);

const ProjectSidebar = ({ project }) => (
  <div className="project-sidebar">
    <div className="panel" style={{ padding: 16 }}>
      <div className="project-side-top">
        <Pill tone="blue">{PROJECT_CATEGORIES[project.category] || project.category}</Pill>
        <SkillsMatchBadge score={project.match_score || 0} />
      </div>
      {row('Stage', PROJECT_STAGES[project.project_stage] || project.project_stage)}
      {row('Team size', project.team_size)}
      {row('Work mode', project.is_remote ? 'Remote friendly' : 'On-site / local')}
      {row('Applications', project.applications_count || 0)}
      {row('Contact', project.contact_preference)}
    </div>

    {(project.github_link || project.demo_link) && (
      <div className="panel" style={{ padding: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Links</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {project.github_link && <a className="btn block" href={project.github_link} target="_blank" rel="noreferrer"><Icon name="external" size={12} /> GitHub</a>}
          {project.demo_link && <a className="btn block" href={project.demo_link} target="_blank" rel="noreferrer"><Icon name="external" size={12} /> Demo</a>}
        </div>
      </div>
    )}

    {project.creator && (
      <div className="panel" style={{ padding: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Creator</div>
        <Link to={`/profile/${project.creator.id}`} className="project-creator-link">
          <div className="avatar m">{(project.creator.name || '?').slice(0, 2).toUpperCase()}</div>
          <div>
            <div className="h3" style={{ fontSize: 13 }}>{project.creator.name}</div>
            <div className="mute" style={{ fontSize: 11.5 }}>View profile</div>
          </div>
        </Link>
      </div>
    )}

    {project.required_roles?.length > 0 && (
      <div className="panel" style={{ padding: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Team needs</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {project.required_roles.map((role) => <span key={role} className="chip skill">{PROJECT_ROLES[role] || role}</span>)}
        </div>
      </div>
    )}
  </div>
);

export default ProjectSidebar;
