import { useState, useEffect, useMemo } from 'react';
import { directoryApi } from '../api/directory';
import { connectionsApi } from '../api/connections';
import UserCard from '../components/directory/UserCard';
import DirectoryFilters from '../components/directory/DirectoryFilters';
import Pagination from '../components/directory/Pagination';
import SearchInput from '../components/directory/SearchInput';
import PageIntro from '../components/PageIntro';
import { useAuth } from '../hooks/useAuth';

const Directory = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [connections, setConnections] = useState({});
  const [requesting, setRequesting] = useState({});
  const [filtersVisible, setFiltersVisible] = useState(true);

  const [filters, setFilters] = useState({
    query: '',
    role: '',
    skills: '',
    location: '',
    graduation_year: '',
    mentor_only: false,
    page: 1,
    limit: 12
  });

  useEffect(() => {
    fetchUsers();
  }, [filters]);

  useEffect(() => {
    if (currentUser) {
      fetchConnections();
    }
  }, [currentUser]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { mentor_only, ...rest } = filters;
      const params = { ...rest };

      if (mentor_only) {
        params.role = 'ALUMNI';
        params.is_mentor = true;
      }

      const data = await directoryApi.getUsers(params);
      setUsers(data.items);
      setTotal(data.total);
      setTotalPages(data.pages);
    } catch (err) {
      console.error('Failed to fetch users', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchConnections = async () => {
    try {
      const list = await connectionsApi.list();
      const map = {};
      list.forEach((conn) => {
        const otherId = conn.requester_id === currentUser.id ? conn.recipient_id : conn.requester_id;
        map[otherId] = {
          status: conn.status,
          id: conn.id,
          direction: conn.requester_id === currentUser.id ? 'out' : 'in',
        };
      });
      setConnections(map);
    } catch (err) {
      console.error('Failed to load connections', err);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters({ ...newFilters, page: 1 });
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
      mentor_only: false,
      page: 1,
      limit: 12
    });
  };

  const connectionStatus = useMemo(() => {
    return connections;
  }, [connections]);

  const handleAddFriend = async (targetId) => {
    if (requesting[targetId]) return;
    setRequesting((prev) => ({ ...prev, [targetId]: true }));
    setConnections((prev) => ({
      ...prev,
      [targetId]: {
        status: 'PENDING',
        id: null,
        direction: 'out',
      },
    }));
    try {
      const data = await connectionsApi.request(targetId);
      setConnections((prev) => ({
        ...prev,
        [targetId]: {
          status: data.status,
          id: data.id,
          direction: 'out',
        },
      }));
      fetchConnections();
    } catch (err) {
      console.error('Failed to send request', err);
      setConnections((prev) => {
        const copy = { ...prev };
        delete copy[targetId];
        return copy;
      });
    } finally {
      setRequesting((prev) => {
        const copy = { ...prev };
        delete copy[targetId];
        return copy;
      });
    }
  };

  const handleRespond = async (connectionId, status) => {
    const targetEntry = Object.entries(connections).find(([, v]) => v.id === connectionId);
    const targetId = targetEntry ? targetEntry[0] : null;
    if (targetId) {
      setConnections((prev) => ({
        ...prev,
        [targetId]: {
          status,
          id: connectionId,
          direction: prev[targetId]?.direction || 'in',
        },
      }));
    }
    try {
      await connectionsApi.respond(connectionId, status);
      fetchConnections();
    } catch (err) {
      console.error('Failed to respond to request', err);
      fetchConnections();
    }
  };

  const activeFiltersCount = [
    filters.role,
    filters.skills,
    filters.location,
    filters.graduation_year,
    filters.mentor_only
  ].filter(Boolean).length;

  return (
    <div className="dir-page">
      <PageIntro
        title="Directory"
        subtitle={`${total} members available to connect`}
        side={(
          <div className="page-intro-side-stack">
            <div className="page-intro-actions">
              <SearchInput
                value={filters.query}
                onChange={handleSearchChange}
                placeholder="Search members..."
              />
              <button
                className={`dir-filter-toggle ${filtersVisible ? 'active' : ''}`}
                onClick={() => setFiltersVisible(!filtersVisible)}
              >
                Filters
                {activeFiltersCount > 0 && (
                  <span className="dir-filter-badge">{activeFiltersCount}</span>
                )}
              </button>
            </div>
          </div>
        )}
      />

      {/* Filters Panel - Collapsible */}
      <div className={`dir-filters-wrapper ${filtersVisible ? 'visible' : ''}`}>
        <DirectoryFilters
          filters={filters}
          onChange={handleFilterChange}
          onClear={handleClearFilters}
        />
      </div>

      {/* Main Content */}
      <main className="dir-main">
        {loading ? (
          <div className="dir-loading">
            <div className="dir-loading-bar"></div>
            <span>Loading members...</span>
          </div>
        ) : users.length > 0 ? (
          <>
            <div className="dir-grid">
              {users.map((user, index) => (
                <UserCard
                  key={user.id}
                  user={user}
                  index={index}
                  isSelf={currentUser?.id === user.user_id}
                  status={
                    connectionStatus[user.user_id]
                      ? connectionStatus[user.user_id].status === 'ACCEPTED'
                        ? 'friends'
                        : connectionStatus[user.user_id].direction === 'out'
                          ? 'pending_out'
                          : 'pending_in'
                      : 'none'
                  }
                  addLoading={requesting[user.user_id]}
                  onAddFriend={() => handleAddFriend(user.user_id)}
                  onAccept={() => {
                    const c = connectionStatus[user.user_id];
                    if (c) handleRespond(c.id, 'ACCEPTED');
                  }}
                  onDecline={() => {
                    const c = connectionStatus[user.user_id];
                    if (c) handleRespond(c.id, 'DECLINED');
                  }}
                />
              ))}
            </div>

            <Pagination
              currentPage={filters.page}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </>
        ) : (
          <div className="dir-empty">
            <h3>No members found</h3>
            <p>Try adjusting your search or filters</p>
            <button onClick={handleClearFilters} className="dir-clear-btn">
              Clear all filters
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Directory;
