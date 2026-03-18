import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { recommendationsApi } from '../api/recommendations';
import { connectionsApi } from '../api/connections';
import { profileApi } from '../api/profile';
import PageIntro from '../components/PageIntro';

const apiBase = import.meta.env.VITE_API_URL || '';
const resolveUrl = (path) => {
  if (!path) return null;
  return path.startsWith('http') ? path : `${apiBase}${path}`;
};

const dicebear = (name = 'User') =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;

// Icons
const UsersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const TrophyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

const MapPinIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const GraduationCapIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
  </svg>
);

const UserPlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="19" y1="8" x2="19" y2="14" />
    <line x1="22" y1="11" x2="16" y2="11" />
  </svg>
);

const MessageIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const HeartIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 16h5v5" />
  </svg>
);

const Recommendations = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectingId, setConnectingId] = useState(null);
  const [connectedIds, setConnectedIds] = useState(new Set());

  const [profile, setProfile] = useState(null);

  const loadRecommendations = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch both recommendations and profile to know if we should tell them to complete it
      const [recRes, profileRes] = await Promise.all([
        recommendationsApi.getPeople(),
        profileApi.getMe(),
      ]);
      setData(recRes);
      setProfile(profileRes);
    } catch (err) {
      console.error(err);
      setError('Failed to load recommendations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecommendations();
  }, []);

  const handleConnect = async (userId) => {
    setConnectingId(userId);
    try {
      await connectionsApi.request(userId);
      setConnectedIds(prev => new Set([...prev, userId]));
    } catch (err) {
      console.error('Failed to send connection request:', err);
    } finally {
      setConnectingId(null);
    }
  };

  const summary = useMemo(() => {
    if (!data?.items?.length) {
      return { total: 0, best: 0 };
    }
    const items = data.items;
    const sorted = [...items].sort((a, b) => (b.match_score || b.score || 0) - (a.match_score || a.score || 0));
    const best = sorted[0]?.match_score || sorted[0]?.score || 0;
    return { total: items.length, best };
  }, [data]);

  const recommendations = data?.items || [];

  return (
    <div className="rec-page">
      <PageIntro
        title="Recommendations"
        subtitle="AI-powered matching based on your skills, interests, and goals."
        side={(
          <div className="page-intro-side-stack">
            <div className="page-intro-metrics">
              <div className="page-intro-metric">
                <UsersIcon />
                <span className="page-intro-metric-value">{summary.total}</span>
                <span className="page-intro-metric-label">Suggested</span>
              </div>
              <div className="page-intro-metric highlight">
                <TrophyIcon />
                <span className="page-intro-metric-value">{summary.best}%</span>
                <span className="page-intro-metric-label">Top Match</span>
              </div>
            </div>

            <div className="page-intro-actions">
              <button
                className="rec-refresh-btn page-intro-button page-intro-button-secondary"
                onClick={loadRecommendations}
                disabled={loading}
              >
                <RefreshIcon />
                Refresh
              </button>
            </div>
          </div>
        )}
      />

      {/* Content */}
      <main className="rec-content">
        {loading ? (
          <div className="rec-loading">
            <div className="rec-loading-animation">
              <div className="rec-loading-circle"></div>
              <div className="rec-loading-circle"></div>
              <div className="rec-loading-circle"></div>
            </div>
            <h3>Finding your best matches...</h3>
            <p>Analyzing skills, interests, and compatibility</p>
          </div>
        ) : error ? (
          <div className="rec-error">
            <span>⚠️</span>
            <p>{error}</p>
            <button onClick={loadRecommendations}>Try Again</button>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="rec-empty">
            <div className="rec-empty-icon">
              <UsersIcon />
            </div>
            {/* Logic: if profile has skills/interests, then it's a "no match" issue. If not, it's "incomplete". */}
            {profile && (profile.skills?.length > 0 || profile.interests?.length > 0 || profile.mentor_areas_of_help?.length > 0) ? (
              <>
                <h3>No new recommendations</h3>
                <p>We couldn't find any new matches for you right now. Check back later as more alumni join!</p>
                <button onClick={loadRecommendations} className="rec-empty-btn secondary">
                  Refresh
                </button>
              </>
            ) : (
              <>
                <h3>No recommendations yet</h3>
                <p>Complete your profile with skills and interests to get personalized recommendations</p>
                <Link to="/profile/edit" className="rec-empty-btn">
                  Complete Profile
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="rec-grid">
            {recommendations.map((rec, index) => {
              // The API returns a flat list of items with 'target_user_id'
              // Some other APIs might return { user: { ... } }
              const rawUser = rec.user || rec;

              // Normalize the user object
              const user = {
                ...rawUser,
                id: rawUser.id || rawUser.target_user_id,
              };

              // Skip if no valid ID
              if (!user.id) return null;

              const matchScore = rec.match_score || rec.score || 0;
              const photoUrl = resolveUrl(user.photo_url);
              const isConnected = connectedIds.has(user.id);
              const isConnecting = connectingId === user.id;

              return (
                <article
                  key={user.id}
                  className="rec-card"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {/* Match Score Badge */}
                  <div className={`rec-match-badge ${matchScore >= 70 ? 'high' : matchScore >= 50 ? 'medium' : 'low'}`}>
                    {matchScore}% match
                  </div>

                  {/* Profile Section */}
                  <div className="rec-profile">
                    <div
                      className="rec-avatar"
                      onClick={() => navigate(`/profile/${user.id}`)}
                    >
                      <img
                        src={photoUrl || dicebear(user.name)}
                        alt={user.name}
                        onError={(e) => {
                          e.target.src = dicebear(user.name);
                        }}
                      />
                      {user.is_mentor && (
                        <span className="rec-mentor-badge" title="Available as mentor">
                          <GraduationCapIcon />
                        </span>
                      )}
                    </div>

                    <div className="rec-info">
                      <h3
                        className="rec-name"
                        onClick={() => navigate(`/profile/${user.id}`)}
                      >
                        {user.name}
                      </h3>

                      {user.headline && (
                        <p className="rec-headline">{user.headline}</p>
                      )}

                      <div className="rec-meta">
                        {user.role && (
                          <span className="rec-role">{user.role}</span>
                        )}
                        {user.location && (
                          <span className="rec-location">
                            <MapPinIcon /> {user.location}
                          </span>
                        )}
                        {user.graduation_year && (
                          <span className="rec-year">
                            <GraduationCapIcon /> Class of {user.graduation_year}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Skills */}
                  {(user.skills?.length > 0 || rec.shared_skills?.length > 0) && (
                    <div className="rec-skills">
                      {(rec.shared_skills || user.skills)?.slice(0, 4).map((skill, i) => (
                        <span key={i} className="rec-skill-tag">
                          {skill}
                        </span>
                      ))}
                      {(rec.shared_skills || user.skills)?.length > 4 && (
                        <span className="rec-skill-more">
                          +{(rec.shared_skills || user.skills).length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Match Reason */}
                  {(rec.reason || rec.reason_short) && (
                    <p className="rec-reason">
                      <HeartIcon />
                      {rec.reason || rec.reason_short}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="rec-actions">
                    <button
                      className={`rec-action-btn secondary`}
                      onClick={() => navigate(`/profile/${user.id}`)}
                    >
                      View Profile
                    </button>

                    {isConnected ? (
                      <button className="rec-action-btn connected" disabled>
                        <CheckIcon />
                        Request Sent
                      </button>
                    ) : (
                      <button
                        className="rec-action-btn primary"
                        onClick={() => handleConnect(user.id)}
                        disabled={isConnecting}
                      >
                        {isConnecting ? (
                          <span className="rec-btn-loader" />
                        ) : (
                          <>
                            <UserPlusIcon />
                            Connect
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Recommendations;
