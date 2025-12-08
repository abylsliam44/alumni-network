import { useState, useEffect } from 'react';
import { directoryApi } from '../api/directory';
import UserCard from '../components/directory/UserCard';
import DirectoryFilters from '../components/directory/DirectoryFilters';
import Pagination from '../components/directory/Pagination';
import SearchInput from '../components/directory/SearchInput';

const Directory = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [filters, setFilters] = useState({
    query: '',
    role: '',
    skills: '',
    location: '',
    graduation_year: '',
    page: 1,
    limit: 12
  });

  useEffect(() => {
    fetchUsers();
  }, [filters]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await directoryApi.getUsers(filters);
      setUsers(data.items);
      setTotal(data.total);
      setTotalPages(data.pages);
    } catch (err) {
      console.error('Failed to fetch users', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters({ ...newFilters, page: 1 }); // Reset to page 1 on filter change
  };

  const handleSearchChange = (query) => {
    setFilters({ ...filters, query, page: 1 });
  };

  const handlePageChange = (page) => {
    setFilters({ ...filters, page });
  };

  const handleClearFilters = () => {
    setFilters({
      query: '',
      role: '',
      skills: '',
      location: '',
      graduation_year: '',
      page: 1,
      limit: 12
    });
  };

  return (
    <div className="directory-container">
      <div className="directory-header">
        <h1>Alumni Directory</h1>
        <p>Connect with alumni, students, and mentors.</p>
        <div className="directory-search-bar elevated">
          <SearchInput
            value={filters.query}
            onChange={handleSearchChange}
            placeholder="Search by name, bio, or keywords..."
          />
        </div>
      </div>

      <div className="directory-content">
        <aside className="directory-sidebar">
          <DirectoryFilters
            filters={filters}
            onChange={handleFilterChange}
            onClear={handleClearFilters}
          />
        </aside>

        <main className="directory-main">
          {loading ? (
            <div className="loading-spinner">Loading directory...</div>
          ) : (
            <>
              <div className="results-count">
                Found {total} members
              </div>

              {users.length > 0 ? (
                <div className="users-grid">
                  {users.map(user => (
                    <UserCard key={user.id} user={user} />
                  ))}
                </div>
              ) : (
                <div className="no-results">
                  <p>No members found matching your criteria.</p>
                  <button onClick={handleClearFilters} className="btn-link">Clear filters</button>
                </div>
              )}

              <Pagination
                currentPage={filters.page}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Directory;
