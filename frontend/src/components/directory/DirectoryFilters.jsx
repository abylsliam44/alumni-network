import Input from '../ui/Input';
import Button from '../ui/Button';

const DirectoryFilters = ({ filters, onChange, onClear }) => {
  const handleChange = (e) => {
    onChange({ ...filters, [e.target.name]: e.target.value });
  };

  return (
    <div className="filters-card card">
      <div className="filters-header">
        <h3>Filters</h3>
        <button onClick={onClear} className="clear-filters-btn">Clear all</button>
      </div>

      <div className="filter-group">
        <label className="form-label">Role</label>
        <select
          name="role"
          value={filters.role || ''}
          onChange={handleChange}
          className="form-input"
        >
          <option value="">All Roles</option>
          <option value="STUDENT">Student</option>
          <option value="ALUMNI">Alumni</option>
        </select>
      </div>

      <div className="filter-group">
        <label className="form-label">Mentors</label>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            name="mentor_only"
            checked={!!filters.mentor_only}
            onChange={(e) => onChange({ ...filters, mentor_only: e.target.checked })}
          />
          <span className="text-sm text-secondary">Show mentors only</span>
        </div>
      </div>

      <div className="filter-group">
        <Input
          label="Skills"
          name="skills"
          value={filters.skills || ''}
          onChange={handleChange}
          placeholder="e.g. React, Python"
        />
      </div>

      <div className="filter-group">
        <Input
          label="Location"
          name="location"
          value={filters.location || ''}
          onChange={handleChange}
          placeholder="City or Country"
        />
      </div>

      <div className="filter-group">
        <Input
          label="Graduation Year"
          name="graduation_year"
          type="number"
          value={filters.graduation_year || ''}
          onChange={handleChange}
          placeholder="YYYY"
        />
      </div>
    </div>
  );
};

export default DirectoryFilters;
