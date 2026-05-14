import { useState, useEffect, useMemo, useRef } from 'react';
import { directoryApi } from '../api/directory';
import { connectionsApi } from '../api/connections';
import UserCard from '../components/directory/UserCard';
import DirectoryFilters from '../components/directory/DirectoryFilters';
import Pagination from '../components/directory/Pagination';
import SearchInput from '../components/directory/SearchInput';
import Pill from '../components/ui/Pill';
import Icon from '../components/ui/Icon';
import { useAuth } from '../hooks/useAuth';

const Directory = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [connections, setConnections] = useState({});
  const [requesting, setRequesting] = useState({});
  const [filtersVisible, setFiltersVisible] = useState(false);
  const connectionsFetchSeq = useRef(0);

  const [filters, setFilters] = useState({
    query: '', role: '', skills: '', location: '', graduation_year: '',
    mentor_only: false, page: 1, limit: 12,
  });

  useEffect(() => { fetchUsers(); /* eslint-disable-line */ }, [filters]);
  useEffect(() => { if (currentUser) fetchConnections(); /* eslint-disable-line */ }, [currentUser]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { mentor_only, ...rest } = filters;
      const params = { ...rest };
      if (mentor_only) { params.is_mentor = true; }
      const data = await directoryApi.getUsers(params);
      setUsers(data.items);
      setTotal(data.total);
      setTotalPages(data.pages);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchConnections = async () => {
    const seq = connectionsFetchSeq.current + 1;
    connectionsFetchSeq.current = seq;
    try {
      const list = await connectionsApi.list();
      if (seq !== connectionsFetchSeq.current) return;
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
    } catch (err) { console.error(err); }
  };

  const handleAddFriend = async (targetId) => {
    if (requesting[targetId]) return;
    setRequesting((prev) => ({ ...prev, [targetId]: true }));
    setConnections((prev) => ({ ...prev, [targetId]: { status: 'PENDING', id: null, direction: 'out' } }));
    try {
      const data = await connectionsApi.request(targetId);
      setConnections((prev) => ({ ...prev, [targetId]: { status: data.status, id: data.id, direction: 'out' } }));
      fetchConnections();
    } catch (err) {
      console.error(err);
      await fetchConnections();
    } finally {
      setRequesting((prev) => { const c = { ...prev }; delete c[targetId]; return c; });
    }
  };

  const handleRespond = async (connectionId, status) => {
    const target = Object.entries(connections).find(([, v]) => v.id === connectionId);
    const targetId = target ? target[0] : null;
    if (targetId) {
      setConnections((prev) => ({ ...prev, [targetId]: { status, id: connectionId, direction: prev[targetId]?.direction || 'in' } }));
    }
    try { await connectionsApi.respond(connectionId, status); fetchConnections(); }
    catch (err) { console.error(err); fetchConnections(); }
  };

  const connectionStatus = useMemo(() => connections, [connections]);
  const activeFiltersCount = [filters.role, filters.skills, filters.location, filters.graduation_year, filters.mentor_only].filter(Boolean).length;

  const handleFilterChange = (newFilters) => setFilters({ ...newFilters, page: 1 });
  const handleSearchChange = (q) => setFilters({ ...filters, query: q, page: 1 });
  const handlePageChange = (page) => setFilters({ ...filters, page });
  const handleClearFilters = () => setFilters({
    query: '', role: '', skills: '', location: '', graduation_year: '',
    mentor_only: false, page: 1, limit: 12,
  });

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            DIRECTORY - {total} MEMBERS
          </div>
          <h1 className="h1">Find your <i>people</i>.</h1>
        </div>
        <div className="page-head-actions">
          <SearchInput value={filters.query} onChange={handleSearchChange} placeholder="Search by name, skill, company..." />
          <button className="btn" onClick={() => setFiltersVisible(!filtersVisible)}>
            <Icon name="sliders" size={14} /> Filters
            {activeFiltersCount > 0 && <Pill tone="blue">{activeFiltersCount}</Pill>}
          </button>
        </div>
      </div>

      {filtersVisible && (
        <DirectoryFilters filters={filters} onChange={handleFilterChange} onClear={handleClearFilters} />
      )}

      {loading ? (
        <div className="loading-block">Indexing alumni - fetching profiles</div>
      ) : users.length === 0 ? (
        <div className="empty-block">
          <Icon name="users" size={28} />
          <h3>No members found</h3>
          <p>Try adjusting your search or filters.</p>
          <button onClick={handleClearFilters} className="btn sm">Clear filters</button>
        </div>
      ) : (
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
          <Pagination currentPage={filters.page} totalPages={totalPages} onPageChange={handlePageChange} />
        </>
      )}
    </div>
  );
};

export default Directory;
