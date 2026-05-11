const DirectoryFilters = ({ filters, onChange, onClear }) => {
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    onChange({ ...filters, [name]: type === 'checkbox' ? checked : value });
  };

  const hasActiveFilters = filters.role || filters.skills || filters.location || filters.graduation_year || filters.mentor_only;

  return (
    <div className="panel" style={{ padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'flex-end' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Role</label>
          <select name="role" value={filters.role || ''} onChange={handleChange}>
            <option value="">All</option>
            <option value="STUDENT">Student</option>
            <option value="ALUMNI">Alumni</option>
            <option value="STAFF">Staff</option>
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Skills</label>
          <input type="text" name="skills" value={filters.skills || ''} onChange={handleChange} placeholder="React, Python…" />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Location</label>
          <input type="text" name="location" value={filters.location || ''} onChange={handleChange} placeholder="City or country" />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Graduation year</label>
          <input type="number" name="graduation_year" value={filters.graduation_year || ''} onChange={handleChange} placeholder="2024" />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ink-2)', cursor: 'pointer', textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--sans)' }}>
          <input type="checkbox" name="mentor_only" checked={!!filters.mentor_only} onChange={handleChange} />
          Mentors only
        </label>

        {hasActiveFilters && (
          <button onClick={onClear} className="btn sm ghost">Clear all</button>
        )}
      </div>
    </div>
  );
};

export default DirectoryFilters;
