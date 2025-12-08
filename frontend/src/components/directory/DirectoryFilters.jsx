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
          <option value="MENTOR">Mentor</option>
          <option value="COMPANY_REP">Company Rep</option>
        </select>
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
