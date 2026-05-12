import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { recommendationsApi } from '../api/recommendations';
import { connectionsApi } from '../api/connections';
import { profileApi } from '../api/profile';
import Avatar from '../components/ui/Avatar';
import Pill from '../components/ui/Pill';
import NumCap from '../components/ui/NumCap';
import Icon from '../components/ui/Icon';
import { resolveUrl } from '../utils/image';

const Recommendations = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectingId, setConnectingId] = useState(null);
  const [connectedIds, setConnectedIds] = useState(new Set());

  const loadRecommendations = async () => {
    setLoading(true); setError(null);
    try {
      const [recRes, profileRes] = await Promise.all([
        recommendationsApi.getPeople(),
        profileApi.getMe(),
      ]);
      setData(recRes); setProfile(profileRes);
    } catch (err) {
      console.error(err);
      setError('Failed to load recommendations. Please try again.');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadRecommendations(); }, []);

  const handleConnect = async (userId) => {
    setConnectingId(userId);
    try {
      await connectionsApi.request(userId);
      setConnectedIds((p) => new Set([...p, userId]));
    } catch (err) { console.error(err); }
    finally { setConnectingId(null); }
  };

  const summary = useMemo(() => {
    if (!data?.items?.length) return { total: 0, best: 0 };
    const sorted = [...data.items].sort((a, b) => (b.match_score || b.score || 0) - (a.match_score || a.score || 0));
    const best = sorted[0]?.match_score || sorted[0]?.score || 0;
    return { total: data.items.length, best: Math.round(best > 1 ? best : best * 100) };
  }, [data]);

  const recommendations = data?.items || [];
  const hasProfileSignals = profile && (profile.skills?.length || profile.interests?.length || profile.mentor_areas_of_help?.length);

  // Top 3 featured + rest list
  const sorted = useMemo(() => {
    return [...recommendations].sort((a, b) => (b.match_score || b.score || 0) - (a.match_score || a.score || 0));
  }, [recommendations]);
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  const matchPct = (rec) => {
    const v = rec.match_score || rec.score || 0;
    return Math.round(v > 1 ? v : v * 100);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            RECOMMENDATIONS · QDRANT EMBEDDINGS
          </div>
          <h1 className="h1">
            {summary.total > 0
              ? <><i>{summary.total} people</i> the model thinks<br />you should <span style={{ color: 'var(--blue)' }}>actually meet</span>.</>
              : <>Find your <i>next</i> connection.</>}
          </h1>
        </div>
        <div className="page-head-actions">
          <button className="btn" onClick={loadRecommendations} disabled={loading}>
            <Icon name="refresh" size={14} /> Refresh
          </button>
        </div>
      </div>

      {summary.total > 0 && (
        <div className="panel panel-row" style={{ padding: 14, marginBottom: 24, background: 'var(--bg-2)' }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>WHY THESE RESULTS</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              Computed from your role, skills, mentor preferences, career graph signals, and proximity in your network.
              Top match: <b style={{ color: 'var(--blue)' }}>{summary.best}%</b> · {summary.total} candidates returned.
            </div>
          </div>
          <Pill tone="blue" dot>Sorted by AI match</Pill>
        </div>
      )}

      {loading ? (
        <div className="loading-block">Computing matches · qdrant · cosine</div>
      ) : error ? (
        <div className="empty-block">
          <Icon name="alert" size={28} />
          <h3>Unable to load</h3>
          <p>{error}</p>
          <button className="btn" onClick={loadRecommendations}>Try again</button>
        </div>
      ) : recommendations.length === 0 ? (
        <div className="empty-block">
          <Icon name="users" size={28} />
          {hasProfileSignals ? (
            <>
              <h3>No new matches right now</h3>
              <p>Check back later as more alumni join the platform.</p>
              <button className="btn sm" onClick={loadRecommendations}>Refresh</button>
            </>
          ) : (
            <>
              <h3>No recommendations yet</h3>
              <p>Add skills and interests to your profile to unlock personalised matches.</p>
              <Link to="/profile/edit" className="btn sm primary">Complete profile</Link>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Featured top-3 row */}
          {top3.length > 0 && (
            <>
              <div className="eyebrow" style={{ marginBottom: 12 }}>01 · TOP MATCHES</div>
              <div className="responsive-card-grid compact" style={{ marginBottom: 28 }}>
                {top3.map((rec, i) => {
                  const u = { ...(rec.user || rec), id: (rec.user?.id) || rec.target_user_id || rec.id };
                  if (!u.id) return null;
                  const m = matchPct(rec);
                  const reason = rec.reason || rec.reason_short;
                  const skills = rec.shared_skills || u.skills || [];
                  const isConnected = connectedIds.has(u.id);
                  return (
                    <article key={u.id} className="panel blue-tint" style={{ padding: 18, position: 'relative' }}>
                      <div style={{ position: 'absolute', top: 14, right: 14, fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 38, color: 'var(--ink-4)', lineHeight: 1 }}>
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <Avatar src={resolveUrl(u.photo_url)} name={u.name} size="l" />
                      <div className="h3" style={{ marginTop: 12, fontSize: 16 }}>{u.name}</div>
                      {u.headline && <div className="mute" style={{ fontSize: 12, marginBottom: 10 }}>{u.headline}</div>}
                      {u.is_mentor && <Pill tone="blue" dot>Mentor</Pill>}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 14, borderTop: '1px dashed var(--line)', marginTop: 12 }}>
                        {reason && <div className="mono" style={{ fontSize: 10.5, color: 'var(--blue)' }}>+ {reason}</div>}
                        {skills.length > 0 && (
                          <div className="mono" style={{ fontSize: 10.5, color: 'var(--blue)' }}>
                            + Shared: {skills.slice(0, 3).join(', ')}{skills.length > 3 ? '…' : ''}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                        <span className="mono" style={{ fontSize: 12, color: 'var(--blue)', fontWeight: 600 }}>{m}% match</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn sm" onClick={() => navigate(`/profile/${u.id}`)}>Profile</button>
                          {isConnected ? (
                            <button className="btn sm" disabled><Icon name="check" size={12} /> Sent</button>
                          ) : (
                            <button className="btn sm primary" onClick={() => handleConnect(u.id)} disabled={connectingId === u.id}>
                              {connectingId === u.id ? '…' : 'Connect'}
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}

          {/* More to explore */}
          {rest.length > 0 && (
            <>
              <div className="eyebrow" style={{ marginBottom: 12 }}>02 · MORE TO EXPLORE</div>
              <div className="responsive-list-grid">
                {rest.map((rec) => {
                  const u = { ...(rec.user || rec), id: (rec.user?.id) || rec.target_user_id || rec.id };
                  if (!u.id) return null;
                  const m = matchPct(rec);
                  const isConnected = connectedIds.has(u.id);
                  return (
                    <div key={u.id} className="panel recommendation-row" style={{ padding: 12, display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: 10, alignItems: 'center' }}>
                      <Avatar src={resolveUrl(u.photo_url)} name={u.name} size="m" />
                      <div style={{ minWidth: 0 }}>
                        <Link to={`/profile/${u.id}`} className="h3" style={{ fontSize: 13, color: 'var(--ink)' }}>{u.name}</Link>
                        <div className="mute mono" style={{ fontSize: 10, marginTop: 2 }}>{(u.headline || u.role || '').slice(0, 40)}</div>
                      </div>
                      <span className="mono" style={{ fontSize: 10.5, color: 'var(--blue)' }}>{m}%</span>
                      {isConnected ? (
                        <button className="btn sm" disabled><Icon name="check" size={12} /></button>
                      ) : (
                        <button className="btn sm primary" onClick={() => handleConnect(u.id)} disabled={connectingId === u.id}>
                          {connectingId === u.id ? '…' : '+ Connect'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Recommendations;
