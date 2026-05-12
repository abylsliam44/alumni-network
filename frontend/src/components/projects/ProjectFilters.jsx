import Icon from '../ui/Icon';
import { PROJECT_CATEGORIES, PROJECT_ROLES } from '../../api/projects';

const ProjectFilters = ({ filters, setFilters, onSubmit, onClear, activeFilters }) => (
  <div className="panel" style={{ padding: 16, marginBottom: 20 }}>
    <form onSubmit={onSubmit} className="project-filter-grid">
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>Search</label>
        <input
          type="search"
          value={filters.query}
          onChange={(e) => setFilters({ ...filters, query: e.target.value })}
          placeholder="AI app, co-founder, React..."
        />
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>Category</label>
        <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
          <option value="">All</option>
          {Object.entries(PROJECT_CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>Role</label>
        <select value={filters.required_role} onChange={(e) => setFilters({ ...filters, required_role: e.target.value })}>
          <option value="">Any role</option>
          {Object.entries(PROJECT_ROLES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>Skills</label>
        <input
          type="text"
          value={filters.skills}
          onChange={(e) => setFilters({ ...filters, skills: e.target.value })}
          placeholder="React, Python"
        />
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>Sort</label>
        <select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}>
          <option value="latest">Latest</option>
          <option value="match">Best match</option>
          <option value="popular">Popular</option>
        </select>
      </div>
      <label className="project-check">
        <input type="checkbox" checked={filters.remote_only} onChange={(e) => setFilters({ ...filters, remote_only: e.target.checked })} />
        Remote
      </label>
      <label className="project-check">
        <input type="checkbox" checked={filters.startup_only} onChange={(e) => setFilters({ ...filters, startup_only: e.target.checked })} />
        Startup
      </label>
      <label className="project-check">
        <input type="checkbox" checked={filters.university_only} onChange={(e) => setFilters({ ...filters, university_only: e.target.checked })} />
        University
      </label>
      <button type="submit" className="btn primary"><Icon name="search" size={12} /> Search</button>
      {activeFilters > 0 && <button type="button" className="btn ghost" onClick={onClear}>Clear</button>}
    </form>
  </div>
);

export default ProjectFilters;
