import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { opportunitiesApi } from '../api/opportunities';
import { useAuth } from '../hooks/useAuth';

const BoltIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
  </svg>
);

const CompassIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
);

const BuildingIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="2" width="18" height="20" rx="2" />
    <path d="M9 22v-4h6v4" />
    <path d="M8 6h.01" />
    <path d="M16 6h.01" />
    <path d="M8 10h.01" />
    <path d="M16 10h.01" />
    <path d="M8 14h.01" />
    <path d="M16 14h.01" />
  </svg>
);

const Opportunities = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeDirectionKey, setActiveDirectionKey] = useState(null);
  const [currentScope, setCurrentScope] = useState(null);
  const [selectedGraduationYear, setSelectedGraduationYear] = useState(null);
  const [interestInput, setInterestInput] = useState('');
  const [appliedInterest, setAppliedInterest] = useState(null);
  const [interestSubmitting, setInterestSubmitting] = useState(false);
  const isBlocked = user?.is_admin || user?.role === 'STAFF';

  const loadData = async (
    directionKey = null,
    scopeValue = currentScope,
    graduationYearValue = selectedGraduationYear,
    interestValue = appliedInterest,
  ) => {
    try {
      setLoading(true);
      setError(null);
      const response = await opportunitiesApi.getMe(directionKey, scopeValue, graduationYearValue, interestValue);
      setData(response);
      setActiveDirectionKey(response.roadmap.target_direction_key);
      setCurrentScope(response.filters.current_scope);
      setSelectedGraduationYear(response.filters.selected_graduation_year ?? null);
      setAppliedInterest(response.context.requested_interest ?? null);
      setInterestInput(response.context.requested_interest ?? '');
    } catch (err) {
      console.error(err);
      if (err.response?.status === 409) {
        navigate('/dashboard', {
          replace: true,
          state: {
            opportunityGenerationStarted: true,
            opportunityInterest: appliedInterest || interestInput || null,
          },
        });
        return;
      }
      setError(err.response?.data?.detail || 'Failed to build your opportunity roadmap');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading || isBlocked) {
      return;
    }
    loadData();
  }, [authLoading, isBlocked]);

  if (authLoading) {
    return null;
  }

  if (isBlocked) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleInterestSubmit = (event) => {
    event.preventDefault();
    const trimmedInterest = interestInput.trim();
    if (!trimmedInterest) {
      return;
    }

    setInterestSubmitting(true);
    setError(null);
    opportunitiesApi.generateInterest(trimmedInterest)
      .then(() => {
        navigate('/dashboard', {
          replace: true,
          state: {
            opportunityGenerationStarted: true,
            opportunityInterest: trimmedInterest,
          },
        });
      })
      .catch((err) => {
        console.error(err);
        setError(err.response?.data?.detail || 'Failed to start roadmap generation');
      })
      .finally(() => {
        setInterestSubmitting(false);
      });
  };

  const handleInterestReset = async () => {
    setInterestInput('');
    try {
      await opportunitiesApi.clearInterest();
      loadData(null, currentScope, selectedGraduationYear, null);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to reset custom roadmap');
    }
  };

  const metrics = useMemo(() => {
    if (!data) {
      return [];
    }
    return [
      { label: 'Alumni Signals', value: data.market_snapshot.alumni_count, icon: <CompassIcon /> },
      { label: 'Directions', value: data.market_snapshot.direction_count, icon: <BoltIcon /> },
      { label: 'Gap Skills', value: data.context.gaps.length, icon: <BuildingIcon /> },
    ];
  }, [data]);

  const companyChartMax = useMemo(
    () => Math.max(...(data?.market_snapshot.company_chart || []).map((item) => item.count), 1),
    [data],
  );

  const roleChartMax = useMemo(
    () => Math.max(...(data?.market_snapshot.role_chart || []).map((item) => item.count), 1),
    [data],
  );

  if (loading) {
    return (
      <div className="opp-page">
        <div className="opp-loading-card">
          <div className="opp-loading-grid">
            <span />
            <span />
            <span />
          </div>
          <h2>Building your roadmap</h2>
          <p>We are mapping your skills against confirmed alumni outcomes.</p>
        </div>
      </div>
    );
  }

  if (error) {
      return (
        <div className="opp-page">
          <div className="opp-empty-state">
            <h2>Unable to load your opportunities</h2>
            <p>{error}</p>
          <button className="opp-cta-button" onClick={() => loadData()}>Try Again</button>
          </div>
        </div>
      );
    }

  if (!data) {
    return null;
  }

  return (
    <div className="opp-page">
      <section className="opp-ai-banner">
        <div className="opp-ai-copy">
          <span className="opp-ai-kicker">AI Track Suggestion</span>
          <h3>
            {data.context.using_custom_interest
              ? `You asked us to explore ${data.context.requested_interest}`
              : `We think your track of interest is ${data.roadmap.target_direction}`}
          </h3>
          <p>
            {data.context.using_custom_interest
              ? `We matched your input to the closest alumni-backed track and regenerated the roadmap around it.`
              : `This is an AI-generated suggestion based on your profile signal and observed alumni outcomes, not a fixed rule.`}
          </p>
        </div>

        <div className="opp-ai-side">
          <form className="opp-interest-form" onSubmit={handleInterestSubmit}>
            <label htmlFor="opp-interest-input" className="opp-interest-label">
              If you have a different interest, type it here
            </label>
            <div className="opp-interest-controls">
              <input
                id="opp-interest-input"
                type="text"
                className="opp-interest-input"
                value={interestInput}
                onChange={(event) => setInterestInput(event.target.value)}
                placeholder="Example: product management, cybersecurity, data engineering"
              />
              {appliedInterest && (
                <button
                  type="button"
                  className="opp-interest-secondary"
                  onClick={handleInterestReset}
                  disabled={interestSubmitting}
                >
                  Reset
                </button>
              )}
              <button
                type="submit"
                className="opp-interest-submit"
                disabled={interestSubmitting || !interestInput.trim()}
              >
                {interestSubmitting ? 'Starting...' : 'Generate'}
              </button>
            </div>
          </form>

          <div className="opp-intro-side">
            {metrics.map((item) => (
              <div key={item.label} className="opp-intro-metric">
                {item.icon}
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="opp-hero-card">
        <div className="opp-hero-copy">
          <span className="opp-kicker">Roadmap + Market Signal</span>
          <div className="opp-hero-note">
            {data.context.using_custom_interest ? (
              <>Your custom interest is <strong>{data.roadmap.target_direction}</strong></>
            ) : (
              <>We think that your track of interest is <strong>{data.roadmap.target_direction}</strong></>
            )}
          </div>
          <h2>{data.roadmap.target_direction}</h2>
          <p>{data.roadmap.rationale}</p>
          <div className="opp-chip-row compact">
            <span className="opp-chip">{data.roadmap.match_score}% match</span>
            <span className="opp-chip">{data.roadmap.role_family.replace('-', ' ')}</span>
          </div>
          {data.roadmap.observed_outcomes?.length > 0 && (
            <div className="opp-observed-copy">
              <strong>Observed role titles in this track:</strong>
              <span>{data.roadmap.observed_outcomes.join(', ')}</span>
            </div>
          )}
        </div>

        <div className="opp-hero-panels">
          <div className="opp-signal-card is-positive">
            <h3>You already have</h3>
            <div className="opp-chip-row">
              {(data.context.strengths.length ? data.context.strengths : data.context.current_skills.slice(0, 4)).map((skill) => (
                <span key={skill} className="opp-chip">{skill}</span>
              ))}
            </div>
          </div>

          <div className="opp-signal-card is-warning">
            <h3>Focus next</h3>
            <div className="opp-chip-row">
              {(data.context.gaps.length ? data.context.gaps : ['Add more skills to unlock sharper guidance']).map((skill) => (
                <span key={skill} className="opp-chip">{skill}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="opp-filter-bar">
        <div className="opp-filter-group">
          <span className="opp-filter-label">Scope</span>
          <div className="opp-filter-options">
            {data.filters.available_scopes.map((scope) => (
              <button
                key={scope}
                type="button"
                className={`opp-filter-pill ${data.filters.current_scope === scope ? 'active' : ''}`}
                onClick={() => loadData(activeDirectionKey, scope, selectedGraduationYear)}
              >
                {scope}
              </button>
            ))}
          </div>
        </div>

        {data.filters.available_graduation_years.length > 0 && (
          <div className="opp-filter-group">
            <span className="opp-filter-label">Graduation year</span>
            <div className="opp-filter-options">
              <button
                type="button"
                className={`opp-filter-pill ${!data.filters.selected_graduation_year ? 'active' : ''}`}
                onClick={() => loadData(activeDirectionKey, currentScope, null)}
              >
                all
              </button>
              {data.filters.available_graduation_years.map((year) => (
                <button
                  key={year}
                  type="button"
                  className={`opp-filter-pill ${data.filters.selected_graduation_year === year ? 'active' : ''}`}
                  onClick={() => loadData(activeDirectionKey, currentScope, year)}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="opp-grid">
        <aside className="opp-sidebar">
          <div className="opp-panel">
            <div className="opp-panel-header">
              <div>
                <span className="opp-panel-kicker">Cohort Snapshot</span>
                <h3>{data.context.cohort_label}</h3>
              </div>
            </div>

            <div className="opp-stats-list">
              <div className="opp-stat-row">
                <span>Top roles</span>
                <strong>{data.market_snapshot.top_roles.slice(0, 3).join(', ') || 'Insufficient data'}</strong>
              </div>
              <div className="opp-stat-row">
                <span>Top companies</span>
                <strong>{data.market_snapshot.top_companies.slice(0, 3).join(', ') || 'Insufficient data'}</strong>
              </div>
              <div className="opp-stat-row">
                <span>Your scope</span>
                <strong>{data.context.program || data.context.faculty || 'AITU-wide'}</strong>
              </div>
            </div>

            {data.market_snapshot.insights.length > 0 && (
              <div className="opp-insight-list">
                {data.market_snapshot.insights.map((insight) => (
                  <div key={insight} className="opp-insight-item">{insight}</div>
                ))}
              </div>
            )}
          </div>

          <div className="opp-panel">
            <div className="opp-panel-header">
              <div>
                <span className="opp-panel-kicker">Recommended Directions</span>
                <h3>Directions with the strongest signal</h3>
              </div>
            </div>

            <div className="opp-direction-list">
              {data.directions.map((direction) => (
                <button
                  key={direction.key}
                  type="button"
                  className={`opp-direction-card ${direction.key === activeDirectionKey ? 'active' : ''}`}
                  onClick={() => {
                    setInterestInput('');
                    loadData(direction.key, currentScope, selectedGraduationYear, null);
                  }}
                >
                  <div className="opp-direction-topline">
                    <h4>{direction.title}</h4>
                    <span>{direction.match_score}%</span>
                  </div>
                  <p>{direction.alumni_count} alumni currently contribute to this track</p>
                  {direction.top_outcomes?.length > 0 && (
                    <div className="opp-direction-outcomes">
                      Observed outcomes: {direction.top_outcomes.join(', ')}
                    </div>
                  )}
                  <div className="opp-chip-row compact">
                    {direction.common_skills.slice(0, 4).map((skill) => (
                      <span key={`${direction.key}-${skill}`} className="opp-chip">{skill}</span>
                    ))}
                  </div>
                  {direction.representative_path?.length > 0 && (
                    <div className="opp-direction-path">
                      {direction.representative_path.slice(0, 3).join(' → ')}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="opp-panel">
            <div className="opp-panel-header">
              <div>
                <span className="opp-panel-kicker">Outcome Charts</span>
                <h3>Where this cohort lands</h3>
              </div>
            </div>

            <div className="opp-chart-block">
              <h4>Top Companies</h4>
              <div className="opp-chart-list">
                {data.market_snapshot.company_chart.map((item) => (
                  <div key={item.label} className="opp-chart-row">
                    <div className="opp-chart-copy">
                      <span>{item.label}</span>
                      <strong>{item.count}</strong>
                    </div>
                    <div className="opp-chart-bar-track">
                      <div className="opp-chart-bar-fill" style={{ width: `${(item.count / companyChartMax) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="opp-chart-block">
              <h4>Top Roles</h4>
              <div className="opp-chart-list">
                {data.market_snapshot.role_chart.map((item) => (
                  <div key={item.label} className="opp-chart-row">
                    <div className="opp-chart-copy">
                      <span>{item.label}</span>
                      <strong>{item.count}</strong>
                    </div>
                    <div className="opp-chart-bar-track">
                      <div className="opp-chart-bar-fill is-role" style={{ width: `${(item.count / roleChartMax) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <section className="opp-main">
          <div className="opp-panel opp-transparency-panel">
            <div className="opp-panel-header">
              <div>
                <span className="opp-panel-kicker">How This Is Built</span>
                <h3>Observed data vs suggested roadmap</h3>
              </div>
            </div>

            <div className="opp-transparency-grid">
              <div className="opp-transparency-card">
                <strong>Observed from alumni data</strong>
                <p>Top roles, companies, transitions, cohort charts, and sample trajectories are aggregated from confirmed alumni records in the database.</p>
              </div>
              <div className="opp-transparency-card">
                <strong>Suggested roadmap</strong>
                <p>The stage layout is generated from the observed track, your current skills, and the common signals in that cohort. It is guidance, not ground truth.</p>
              </div>
            </div>
          </div>

          <div className="opp-panel opp-roadmap-panel">
            <div className="opp-panel-header">
              <div>
                <span className="opp-panel-kicker">Personal Roadmap</span>
                <h3>Your next path to {data.roadmap.target_direction}</h3>
              </div>
              <div className="opp-roadmap-badge">{data.roadmap.role_family.replace('-', ' ')}</div>
            </div>

            <div className="opp-roadmap-flow">
              {data.roadmap.stages.map((stage, index) => (
                <div key={stage.key} className={`opp-roadmap-stage ${stage.status}`}>
                  <div className="opp-stage-index">{String(index + 1).padStart(2, '0')}</div>
                  <div className="opp-stage-card">
                    <div className="opp-stage-header">
                      <div>
                        <span className="opp-stage-kicker">{stage.status}</span>
                        <h4>{stage.title}</h4>
                        {stage.subtitle && <p>{stage.subtitle}</p>}
                      </div>
                    </div>
                    <div className="opp-stage-items">
                      {stage.items.map((item) => (
                        <div key={`${stage.key}-${item}`} className="opp-stage-item">{item}</div>
                      ))}
                    </div>
                  </div>
                  {index < data.roadmap.stages.length - 1 && <div className="opp-stage-connector" aria-hidden="true" />}
                </div>
              ))}
            </div>
          </div>

          <div className="opp-lower-grid">
            <div className="opp-panel">
              <div className="opp-panel-header">
                <div>
                  <span className="opp-panel-kicker">Where Alumni Land</span>
                  <h3>Companies with strongest signal</h3>
                </div>
              </div>

              <div className="opp-company-stack">
                {(data.roadmap.top_companies.length ? data.roadmap.top_companies : data.market_snapshot.top_companies).map((company, index) => (
                  <div key={company} className="opp-company-row">
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{company}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="opp-panel">
              <div className="opp-panel-header">
                <div>
                  <span className="opp-panel-kicker">Sample Trajectories</span>
                  <h3>Observed roadmap patterns in confirmed data</h3>
                </div>
              </div>

              <div className="opp-path-list">
                {data.roadmap.real_paths.length > 0 ? data.roadmap.real_paths.map((item, index) => (
                  <article key={`${item.alumni_name}-${item.path.join('-')}`} className="opp-path-card">
                    <div className="opp-path-card-head">
                      <strong>Trajectory {String(index + 1).padStart(2, '0')}</strong>
                    </div>
                    <p>{item.path[item.path.length - 1] || 'Observed cohort outcome'}</p>
                    <div className="opp-path-ribbon">
                      {item.path.map((step, index) => (
                        <div key={`${step}-${index}`} className="opp-path-step">
                          <span>{step}</span>
                          {index < item.path.length - 1 && <i aria-hidden="true">→</i>}
                        </div>
                      ))}
                    </div>
                  </article>
                )) : (
                  <div className="opp-empty-inline">
                    <p>We need more confirmed alumni trajectories to show path examples.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="opp-panel">
            <div className="opp-panel-header">
              <div>
                <span className="opp-panel-kicker">Transition Graph</span>
                <h3>Most common moves in this cohort</h3>
              </div>
            </div>

            {data.transitions.length > 0 ? (
              <div className="opp-transition-list">
                {data.transitions.map((transition) => (
                  <div key={`${transition.from_step}-${transition.to_step}`} className="opp-transition-card">
                    <div className="opp-transition-steps">
                      <span>{transition.from_step}</span>
                      <i aria-hidden="true">→</i>
                      <span>{transition.to_step}</span>
                    </div>
                    <strong>{transition.count} alumni</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="opp-empty-inline">
                <p>We need more confirmed trajectories to show the most common transitions.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="opp-footer-note">
        <div>
          <strong>Want a sharper roadmap?</strong>
          <p>Complete your profile or import your resume so the analytics can compare you against stronger structured alumni signals.</p>
        </div>
        <div className="opp-footer-actions">
          <Link to="/profile/edit" className="opp-cta-button secondary">Edit Profile</Link>
          <Link to="/profile/resume-import" className="opp-cta-button">Import Resume</Link>
        </div>
      </section>
    </div>
  );
};

export default Opportunities;
