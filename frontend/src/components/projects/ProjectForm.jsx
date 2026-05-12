import { useEffect, useState } from 'react';
import Icon from '../ui/Icon';
import { PROJECT_CATEGORIES, PROJECT_ROLES, PROJECT_STAGES } from '../../api/projects';

const emptyForm = {
  title: '',
  short_description: '',
  full_description: '',
  category: 'STARTUP',
  required_roles: [],
  required_skills: '',
  project_stage: 'IDEA',
  team_size: '',
  is_remote: true,
  contact_preference: '',
  github_link: '',
  demo_link: '',
  tags: '',
  university_related: false,
  startup_idea: false,
  looking_for_cofounder: false,
};

const toText = (items) => (items || []).join(', ');

const ProjectForm = ({ initialProject, onSubmit, submitting }) => {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!initialProject) return;
    setForm({
      title: initialProject.title || '',
      short_description: initialProject.short_description || '',
      full_description: initialProject.full_description || '',
      category: initialProject.category || 'STARTUP',
      required_roles: initialProject.required_roles || [],
      required_skills: toText(initialProject.required_skills),
      project_stage: initialProject.project_stage || 'IDEA',
      team_size: initialProject.team_size || '',
      is_remote: Boolean(initialProject.is_remote),
      contact_preference: initialProject.contact_preference || '',
      github_link: initialProject.github_link || '',
      demo_link: initialProject.demo_link || '',
      tags: toText(initialProject.tags),
      university_related: Boolean(initialProject.university_related),
      startup_idea: Boolean(initialProject.startup_idea),
      looking_for_cofounder: Boolean(initialProject.looking_for_cofounder),
    });
  }, [initialProject]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const toggleRole = (role) => {
    set('required_roles', form.required_roles.includes(role)
      ? form.required_roles.filter((item) => item !== role)
      : [...form.required_roles, role]);
  };
  const split = (value) => value.split(',').map((item) => item.trim()).filter(Boolean);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      team_size: form.team_size ? Number(form.team_size) : null,
      required_skills: split(form.required_skills),
      tags: split(form.tags),
      github_link: form.github_link || null,
      demo_link: form.demo_link || null,
      contact_preference: form.contact_preference || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="project-form">
      <div className="panel" style={{ padding: 18 }}>
        <div className="form-group">
          <label>Title</label>
          <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="AI study planner, campus marketplace..." required />
        </div>
        <div className="form-group">
          <label>Short description</label>
          <textarea rows={3} value={form.short_description} onChange={(e) => set('short_description', e.target.value)} maxLength={320} required />
        </div>
        <div className="form-group">
          <label>Full description</label>
          <textarea rows={8} value={form.full_description} onChange={(e) => set('full_description', e.target.value)} required />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Category</label>
            <select value={form.category} onChange={(e) => set('category', e.target.value)}>
              {Object.entries(PROJECT_CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Stage</label>
            <select value={form.project_stage} onChange={(e) => set('project_stage', e.target.value)}>
              {Object.entries(PROJECT_STAGES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Team size</label>
            <input type="number" min="1" max="100" value={form.team_size} onChange={(e) => set('team_size', e.target.value)} placeholder="4" />
          </div>
        </div>
      </div>

      <div className="panel" style={{ padding: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Team needs</div>
        <div className="project-role-grid">
          {Object.entries(PROJECT_ROLES).map(([key, label]) => (
            <button
              type="button"
              key={key}
              className={`project-role-toggle${form.required_roles.includes(key) ? ' active' : ''}`}
              onClick={() => toggleRole(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="form-group" style={{ marginTop: 16 }}>
          <label>Required skills</label>
          <input value={form.required_skills} onChange={(e) => set('required_skills', e.target.value)} placeholder="React, TypeScript, FastAPI" />
        </div>
        <div className="form-group">
          <label>Tags</label>
          <input value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="edtech, ai, validation" />
        </div>
      </div>

      <div className="panel" style={{ padding: 18 }}>
        <div className="form-row">
          <div className="form-group">
            <label>GitHub link</label>
            <input type="url" value={form.github_link} onChange={(e) => set('github_link', e.target.value)} placeholder="https://github.com/..." />
          </div>
          <div className="form-group">
            <label>Demo link</label>
            <input type="url" value={form.demo_link} onChange={(e) => set('demo_link', e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <div className="form-group">
          <label>Contact preference</label>
          <input value={form.contact_preference} onChange={(e) => set('contact_preference', e.target.value)} placeholder="Telegram, email, platform messages..." />
        </div>
        <div className="project-switches">
          <label><input type="checkbox" checked={form.is_remote} onChange={(e) => set('is_remote', e.target.checked)} /> Remote friendly</label>
          <label><input type="checkbox" checked={form.university_related} onChange={(e) => set('university_related', e.target.checked)} /> University related</label>
          <label><input type="checkbox" checked={form.startup_idea} onChange={(e) => set('startup_idea', e.target.checked)} /> Startup idea</label>
          <label><input type="checkbox" checked={form.looking_for_cofounder} onChange={(e) => set('looking_for_cofounder', e.target.checked)} /> Looking for co-founder</label>
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn primary lg" disabled={submitting}>
          <Icon name="check" size={14} /> {submitting ? 'Saving...' : 'Save project'}
        </button>
      </div>
    </form>
  );
};

export default ProjectForm;
