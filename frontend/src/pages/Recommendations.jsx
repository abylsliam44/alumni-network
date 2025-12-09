import { useEffect, useState, useMemo } from 'react';
import Card from '../components/ui/Card';
import { recommendationsApi } from '../api/recommendations';

const chipClass =
  'pill' +
  ' bg-[var(--bg-elevated-soft)] border border-[var(--border-subtle)] text-sm';

const Badge = ({ value }) => (
  <div
    className="pill"
    style={{
      background: 'linear-gradient(135deg, #22c55e, #3b82f6)',
      color: '#fff',
      fontWeight: 700,
      padding: '8px 12px',
    }}
  >
    {value}
  </div>
);

const SkeletonCard = () => (
  <div className="card" style={{ padding: 20, display: 'grid', gap: 12 }}>
    <div className="skeleton-line" />
    <div className="skeleton-line" style={{ width: '60%' }} />
    <div className="pill-row">
      <div className="skeleton-line" style={{ width: 80, height: 26 }} />
      <div className="skeleton-line" style={{ width: 60, height: 26 }} />
      <div className="skeleton-line" style={{ width: 100, height: 26 }} />
    </div>
  </div>
);

const RecommendationCard = ({ rec }) => {
  return (
    <Card className="recommendation-card">
      <div className="card-top" style={{ alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '999px',
              background:
                rec.photo_url ||
                'linear-gradient(135deg, #111827, #374151, #0ea5e9)',
              backgroundSize: 'cover',
              backgroundImage: rec.photo_url ? `url(${rec.photo_url})` : undefined,
              border: '2px solid var(--border-subtle)',
            }}
          />
          <div>
            <h3 style={{ margin: 0 }}>{rec.name || 'Alumni'}</h3>
            <p className="text-secondary" style={{ margin: '4px 0' }}>
              {rec.role || 'Member'}
              {rec.graduation_year ? ` · Class of ${rec.graduation_year}` : ''}
              {rec.location ? ` · ${rec.location}` : ''}
            </p>
            {rec.mentor_headline && (
              <p className="text-secondary" style={{ margin: 0 }}>
                {rec.mentor_headline}
              </p>
            )}
          </div>
        </div>
        <Badge value={`${rec.match_score}% match`} />
      </div>

      <div className="pill-row" style={{ marginTop: 12 }}>
        {rec.shared_skills?.slice(0, 4).map((skill) => (
          <span key={skill} className={chipClass}>
            {skill}
          </span>
        ))}
        {rec.shared_interests?.slice(0, 3).map((interest) => (
          <span key={interest} className={chipClass}>
            {interest}
          </span>
        ))}
      </div>

      <p className="text-secondary" style={{ marginTop: 12 }}>
        {rec.reason_short}
      </p>

      <div className="card-meta" style={{ marginTop: 16, justifyContent: 'space-between' }}>
        <span className="pill">
          {rec.available_for_mentorship ? 'Open to mentor' : 'Open to connect'}
        </span>
        <button className="btn btn-primary" style={{ borderRadius: 999 }}>
          {rec.role === 'ALUMNI' ? 'Connect' : 'Request mentorship'}
        </button>
      </div>
    </Card>
  );
};

const Recommendations = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [initialMessage, setInitialMessage] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setInitialMessage(true);
      const minDelay = new Promise((resolve) => setTimeout(resolve, 1500));
      try {
        const res = await recommendationsApi.getPeople();
        setData(res);
      } catch (err) {
        setError('Failed to load recommendations. Please try again.');
      } finally {
        await minDelay;
        setInitialMessage(false);
        setLoading(false);
      }
    };
    load();
  }, []);

  const summary = useMemo(() => {
    if (!data?.items?.length) return { total: 0, best: 0, interests: [] };
    const sorted = [...data.items].sort((a, b) => b.match_score - a.match_score);
    const best = sorted[0]?.match_score || 0;
    const interests = sorted[0]?.shared_interests || [];
    return { total: data.items.length, best, interests };
  }, [data]);

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="rec-hero">
        <div className="page-header" style={{ marginBottom: 12 }}>
        <h1>Recommendations</h1>
          <p>
            AI-powered mentor/mentee matching based on your skills and interests. Personalized and refreshed on each visit.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="pill">
            <strong>{summary.total}</strong> people suggested
          </div>
          <div className="pill">
            Top match: <strong>{summary.best}%</strong>
          </div>
          <div className="pill-row">
            {summary.interests.slice(0, 3).map((i) => (
              <span key={i} className={chipClass}>
                {i}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-vertical" style={{ gap: 16 }}>
        {loading && (
        <Card style={{ textAlign: 'center', padding: 32, backdropFilter: 'blur(6px)' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div className="rec-loader" />
            <div className="text-secondary" style={{ fontWeight: 600 }}>
              {initialMessage
                ? 'We are looking for the best mentors for you...'
                : 'Fetching fresh matches...'}
            </div>
          </div>
        </Card>
        )}

        {!loading && error && (
          <Card>
            <p className="text-secondary">{error}</p>
          </Card>
        )}

        {!loading && !error && data?.items?.length === 0 && (
          <Card>
            <p className="text-secondary">
              We don&apos;t have enough data to generate recommendations. Please complete your
              profile (skills, interests, goals).
            </p>
          </Card>
        )}

        {!loading &&
          !error &&
          data?.items?.map((item) => <RecommendationCard key={item.target_user_id} rec={item} />)}
      </div>
    </div>
  );
};

export default Recommendations;

