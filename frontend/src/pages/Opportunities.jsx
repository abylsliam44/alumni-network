import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { opportunitiesApi } from '../api/opportunities';
import { useAuth } from '../hooks/useAuth';
import Pill from '../components/ui/Pill';
import NumCap from '../components/ui/NumCap';
import Icon from '../components/ui/Icon';

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
      setLoading(true); setError(null);
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
          state: { opportunityGenerationStarted: true, opportunityInterest: appliedInterest || interestInput || null },
        });
        return;
      }
      setError(err.response?.data?.detail || 'Failed to build your opportunity roadmap');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (authLoading || isBlocked) return;
    loadData();
    /* eslint-disable-next-line */
  }, [authLoading, isBlocked]);

  if (authLoading) return null;
  if (isBlocked) return <Navigate to="/dashboard" replace />;

  const handleInterestSubmit = (e) => {
    e.preventDefault();
    const trimmed = interestInput.trim(); if (!trimmed) return;
    setInterestSubmitting(true); setError(null);
    opportunitiesApi.generateInterest(trimmed)
      .then(() => navigate('/dashboard', {
        replace: true,
        state: { opportunityGenerationStarted: true, opportunityInterest: trimmed },
      }))
      .catch((err) => {
        console.error(err);
        setError(err.response?.data?.detail || 'Failed to start roadmap generation');
      })
      .finally(() => setInterestSubmitting(false));
  };

  const handleInterestReset = async () => {
    setInterestInput('');
    try {
      await opportunitiesApi.clearInterest();
      loadData(null, currentScope, selectedGraduationYear, null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reset custom roadmap');
    }
  };

  const companyChartMax = useMemo(
    () => Math.max(...(data?.market_snapshot.company_chart || []).map((it) => it.count), 1),
    [data],
  );
  const roleChartMax = useMemo(
    () => Math.max(...(data?.market_snapshot.role_chart || []).map((it) => it.count), 1),
    [data],
  );

  if (loading) return <div className="page"><div className="loading-block">Building roadmap · mapping signals</div></div>;

  if (error) return (
    <div className="page">
      <div className="empty-block">
        <Icon name="alert" size={28} />
        <h3>Unable to load your opportunities</h3>
        <p>{error}</p>
        <button className="btn" onClick={() => loadData()}>Try again</button>
      </div>
    </div>
  );

  if (!data) return null;

  return (
    <div className="page">
      {/* Hero */}
      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>OPPORTUNITIES · QDRANT EMBEDDINGS</div>
          <h1 className="h1">
            {data.context.using_custom_interest
              ? <>Exploring <i>{data.context.requested_interest}</i></>
              : <>Your track of interest is <i>{data.roadmap.target_direction}</i></>}
          </h1>
          <p className="dim" style={{ marginTop: 12, fontSize: 14, lineHeight: 1.5, maxWidth: 720 }}>
            {data.context.using_custom_interest
              ? 'We matched your input to the closest alumni-backed track and regenerated the roadmap around it.'
              : 'AI-generated suggestion based on your profile signal and observed alumni outcomes.'}
          </p>
        </div>
      </div>

      <div className="panel" style={{ padding: 16, marginBottom: 24 }}>
        <form onSubmit={handleInterestSubmit} className="filter-grid interest">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Have a different interest? Generate a new roadmap</label>
            <input
              type="text" value={interestInput}
              onChange={(e) => setInterestInput(e.target.value)}
              placeholder="e.g. product management, cybersecurity, data engineering"
            />
          </div>
          {appliedInterest && (
            <button type="button" className="btn ghost" onClick={handleInterestReset} disabled={interestSubmitting}>
              Reset
            </button>
          )}
          <button type="submit" className="btn primary" disabled={interestSubmitting || !interestInput.trim()}>
            <Icon name="spark" size={12} /> {interestSubmitting ? 'Starting…' : 'Generate'}
          </button>
        </form>
      </div>

      <div className="stat-strip" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        <div className="stat"><div className="stat-label">Alumni signals</div><div className="stat-num blue">{data.market_snapshot.alumni_count}</div><div className="stat-sub">used to compute roadmap</div></div>
        <div className="stat"><div className="stat-label">Directions</div><div className="stat-num">{data.market_snapshot.direction_count}</div><div className="stat-sub">tracks suggested</div></div>
        <div className="stat"><div className="stat-label">Skill gaps</div><div className="stat-num warm">{data.context.gaps.length}</div><div className="stat-sub">to focus next</div></div>
      </div>

      {/* Hero card */}
      <div className="panel blue-tint" style={{ padding: 24, marginBottom: 24 }}>
        <div className="responsive-two-col">
          <div>
            <div className="eyebrow" style={{ marginBottom: 8, color: 'var(--blue)' }}>ROADMAP · MARKET SIGNAL</div>
            <h2 className="h2" style={{ marginBottom: 8, fontSize: 26 }}>{data.roadmap.target_direction}</h2>
            <p className="dim" style={{ fontSize: 13.5, lineHeight: 1.6 }}>{data.roadmap.rationale}</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              <Pill tone="blue" dot>{data.roadmap.match_score}% match</Pill>
              <Pill>{data.roadmap.role_family.replace('-', ' ')}</Pill>
            </div>
            {data.roadmap.observed_outcomes?.length > 0 && (
              <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--ink-2)' }}>
                <b style={{ color: 'var(--ink)' }}>Observed roles:</b> {data.roadmap.observed_outcomes.join(', ')}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="panel" style={{ padding: 14, background: 'var(--bg-2)' }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>YOU ALREADY HAVE</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(data.context.strengths.length ? data.context.strengths : data.context.current_skills.slice(0, 4)).map((s) => (
                  <span key={s} className="chip skill blue">{s}</span>
                ))}
              </div>
            </div>
            <div className="panel" style={{ padding: 14, background: 'var(--bg-2)' }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>FOCUS NEXT</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(data.context.gaps.length ? data.context.gaps : ['Add more skills']).map((s) => (
                  <span key={s} className="chip skill warm">{s}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="panel" style={{ padding: 14, marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>SCOPE</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {data.filters.available_scopes.map((scope) => (
                <button
                  key={scope} type="button"
                  className={`chip${data.filters.current_scope === scope ? ' blue' : ''}`}
                  onClick={() => loadData(activeDirectionKey, scope, selectedGraduationYear)}
                  style={{ cursor: 'pointer', fontFamily: 'var(--mono)' }}
                >
                  {scope}
                </button>
              ))}
            </div>
          </div>
          {data.filters.available_graduation_years.length > 0 && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>GRADUATION YEAR</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`chip${!data.filters.selected_graduation_year ? ' blue' : ''}`}
                  onClick={() => loadData(activeDirectionKey, currentScope, null)}
                  style={{ cursor: 'pointer', fontFamily: 'var(--mono)' }}
                >
                  all
                </button>
                {data.filters.available_graduation_years.map((year) => (
                  <button
                    key={year} type="button"
                    className={`chip${data.filters.selected_graduation_year === year ? ' blue' : ''}`}
                    onClick={() => loadData(activeDirectionKey, currentScope, year)}
                    style={{ cursor: 'pointer', fontFamily: 'var(--mono)' }}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="responsive-two-col content-heavy">
        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="panel">
            <div className="panel-head">
              <h3>Cohort snapshot</h3>
              <span className="mono mute" style={{ fontSize: 10 }}>{data.context.cohort_label}</span>
            </div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['Top roles', data.market_snapshot.top_roles.slice(0, 3).join(', ') || '—'],
                ['Top companies', data.market_snapshot.top_companies.slice(0, 3).join(', ') || '—'],
                ['Your scope', data.context.program || data.context.faculty || 'Platform-wide'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5 }}>
                  <span className="mute mono" style={{ fontSize: 10.5 }}>{k.toUpperCase()}</span>
                  <span style={{ color: 'var(--ink)', textAlign: 'right' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3>Recommended directions</h3></div>
            <div className="panel-body flush">
              {data.directions.map((direction) => (
                <button
                  key={direction.key} type="button"
                  className="list-row"
                  onClick={() => { setInterestInput(''); loadData(direction.key, currentScope, selectedGraduationYear, null); }}
                  style={{
                    width: '100%', textAlign: 'left',
                    background: direction.key === activeDirectionKey ? 'var(--surface-2)' : 'transparent',
                    border: 'none', borderTop: '1px solid var(--line-soft)', cursor: 'pointer',
                    display: 'block', padding: '14px 16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <h4 className="h3" style={{ fontSize: 13 }}>{direction.title}</h4>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--blue)' }}>{direction.match_score}%</span>
                  </div>
                  <div className="mute" style={{ fontSize: 11.5 }}>{direction.alumni_count} alumni</div>
                  {direction.common_skills.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                      {direction.common_skills.slice(0, 4).map((s) => <span key={s} className="chip skill">{s}</span>)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3>Outcome charts</h3></div>
            <div className="panel-body">
              <div className="eyebrow" style={{ marginBottom: 8 }}>TOP COMPANIES</div>
              {data.market_snapshot.company_chart.map((it) => (
                <div key={it.label} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: 'var(--ink-2)' }}>{it.label}</span>
                    <span className="mono" style={{ color: 'var(--blue)' }}>{it.count}</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 2 }}>
                    <div style={{ width: `${(it.count / companyChartMax) * 100}%`, height: '100%', background: 'var(--blue)', borderRadius: 2 }} />
                  </div>
                </div>
              ))}
              <div className="eyebrow" style={{ margin: '14px 0 8px' }}>TOP ROLES</div>
              {data.market_snapshot.role_chart.map((it) => (
                <div key={it.label} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: 'var(--ink-2)' }}>{it.label}</span>
                    <span className="mono" style={{ color: 'var(--warm)' }}>{it.count}</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 2 }}>
                    <div style={{ width: `${(it.count / roleChartMax) * 100}%`, height: '100%', background: 'var(--warm)', borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="panel" style={{ padding: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>HOW THIS IS BUILT</div>
            <div className="stack-grid-2">
              <div className="panel" style={{ padding: 14, background: 'var(--bg-2)' }}>
                <div className="h3">Observed from data</div>
                <div className="mute" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                  Top roles, companies, transitions, and trajectories aggregated from confirmed alumni records.
                </div>
              </div>
              <div className="panel" style={{ padding: 14, background: 'var(--bg-2)' }}>
                <div className="h3">Suggested roadmap</div>
                <div className="mute" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                  Stage layout generated from the observed track, your skills, and cohort signals. Guidance, not ground truth.
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div className="panel-head-title">
                <NumCap n={1} />
                <h3>Personal roadmap to {data.roadmap.target_direction}</h3>
              </div>
              <Pill>{data.roadmap.role_family.replace('-', ' ')}</Pill>
            </div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data.roadmap.stages.map((stage, i) => (
                <div key={stage.key} className="panel" style={{ padding: 14, background: stage.status === 'current' ? 'var(--blue-soft)' : 'var(--bg-2)', borderColor: stage.status === 'current' ? 'var(--blue-line)' : 'var(--line-soft)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <span className="numcap">{String(i + 1).padStart(2, '0')}</span>
                    <div style={{ flex: 1 }}>
                      <div className="mono mute" style={{ fontSize: 10 }}>{(stage.status || '').toUpperCase()}</div>
                      <h4 className="h3" style={{ fontSize: 14 }}>{stage.title}</h4>
                      {stage.subtitle && <div className="mute" style={{ fontSize: 12, marginTop: 2 }}>{stage.subtitle}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 10, borderTop: '1px dashed var(--line-soft)' }}>
                    {stage.items.map((it) => <span key={it} className="chip skill">{it}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="stack-grid-2" style={{ gap: 16 }}>
            <div className="panel">
              <div className="panel-head"><h3>Where alumni land</h3></div>
              <div className="panel-body flush">
                {(data.roadmap.top_companies.length ? data.roadmap.top_companies : data.market_snapshot.top_companies).map((company, i) => (
                  <div key={company} className="list-row">
                    <span className="numcap" style={{ fontSize: 22 }}>{String(i + 1).padStart(2, '0')}</span>
                    <strong style={{ fontSize: 13.5 }}>{company}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel">
              <div className="panel-head"><h3>Sample trajectories</h3></div>
              <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.roadmap.real_paths.length > 0 ? data.roadmap.real_paths.map((item, i) => (
                  <div key={`${item.alumni_name}-${i}`} className="panel" style={{ padding: 12, background: 'var(--bg-2)' }}>
                    <div className="eyebrow" style={{ marginBottom: 6 }}>TRAJECTORY {String(i + 1).padStart(2, '0')}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                      {item.path.map((step, idx) => (
                        <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span className="chip">{step}</span>
                          {idx < item.path.length - 1 && <span style={{ color: 'var(--blue)' }}>→</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )) : (
                  <p className="mute" style={{ fontSize: 12 }}>We need more confirmed trajectories to show examples.</p>
                )}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3>Most common transitions</h3></div>
            <div className="panel-body">
              {data.transitions.length > 0 ? (
                <div className="responsive-card-grid compact" style={{ gap: 10 }}>
                  {data.transitions.map((t) => (
                    <div key={`${t.from_step}-${t.to_step}`} className="panel" style={{ padding: 12, background: 'var(--bg-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                        <span style={{ color: 'var(--ink)' }}>{t.from_step}</span> <span style={{ color: 'var(--blue)' }}>→</span> <span style={{ color: 'var(--ink)' }}>{t.to_step}</span>
                      </div>
                      <span className="mono" style={{ fontSize: 10.5, color: 'var(--blue)' }}>{t.count} alumni</span>
                    </div>
                  ))}
                </div>
              ) : <p className="mute" style={{ fontSize: 12 }}>Need more trajectories.</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="panel warm-tint" style={{ padding: 18, marginTop: 24, display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6, color: 'var(--warm)' }}>SHARPEN ME</div>
          <div className="h3">Want a sharper roadmap?</div>
          <div className="mute" style={{ fontSize: 12.5, marginTop: 4 }}>
            Complete your profile or import your resume for stronger structured signals.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/profile/edit" className="btn">Edit profile</Link>
          <Link to="/profile/resume-import" className="btn primary">Import resume</Link>
        </div>
      </div>
    </div>
  );
};

export default Opportunities;
