const DirectoryFilters = ({ filters, onChange, onClear }) => {
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    onChange({ 
      ...filters, 
      [name]: type === 'checkbox' ? checked : value 
    });
  };

  const hasActiveFilters = filters.role || filters.skills || filters.location || filters.graduation_year || filters.mentor_only;

  return (
    <div className="dfilters">
      <div className="dfilters-row">
        <div className="dfilter-group">
          <label className="dfilter-label">Role</label>
          <select
            name="role"
            value={filters.role || ''}
            onChange={handleChange}
            className="dfilter-select"
          >
            <option value="">All</option>
            <option value="STUDENT">Student</option>
            <option value="ALUMNI">Alumni</option>
          </select>
        </div>

        <div className="dfilter-group">
          <label className="dfilter-label">Skills</label>
          <input
            type="text"
            name="skills"
            value={filters.skills || ''}
            onChange={handleChange}
            placeholder="React, Python..."
            className="dfilter-input"
          />
        </div>

        <div className="dfilter-group">
          <label className="dfilter-label">Location</label>
          <input
            type="text"
            name="location"
            value={filters.location || ''}
            onChange={handleChange}
            placeholder="City or Country"
            className="dfilter-input"
          />
        </div>

        <div className="dfilter-group">
          <label className="dfilter-label">Graduation</label>
          <input
            type="number"
            name="graduation_year"
            value={filters.graduation_year || ''}
            onChange={handleChange}
            placeholder="Year"
            className="dfilter-input dfilter-input-sm"
          />
        </div>

        <div className="dfilter-group dfilter-group-checkbox">
          <label className="dfilter-checkbox">
            <input
              type="checkbox"
              name="mentor_only"
              checked={!!filters.mentor_only}
              onChange={handleChange}
            />
            <span className="dfilter-checkbox-box"></span>
            <span className="dfilter-checkbox-text">Mentors only</span>
          </label>
        </div>

        {hasActiveFilters && (
          <button onClick={onClear} className="dfilter-clear">
            Clear all
          </button>
        )}
      </div>
    </div>
  );
};

export default DirectoryFilters;
