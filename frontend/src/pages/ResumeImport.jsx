import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '../components/ui/Alert';
import Pill from '../components/ui/Pill';
import Icon from '../components/ui/Icon';
import { resumesApi } from '../api/resumes';

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg', 'image/png', 'image/webp',
];

const IDENTITY_FIELDS = [
  { key: 'full_name', label: 'Full name', placeholder: 'Aizhan Kuanysh' },
  { key: 'faculty', label: 'Faculty', placeholder: 'Faculty of Engineering' },
  { key: 'program', label: 'Program', placeholder: 'Software Engineering' },
  { key: 'graduation_year', label: 'Graduation year', placeholder: '2026' },
  { key: 'current_role', label: 'Current role', placeholder: 'Backend Engineer' },
  { key: 'current_company', label: 'Current company', placeholder: 'Kaspi.kz' },
];

const statusTone = (status) => {
  if (status === 'FAILED') return 'err';
  if (status === 'COMPLETED' || status === 'CONFIRMED' || status === 'PARSED') return 'ok';
  if (status === 'NEEDS_REVIEW') return 'warm';
  return 'blue';
};

const cleanText = (v) => (v === null || v === undefined ? '' : String(v).trim());

const extractIdentityValue = (identity, key) => {
  const raw = identity?.[key];
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw.value ?? '';
  return raw ?? '';
};

const formatDateTime = (value) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const buildEditableDraft = (draftResponse) => {
  const source = draftResponse?.normalized_json || draftResponse?.draft_json || {};
  const identity = source.identity || {};
  return {
    identity: {
      full_name: extractIdentityValue(identity, 'full_name'),
      faculty: extractIdentityValue(identity, 'faculty'),
      program: extractIdentityValue(identity, 'program'),
      graduation_year: extractIdentityValue(identity, 'graduation_year'),
      current_role: extractIdentityValue(identity, 'current_role'),
      current_company: extractIdentityValue(identity, 'current_company'),
    },
    skills: (source.skills || []).filter((it) => it && typeof it === 'object').map((it) => ({
      ...it, name: cleanText(it.name), canonical_name: cleanText(it.canonical_name || it.name),
      source_snippet: cleanText(it.source_snippet), confidence: it.confidence ?? '',
      requires_review: Boolean(it.requires_review),
    })),
    employment: (source.employment || []).filter((it) => it && typeof it === 'object').map((it) => ({
      ...it, company: cleanText(it.company), role: cleanText(it.role),
      location: cleanText(it.location), start_date: cleanText(it.start_date),
      end_date: cleanText(it.end_date), description: cleanText(it.description),
      confidence: it.confidence ?? '', is_current: Boolean(it.is_current),
    })),
    education: (source.education || []).filter((it) => it && typeof it === 'object').map((it) => ({
      ...it, school: cleanText(it.school), degree: cleanText(it.degree),
      faculty: cleanText(it.faculty), program: cleanText(it.program),
      field_of_study: cleanText(it.field_of_study), start_date: cleanText(it.start_date),
      end_date: cleanText(it.end_date), description: cleanText(it.description),
      confidence: it.confidence ?? '',
    })),
  };
};

const normalizeNumberOrEmpty = (v) => {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = Number(v); return Number.isNaN(n) ? v : n;
};

const buildDraftPayload = (draftResponse, editableDraft) => {
  const source = draftResponse?.normalized_json || draftResponse?.draft_json || {};
  const sourceIdentity = source.identity || {};
  const identity = {};
  IDENTITY_FIELDS.forEach(({ key }) => {
    const value = cleanText(editableDraft.identity[key]); if (!value) return;
    const existing = sourceIdentity[key];
    identity[key] = existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...existing, value } : value;
  });
  const skills = editableDraft.skills.map((it) => ({
    ...it, name: cleanText(it.name), canonical_name: cleanText(it.canonical_name || it.name),
    source_snippet: cleanText(it.source_snippet), confidence: normalizeNumberOrEmpty(it.confidence),
    requires_review: Boolean(it.requires_review),
  })).filter((it) => it.name);
  const employment = editableDraft.employment.map((it) => ({
    ...it, company: cleanText(it.company), role: cleanText(it.role),
    location: cleanText(it.location), start_date: cleanText(it.start_date),
    end_date: cleanText(it.end_date), description: cleanText(it.description),
    confidence: normalizeNumberOrEmpty(it.confidence), is_current: Boolean(it.is_current),
  })).filter((it) => it.company);
  const education = editableDraft.education.map((it) => ({
    ...it, school: cleanText(it.school), degree: cleanText(it.degree),
    faculty: cleanText(it.faculty), program: cleanText(it.program),
    field_of_study: cleanText(it.field_of_study), start_date: cleanText(it.start_date),
    end_date: cleanText(it.end_date), description: cleanText(it.description),
    confidence: normalizeNumberOrEmpty(it.confidence),
  })).filter((it) => it.school);
  return { ...source, identity, skills, employment, education, _meta: { ...(source._meta || {}), edited_in_review_ui: true } };
};

const initialEmploymentItem = () => ({ company: '', role: '', location: '', start_date: '', end_date: '', description: '', is_current: false, confidence: '' });
const initialEducationItem = () => ({ school: '', degree: '', faculty: '', program: '', field_of_study: '', start_date: '', end_date: '', description: '', confidence: '' });
const initialSkillItem = () => ({ name: '', canonical_name: '', source_snippet: '', confidence: '', requires_review: false });

const ResumeImport = () => {
  const [imports, setImports] = useState([]);
  const [selectedImportId, setSelectedImportId] = useState(null);
  const [selectedImport, setSelectedImport] = useState(null);
  const [draft, setDraft] = useState(null);
  const [editableDraft, setEditableDraft] = useState(null);
  const [draftDirty, setDraftDirty] = useState(false);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState(null);
  const [processingConsent, setProcessingConsent] = useState(true);
  const [profilePublishConsent, setProfilePublishConsent] = useState(false);
  const [graphAnalyticsConsent, setGraphAnalyticsConsent] = useState(false);

  const introMetrics = useMemo(() => {
    const confirmed = imports.filter((it) => it.confirmation_status === 'CONFIRMED').length;
    const needsReview = imports.filter((it) => it.confirmation_status === 'NEEDS_REVIEW').length;
    return { total: imports.length, confirmed, needsReview };
  }, [imports]);

  useEffect(() => { loadImports(); }, []);
  useEffect(() => { if (selectedImportId) loadImportDetails(selectedImportId); }, [selectedImportId]);

  useEffect(() => {
    if (!selectedImportId || !selectedImport) return undefined;
    const active = new Set(['QUEUED', 'RUNNING']);
    if (!active.has(selectedImport.processing_status)) return undefined;
    const t = window.setInterval(() => loadImportDetails(selectedImportId, { silent: true }), 4000);
    return () => window.clearInterval(t);
  }, [selectedImportId, selectedImport]);

  const loadImports = async () => {
    try {
      setLoading(true);
      const response = await resumesApi.listImports();
      const items = response.items || [];
      setImports(items);
      if (!selectedImportId && items.length > 0) setSelectedImportId(items[0].id);
    } catch (err) { console.error(err); setNotice({ type: 'error', message: 'Failed to load resume imports' }); }
    finally { setLoading(false); }
  };

  const loadImportDetails = async (importId, options = {}) => {
    try {
      const item = await resumesApi.getImport(importId);
      setSelectedImport(item);
      setProfilePublishConsent(Boolean(item.profile_publish_consent));
      setGraphAnalyticsConsent(Boolean(item.graph_analytics_consent));
      setImports((prev) => prev.some((e) => e.id === item.id) ? prev.map((e) => (e.id === item.id ? item : e)) : [item, ...prev]);
      if (item.has_draft) {
        const draftResponse = await resumesApi.getDraft(importId);
        setDraft(draftResponse);
        setEditableDraft(buildEditableDraft(draftResponse));
        setDraftDirty(false);
      } else if (!options.silent) {
        setDraft(null); setEditableDraft(null); setDraftDirty(false);
      }
    } catch (err) {
      if (!options.silent) { console.error(err); setNotice({ type: 'error', message: 'Failed to load import details' }); }
    }
  };

  const handleUpload = async () => {
    if (!file) { setNotice({ type: 'error', message: 'Select a resume file first' }); return; }
    if (!processingConsent) { setNotice({ type: 'error', message: 'Processing consent is required' }); return; }
    if (!ACCEPTED_TYPES.includes(file.type)) { setNotice({ type: 'error', message: 'Supported files: PDF, DOCX, JPG, PNG, WEBP' }); return; }
    try {
      setUploading(true); setNotice(null);
      const { upload_url, file_url, object_name } = await resumesApi.getPresignedUrl(file.name, file.type);
      await resumesApi.uploadToStorage(upload_url, file);
      const created = await resumesApi.createImport({
        file_url, object_name, original_filename: file.name, mime_type: file.type,
        processing_consent: processingConsent,
        profile_publish_consent: profilePublishConsent,
        graph_analytics_consent: graphAnalyticsConsent,
      });
      setSelectedImportId(created.id); setFile(null);
      setNotice({ type: 'success', message: 'Resume uploaded and queued for processing' });
      await loadImports(); await loadImportDetails(created.id);
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', message: err.response?.data?.detail || 'Failed to upload resume' });
    } finally { setUploading(false); }
  };

  const persistDraft = async ({ silentNotice = false } = {}) => {
    if (!selectedImport || !draft || !editableDraft) return null;
    const normalizedJson = buildDraftPayload(draft, editableDraft);
    const updated = await resumesApi.updateDraft(selectedImport.id, {
      normalized_json: normalizedJson, field_confidences: draft.field_confidences,
    });
    setDraft(updated); setEditableDraft(buildEditableDraft(updated)); setDraftDirty(false);
    if (!silentNotice) setNotice({ type: 'success', message: 'Review changes saved' });
    return updated;
  };

  const handleSaveDraft = async () => {
    try { setSavingDraft(true); setNotice(null); await persistDraft(); }
    catch (err) { console.error(err); setNotice({ type: 'error', message: err.response?.data?.detail || 'Failed to save review changes' }); }
    finally { setSavingDraft(false); }
  };

  const handleConfirm = async () => {
    if (!selectedImport) return;
    try {
      setConfirming(true); setNotice(null);
      if (draftDirty && draft && editableDraft) await persistDraft({ silentNotice: true });
      const result = await resumesApi.confirmImport(selectedImport.id, {
        profile_publish_consent: profilePublishConsent, graph_analytics_consent: graphAnalyticsConsent,
      });
      setSelectedImport(result);
      setImports((prev) => prev.map((e) => (e.id === result.id ? result : e)));
      setNotice({ type: 'success', message: 'Resume confirmed and saved' });
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', message: err.response?.data?.detail || 'Failed to confirm resume import' });
    } finally { setConfirming(false); }
  };

  const handleReprocess = async () => {
    if (!selectedImport) return;
    try {
      setNotice(null);
      const result = await resumesApi.reprocessImport(selectedImport.id);
      setSelectedImport(result);
      setImports((prev) => prev.map((e) => (e.id === result.id ? result : e)));
      setNotice({ type: 'success', message: 'Resume re-queued for processing' });
    } catch (err) { console.error(err); setNotice({ type: 'error', message: err.response?.data?.detail || 'Failed to reprocess resume' }); }
  };

  const updateIdentityField = (key, value) => {
    setEditableDraft((p) => ({ ...p, identity: { ...p.identity, [key]: value } })); setDraftDirty(true);
  };
  const updateCollectionItem = (section, index, key, value) => {
    setEditableDraft((p) => ({ ...p, [section]: p[section].map((it, i) => (i === index ? { ...it, [key]: value } : it)) }));
    setDraftDirty(true);
  };
  const addCollectionItem = (section) => {
    const factories = { skills: initialSkillItem, employment: initialEmploymentItem, education: initialEducationItem };
    setEditableDraft((p) => ({ ...p, [section]: [...p[section], factories[section]()] }));
    setDraftDirty(true);
  };
  const removeCollectionItem = (section, index) => {
    setEditableDraft((p) => ({ ...p, [section]: p[section].filter((_, i) => i !== index) }));
    setDraftDirty(true);
  };

  const selectedSummary = useMemo(() => {
    if (!editableDraft) return { skills: 0, employment: 0, education: 0 };
    return {
      skills: editableDraft.skills.filter((it) => cleanText(it.name)).length,
      employment: editableDraft.employment.filter((it) => cleanText(it.company)).length,
      education: editableDraft.education.filter((it) => cleanText(it.school)).length,
    };
  }, [editableDraft]);

  const renderStatus = (status) => <Pill tone={statusTone(status)} dot>{status}</Pill>;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>RESUME IMPORT · WORKFLOW</div>
          <h1 className="h1">
            Import a <i>resume</i>,<br />review what we extracted.
          </h1>
        </div>
        <div className="page-head-actions">
          <Link to="/profile/edit" className="btn ghost">Back to profile</Link>
        </div>
      </div>

      <div className="stat-strip" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        <div className="stat"><div className="stat-label">Total imports</div><div className="stat-num">{introMetrics.total}</div></div>
        <div className="stat"><div className="stat-label">Confirmed</div><div className="stat-num ok">{introMetrics.confirmed}</div></div>
        <div className="stat"><div className="stat-label">Need review</div><div className="stat-num warm">{introMetrics.needsReview}</div></div>
      </div>

      {notice && <Alert type={notice.type === 'success' ? 'success' : 'error'}>{notice.message}</Alert>}

      <div className="responsive-two-col sidebar-left">
        {/* Sidebar */}
        <div className="panel" style={{ padding: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>NEW IMPORT</div>
          <div className="form-group">
            <input
              type="file"
              accept=".pdf,.docx,image/png,image/jpeg,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={{ padding: 6 }}
            />
            <div className="help">PDF, DOCX, JPG, PNG, WEBP. {file ? <b style={{ color: 'var(--ink)' }}>{file.name}</b> : 'No file selected.'}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontFamily: 'var(--sans)', textTransform: 'none', letterSpacing: 0, fontSize: 12 }}>
              <input type="checkbox" checked={processingConsent} onChange={(e) => setProcessingConsent(e.target.checked)} style={{ marginTop: 3 }} />
              I consent to AI processing of this resume.
            </label>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontFamily: 'var(--sans)', textTransform: 'none', letterSpacing: 0, fontSize: 12 }}>
              <input type="checkbox" checked={profilePublishConsent} onChange={(e) => setProfilePublishConsent(e.target.checked)} style={{ marginTop: 3 }} />
              Sync confirmed data to my public profile.
            </label>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontFamily: 'var(--sans)', textTransform: 'none', letterSpacing: 0, fontSize: 12 }}>
              <input type="checkbox" checked={graphAnalyticsConsent} onChange={(e) => setGraphAnalyticsConsent(e.target.checked)} style={{ marginTop: 3 }} />
              Use confirmed data for career graph analytics.
            </label>
          </div>

          <button className="btn primary block" onClick={handleUpload} disabled={uploading}>
            <Icon name="upload" size={12} /> {uploading ? 'Uploading…' : 'Upload resume'}
          </button>

          <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 14, marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <div className="eyebrow">HISTORY</div>
              <button className="btn sm ghost" onClick={loadImports} disabled={loading}><Icon name="refresh" size={12} /></button>
            </div>
            {loading ? <p className="mute" style={{ fontSize: 12 }}>Loading…</p>
              : imports.length === 0 ? <p className="mute" style={{ fontSize: 12 }}>No imports yet.</p>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {imports.map((item) => (
                    <button
                      key={item.id} type="button"
                      onClick={() => setSelectedImportId(item.id)}
                      style={{
                        textAlign: 'left',
                        padding: '10px 12px',
                        border: '1px solid ' + (selectedImportId === item.id ? 'var(--blue-line)' : 'var(--line-soft)'),
                        background: selectedImportId === item.id ? 'var(--surface-2)' : 'var(--surface)',
                        borderRadius: 8, cursor: 'pointer',
                        fontFamily: 'var(--sans)', color: 'var(--ink)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                        <strong style={{ fontSize: 12, overflowWrap: 'anywhere' }}>{item.original_filename}</strong>
                        {renderStatus(item.confirmation_status)}
                      </div>
                      <div className="mute mono" style={{ fontSize: 9.5, marginTop: 4 }}>
                        {item.processing_status} · {formatDateTime(item.created_at)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
          </div>
        </div>

        {/* Main */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!selectedImport ? (
            <div className="panel" style={{ padding: 28 }}>
              <div className="empty-block">
                <Icon name="doc" size={28} />
                <h3>Select an import</h3>
                <p>Upload a new resume or pick one from history to start review.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="panel" style={{ padding: 18 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {renderStatus(selectedImport.processing_status)}
                  {renderStatus(selectedImport.confirmation_status)}
                  {renderStatus(selectedImport.document_status)}
                  {draftDirty && <Pill tone="warm" dot>Unsaved changes</Pill>}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 14 }}>
                  <div style={{ minWidth: 0 }}>
                    <h2 className="h2" style={{ overflowWrap: 'anywhere' }}>{selectedImport.original_filename}</h2>
                    <div className="mute mono" style={{ fontSize: 10.5, marginTop: 4 }}>
                      {selectedImport.mime_type} · UPDATED {formatDateTime(selectedImport.updated_at || selectedImport.created_at)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button className="btn sm" onClick={handleReprocess}><Icon name="refresh" size={12} /> Reprocess</button>
                    <button className="btn sm" onClick={() => loadImportDetails(selectedImport.id)}>Reload</button>
                    <button className="btn sm primary" onClick={handleSaveDraft} disabled={!draft || savingDraft || !draftDirty}>
                      {savingDraft ? 'Saving…' : 'Save review'}
                    </button>
                  </div>
                </div>

                <div className="stat-strip" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                  <div className="stat">
                    <div className="stat-label">Identity</div>
                    <div className="h3" style={{ marginTop: 4 }}>{cleanText(editableDraft?.identity.full_name) || '—'}</div>
                    <div className="stat-sub">{cleanText(editableDraft?.identity.current_role) || 'Not extracted'}</div>
                  </div>
                  <div className="stat"><div className="stat-label">Skills</div><div className="stat-num">{selectedSummary.skills}</div><div className="stat-sub">recognized</div></div>
                  <div className="stat"><div className="stat-label">Employment</div><div className="stat-num">{selectedSummary.employment}</div><div className="stat-sub">entries</div></div>
                  <div className="stat"><div className="stat-label">Education</div><div className="stat-num">{selectedSummary.education}</div><div className="stat-sub">entries</div></div>
                </div>
              </div>

              {!draft || !editableDraft ? (
                <div className="panel" style={{ padding: 28 }}>
                  <div className="empty-block">
                    <Icon name="clock" size={28} />
                    <h3>Draft not ready yet</h3>
                    <p>The worker is still processing this resume. Use Reload in a few seconds.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="form-card">
                    <div className="form-card-head"><h3>Identity & current role</h3><p>What we pulled from the document.</p></div>
                    <div className="form-row">
                      {IDENTITY_FIELDS.map((field) => (
                        <div className="form-group" key={field.key} style={{ marginBottom: 0 }}>
                          <label>{field.label}</label>
                          <input
                            type="text"
                            value={editableDraft.identity[field.key]}
                            onChange={(e) => updateIdentityField(field.key, e.target.value)}
                            placeholder={field.placeholder}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Skills */}
                  <div className="form-card">
                    <div className="form-card-head" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div><h3>Skills</h3><p>{editableDraft.skills.length} extracted.</p></div>
                      <button className="btn sm" onClick={() => addCollectionItem('skills')}><Icon name="plus" size={12} /> Add skill</button>
                    </div>
                    {editableDraft.skills.length === 0 ? (
                      <div className="empty-block"><h3>No skills extracted</h3></div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {editableDraft.skills.map((skill, i) => (
                          <div key={`s${i}`} className="panel" style={{ padding: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                              <div className="eyebrow">SKILL · {String(i + 1).padStart(2, '0')}</div>
                              <button className="btn sm ghost" onClick={() => removeCollectionItem('skills', i)}><Icon name="trash" size={12} /></button>
                            </div>
                            <div className="form-row">
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label>Name</label>
                                <input type="text" value={skill.name} onChange={(e) => updateCollectionItem('skills', i, 'name', e.target.value)} placeholder="Python" />
                              </div>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label>Canonical name</label>
                                <input type="text" value={skill.canonical_name} onChange={(e) => updateCollectionItem('skills', i, 'canonical_name', e.target.value)} placeholder="python" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Employment */}
                  <div className="form-card">
                    <div className="form-card-head" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div><h3>Employment</h3><p>{editableDraft.employment.length} entries.</p></div>
                      <button className="btn sm" onClick={() => addCollectionItem('employment')}><Icon name="plus" size={12} /> Add</button>
                    </div>
                    {editableDraft.employment.length === 0 ? (
                      <div className="empty-block"><h3>No employment extracted</h3></div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {editableDraft.employment.map((item, i) => (
                          <div key={`e${i}`} className="panel" style={{ padding: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                              <div className="h3" style={{ fontSize: 13 }}>
                                {cleanText(item.role) || cleanText(item.company) || `Entry ${i + 1}`}
                              </div>
                              <button className="btn sm ghost" onClick={() => removeCollectionItem('employment', i)}><Icon name="trash" size={12} /></button>
                            </div>
                            <div className="form-row">
                              <div className="form-group" style={{ marginBottom: 0 }}><label>Company</label><input type="text" value={item.company} onChange={(e) => updateCollectionItem('employment', i, 'company', e.target.value)} /></div>
                              <div className="form-group" style={{ marginBottom: 0 }}><label>Role</label><input type="text" value={item.role} onChange={(e) => updateCollectionItem('employment', i, 'role', e.target.value)} /></div>
                            </div>
                            <div className="form-row" style={{ marginTop: 12 }}>
                              <div className="form-group" style={{ marginBottom: 0 }}><label>Location</label><input type="text" value={item.location} onChange={(e) => updateCollectionItem('employment', i, 'location', e.target.value)} /></div>
                              <div className="form-group" style={{ marginBottom: 0 }}><label>Start</label><input type="text" value={item.start_date} onChange={(e) => updateCollectionItem('employment', i, 'start_date', e.target.value)} placeholder="2023-06" /></div>
                              <div className="form-group" style={{ marginBottom: 0 }}><label>End</label><input type="text" value={item.end_date} onChange={(e) => updateCollectionItem('employment', i, 'end_date', e.target.value)} placeholder="2024-08" disabled={item.is_current} /></div>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--sans)', textTransform: 'none', letterSpacing: 0, fontSize: 12, marginTop: 12 }}>
                              <input type="checkbox" checked={!!item.is_current} onChange={(e) => updateCollectionItem('employment', i, 'is_current', e.target.checked)} />
                              I currently work here
                            </label>
                            <div className="form-group" style={{ marginTop: 12, marginBottom: 0 }}>
                              <label>Description</label>
                              <textarea value={item.description} rows="3" onChange={(e) => updateCollectionItem('employment', i, 'description', e.target.value)} placeholder="Key responsibilities, tech stack, outcomes" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Education */}
                  <div className="form-card">
                    <div className="form-card-head" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div><h3>Education</h3><p>{editableDraft.education.length} entries.</p></div>
                      <button className="btn sm" onClick={() => addCollectionItem('education')}><Icon name="plus" size={12} /> Add</button>
                    </div>
                    {editableDraft.education.length === 0 ? (
                      <div className="empty-block"><h3>No education extracted</h3></div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {editableDraft.education.map((item, i) => (
                          <div key={`d${i}`} className="panel" style={{ padding: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                              <div className="h3" style={{ fontSize: 13 }}>{cleanText(item.school) || `Entry ${i + 1}`}</div>
                              <button className="btn sm ghost" onClick={() => removeCollectionItem('education', i)}><Icon name="trash" size={12} /></button>
                            </div>
                            <div className="form-row">
                              <div className="form-group" style={{ marginBottom: 0 }}><label>School</label><input type="text" value={item.school} onChange={(e) => updateCollectionItem('education', i, 'school', e.target.value)} /></div>
                              <div className="form-group" style={{ marginBottom: 0 }}><label>Degree</label><input type="text" value={item.degree} onChange={(e) => updateCollectionItem('education', i, 'degree', e.target.value)} /></div>
                            </div>
                            <div className="form-row" style={{ marginTop: 12 }}>
                              <div className="form-group" style={{ marginBottom: 0 }}><label>Faculty</label><input type="text" value={item.faculty} onChange={(e) => updateCollectionItem('education', i, 'faculty', e.target.value)} /></div>
                              <div className="form-group" style={{ marginBottom: 0 }}><label>Program</label><input type="text" value={item.program} onChange={(e) => updateCollectionItem('education', i, 'program', e.target.value)} /></div>
                              <div className="form-group" style={{ marginBottom: 0 }}><label>Field</label><input type="text" value={item.field_of_study} onChange={(e) => updateCollectionItem('education', i, 'field_of_study', e.target.value)} /></div>
                            </div>
                            <div className="form-row" style={{ marginTop: 12 }}>
                              <div className="form-group" style={{ marginBottom: 0 }}><label>Start</label><input type="text" value={item.start_date} onChange={(e) => updateCollectionItem('education', i, 'start_date', e.target.value)} placeholder="2022-09" /></div>
                              <div className="form-group" style={{ marginBottom: 0 }}><label>End</label><input type="text" value={item.end_date} onChange={(e) => updateCollectionItem('education', i, 'end_date', e.target.value)} placeholder="2026-06" /></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Confirm */}
                  <div className="form-card blue-tint" style={{ borderColor: 'var(--blue-line)', background: 'linear-gradient(180deg, rgba(75,166,220,0.04), transparent), var(--surface)' }}>
                    <div className="form-card-head" style={{ borderBottomColor: 'var(--blue-line)' }}>
                      <h3>Confirm this resume as trusted data</h3>
                      <p>Only confirmed data becomes the trusted source for your profile sync and career records.</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--sans)', textTransform: 'none', letterSpacing: 0, fontSize: 12 }}>
                        <input type="checkbox" checked={profilePublishConsent} onChange={(e) => setProfilePublishConsent(e.target.checked)} />
                        Sync confirmed data into my public profile.
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--sans)', textTransform: 'none', letterSpacing: 0, fontSize: 12 }}>
                        <input type="checkbox" checked={graphAnalyticsConsent} onChange={(e) => setGraphAnalyticsConsent(e.target.checked)} />
                        Use confirmed data in career graph analytics.
                      </label>
                    </div>
                    <div className="form-actions">
                      <button className="btn" onClick={handleSaveDraft} disabled={savingDraft || !draftDirty}>{savingDraft ? 'Saving…' : 'Save review'}</button>
                      <button className="btn primary" onClick={handleConfirm} disabled={confirming}>
                        <Icon name="check" size={12} /> {confirming ? 'Confirming…' : 'Confirm resume data'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResumeImport;
