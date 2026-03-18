import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import PageIntro from '../components/PageIntro';
import { resumesApi } from '../api/resumes';

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
];

const IDENTITY_FIELDS = [
  { key: 'full_name', label: 'Full name', placeholder: 'Abilay Slamzhanov' },
  { key: 'faculty', label: 'Faculty', placeholder: 'Faculty of Engineering' },
  { key: 'program', label: 'Program', placeholder: 'Software Engineering' },
  { key: 'graduation_year', label: 'Graduation year', placeholder: '2025' },
  { key: 'current_role', label: 'Current role', placeholder: 'Backend Engineer' },
  { key: 'current_company', label: 'Current company', placeholder: 'ForteBank' },
];

const statusTone = (status) => {
  if (status === 'FAILED') return 'error';
  if (status === 'COMPLETED' || status === 'CONFIRMED' || status === 'PARSED') return 'success';
  if (status === 'NEEDS_REVIEW') return 'warning';
  return 'info';
};

const cleanText = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const extractIdentityValue = (identity, key) => {
  const raw = identity?.[key];
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw.value ?? '';
  }
  return raw ?? '';
};

const formatDateTime = (value) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
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
    skills: (source.skills || [])
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        ...item,
        name: cleanText(item.name),
        canonical_name: cleanText(item.canonical_name || item.name),
        source_snippet: cleanText(item.source_snippet),
        confidence: item.confidence ?? '',
        requires_review: Boolean(item.requires_review),
      })),
    employment: (source.employment || [])
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        ...item,
        company: cleanText(item.company),
        role: cleanText(item.role),
        location: cleanText(item.location),
        start_date: cleanText(item.start_date),
        end_date: cleanText(item.end_date),
        description: cleanText(item.description),
        confidence: item.confidence ?? '',
        is_current: Boolean(item.is_current),
      })),
    education: (source.education || [])
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        ...item,
        school: cleanText(item.school),
        degree: cleanText(item.degree),
        faculty: cleanText(item.faculty),
        program: cleanText(item.program),
        field_of_study: cleanText(item.field_of_study),
        start_date: cleanText(item.start_date),
        end_date: cleanText(item.end_date),
        description: cleanText(item.description),
        confidence: item.confidence ?? '',
      })),
  };
};

const normalizeNumberOrEmpty = (value) => {
  if (value === '' || value === null || value === undefined) return undefined;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? value : numeric;
};

const buildDraftPayload = (draftResponse, editableDraft) => {
  const source = draftResponse?.normalized_json || draftResponse?.draft_json || {};
  const sourceIdentity = source.identity || {};

  const identity = {};
  IDENTITY_FIELDS.forEach(({ key }) => {
    const value = cleanText(editableDraft.identity[key]);
    if (!value) return;
    const existing = sourceIdentity[key];
    identity[key] = existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...existing, value }
      : value;
  });

  const skills = editableDraft.skills
    .map((item) => ({
      ...item,
      name: cleanText(item.name),
      canonical_name: cleanText(item.canonical_name || item.name),
      source_snippet: cleanText(item.source_snippet),
      confidence: normalizeNumberOrEmpty(item.confidence),
      requires_review: Boolean(item.requires_review),
    }))
    .filter((item) => item.name);

  const employment = editableDraft.employment
    .map((item) => ({
      ...item,
      company: cleanText(item.company),
      role: cleanText(item.role),
      location: cleanText(item.location),
      start_date: cleanText(item.start_date),
      end_date: cleanText(item.end_date),
      description: cleanText(item.description),
      confidence: normalizeNumberOrEmpty(item.confidence),
      is_current: Boolean(item.is_current),
    }))
    .filter((item) => item.company);

  const education = editableDraft.education
    .map((item) => ({
      ...item,
      school: cleanText(item.school),
      degree: cleanText(item.degree),
      faculty: cleanText(item.faculty),
      program: cleanText(item.program),
      field_of_study: cleanText(item.field_of_study),
      start_date: cleanText(item.start_date),
      end_date: cleanText(item.end_date),
      description: cleanText(item.description),
      confidence: normalizeNumberOrEmpty(item.confidence),
    }))
    .filter((item) => item.school);

  return {
    ...source,
    identity,
    skills,
    employment,
    education,
    _meta: {
      ...(source._meta || {}),
      edited_in_review_ui: true,
    },
  };
};

const initialEmploymentItem = () => ({
  company: '',
  role: '',
  location: '',
  start_date: '',
  end_date: '',
  description: '',
  is_current: false,
  confidence: '',
});

const initialEducationItem = () => ({
  school: '',
  degree: '',
  faculty: '',
  program: '',
  field_of_study: '',
  start_date: '',
  end_date: '',
  description: '',
  confidence: '',
});

const initialSkillItem = () => ({
  name: '',
  canonical_name: '',
  source_snippet: '',
  confidence: '',
  requires_review: false,
});

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

  const selectedStatus = useMemo(() => {
    if (!selectedImport) return null;
    return {
      processing: selectedImport.processing_status,
      confirmation: selectedImport.confirmation_status,
      document: selectedImport.document_status,
    };
  }, [selectedImport]);

  const introMetrics = useMemo(() => {
    const confirmed = imports.filter((item) => item.confirmation_status === 'CONFIRMED').length;
    const needsReview = imports.filter((item) => item.confirmation_status === 'NEEDS_REVIEW').length;
    return { total: imports.length, confirmed, needsReview };
  }, [imports]);

  useEffect(() => {
    loadImports();
  }, []);

  useEffect(() => {
    if (!selectedImportId) return;
    loadImportDetails(selectedImportId);
  }, [selectedImportId]);

  useEffect(() => {
    if (!selectedImportId || !selectedImport) return undefined;

    const activeStatuses = new Set(['QUEUED', 'RUNNING']);
    if (!activeStatuses.has(selectedImport.processing_status)) return undefined;

    const timer = window.setInterval(() => {
      loadImportDetails(selectedImportId, { silent: true });
    }, 4000);

    return () => window.clearInterval(timer);
  }, [selectedImportId, selectedImport]);

  const loadImports = async () => {
    try {
      setLoading(true);
      const response = await resumesApi.listImports();
      const items = response.items || [];
      setImports(items);
      if (!selectedImportId && items.length > 0) {
        setSelectedImportId(items[0].id);
      }
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', message: 'Failed to load resume imports' });
    } finally {
      setLoading(false);
    }
  };

  const loadImportDetails = async (importId, options = {}) => {
    try {
      const item = await resumesApi.getImport(importId);
      setSelectedImport(item);
      setProfilePublishConsent(Boolean(item.profile_publish_consent));
      setGraphAnalyticsConsent(Boolean(item.graph_analytics_consent));
      setImports((prev) => {
        const next = prev.some((entry) => entry.id === item.id)
          ? prev.map((entry) => (entry.id === item.id ? item : entry))
          : [item, ...prev];
        return next;
      });

      if (item.has_draft) {
        const draftResponse = await resumesApi.getDraft(importId);
        setDraft(draftResponse);
        setEditableDraft(buildEditableDraft(draftResponse));
        setDraftDirty(false);
      } else if (!options.silent) {
        setDraft(null);
        setEditableDraft(null);
        setDraftDirty(false);
      }
    } catch (err) {
      if (!options.silent) {
        console.error(err);
        setNotice({ type: 'error', message: 'Failed to load resume import details' });
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setNotice({ type: 'error', message: 'Select a resume file first' });
      return;
    }
    if (!processingConsent) {
      setNotice({ type: 'error', message: 'Processing consent is required' });
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setNotice({ type: 'error', message: 'Supported files: PDF, DOCX, JPG, PNG, WEBP' });
      return;
    }

    try {
      setUploading(true);
      setNotice(null);
      const { upload_url, file_url, object_name } = await resumesApi.getPresignedUrl(file.name, file.type);
      await resumesApi.uploadToStorage(upload_url, file);
      const created = await resumesApi.createImport({
        file_url,
        object_name,
        original_filename: file.name,
        mime_type: file.type,
        processing_consent: processingConsent,
        profile_publish_consent: profilePublishConsent,
        graph_analytics_consent: graphAnalyticsConsent,
      });
      setSelectedImportId(created.id);
      setNotice({ type: 'success', message: 'Resume uploaded and queued for processing' });
      setFile(null);
      await loadImports();
      await loadImportDetails(created.id);
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', message: err.response?.data?.detail || 'Failed to upload resume' });
    } finally {
      setUploading(false);
    }
  };

  const persistDraft = async ({ silentNotice = false } = {}) => {
    if (!selectedImport || !draft || !editableDraft) return null;
    const normalizedJson = buildDraftPayload(draft, editableDraft);
    const updated = await resumesApi.updateDraft(selectedImport.id, {
      normalized_json: normalizedJson,
      field_confidences: draft.field_confidences,
    });
    setDraft(updated);
    setEditableDraft(buildEditableDraft(updated));
    setDraftDirty(false);
    if (!silentNotice) {
      setNotice({ type: 'success', message: 'Review changes saved' });
    }
    return updated;
  };

  const handleSaveDraft = async () => {
    try {
      setSavingDraft(true);
      setNotice(null);
      await persistDraft();
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', message: err.response?.data?.detail || 'Failed to save review changes' });
    } finally {
      setSavingDraft(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedImport) return;
    try {
      setConfirming(true);
      setNotice(null);

      if (draftDirty && draft && editableDraft) {
        await persistDraft({ silentNotice: true });
      }

      const result = await resumesApi.confirmImport(selectedImport.id, {
        profile_publish_consent: profilePublishConsent,
        graph_analytics_consent: graphAnalyticsConsent,
      });
      setSelectedImport(result);
      setImports((prev) => prev.map((entry) => (entry.id === result.id ? result : entry)));
      setNotice({ type: 'success', message: 'Resume confirmed and saved' });
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', message: err.response?.data?.detail || 'Failed to confirm resume import' });
    } finally {
      setConfirming(false);
    }
  };

  const handleReprocess = async () => {
    if (!selectedImport) return;
    try {
      setNotice(null);
      const result = await resumesApi.reprocessImport(selectedImport.id);
      setSelectedImport(result);
      setImports((prev) => prev.map((entry) => (entry.id === result.id ? result : entry)));
      setNotice({ type: 'success', message: 'Resume re-queued for processing' });
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', message: err.response?.data?.detail || 'Failed to reprocess resume' });
    }
  };

  const updateIdentityField = (key, value) => {
    setEditableDraft((prev) => ({
      ...prev,
      identity: { ...prev.identity, [key]: value },
    }));
    setDraftDirty(true);
  };

  const updateCollectionItem = (section, index, key, value) => {
    setEditableDraft((prev) => ({
      ...prev,
      [section]: prev[section].map((item, itemIndex) => (
        itemIndex === index ? { ...item, [key]: value } : item
      )),
    }));
    setDraftDirty(true);
  };

  const addCollectionItem = (section) => {
    const factories = {
      skills: initialSkillItem,
      employment: initialEmploymentItem,
      education: initialEducationItem,
    };
    setEditableDraft((prev) => ({
      ...prev,
      [section]: [...prev[section], factories[section]()],
    }));
    setDraftDirty(true);
  };

  const removeCollectionItem = (section, index) => {
    setEditableDraft((prev) => ({
      ...prev,
      [section]: prev[section].filter((_, itemIndex) => itemIndex !== index),
    }));
    setDraftDirty(true);
  };

  const selectedSummary = useMemo(() => {
    if (!editableDraft) {
      return { skills: 0, employment: 0, education: 0 };
    }
    return {
      skills: editableDraft.skills.filter((item) => cleanText(item.name)).length,
      employment: editableDraft.employment.filter((item) => cleanText(item.company)).length,
      education: editableDraft.education.filter((item) => cleanText(item.school)).length,
    };
  }, [editableDraft]);

  return (
    <div className="resume-import-page">
      <PageIntro
        eyebrow="Profile Data Workflow"
        title="Resume Import"
        subtitle="Upload your resume, review the extracted profile data in a human-readable format, then confirm it as the trusted source for your career record."
        side={(
          <div className="page-intro-side-stack">
            <div className="page-intro-actions">
              <Link to="/profile/edit" className="page-intro-button page-intro-button-secondary">
                Back to profile
              </Link>
            </div>
            <div className="page-intro-metrics">
              <div className="page-intro-metric">
                <span className="page-intro-metric-value">{introMetrics.total}</span>
                <span className="page-intro-metric-label">Imports</span>
              </div>
              <div className="page-intro-metric">
                <span className="page-intro-metric-value">{introMetrics.confirmed}</span>
                <span className="page-intro-metric-label">Confirmed</span>
              </div>
              <div className="page-intro-metric highlight">
                <span className="page-intro-metric-value">{introMetrics.needsReview}</span>
                <span className="page-intro-metric-label">Need Review</span>
              </div>
            </div>
          </div>
        )}
      />

      {notice && <Alert type={notice.type}>{notice.message}</Alert>}
      {!notice && selectedImport?.confirmation_status === 'NEEDS_REVIEW' && selectedImport?.last_confirmed_at && (
        <Alert type="info">
          A newer extracted draft exists after your last confirmation. Review the sections below and confirm this import again.
        </Alert>
      )}

      <div className="resume-import-shell">
        <Card className="resume-import-sidebar">
          <div className="resume-panel-header">
            <div>
              <span className="resume-panel-kicker">New import</span>
              <h2>Upload a fresh resume</h2>
            </div>
          </div>

          <div className="resume-upload-box">
            <input
              type="file"
              accept=".pdf,.docx,image/png,image/jpeg,image/webp"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
            <div>
              <strong>{file ? file.name : 'Choose a PDF, DOCX, or image file'}</strong>
              <p>The extractor will turn your resume into reviewable profile sections instead of raw code.</p>
            </div>
          </div>

          <div className="resume-consent-stack">
            <label className="resume-check">
              <input
                type="checkbox"
                checked={processingConsent}
                onChange={(event) => setProcessingConsent(event.target.checked)}
              />
              <span>I consent to AI processing of this resume.</span>
            </label>
            <label className="resume-check">
              <input
                type="checkbox"
                checked={profilePublishConsent}
                onChange={(event) => setProfilePublishConsent(event.target.checked)}
              />
              <span>Allow confirmed data to sync into my public profile.</span>
            </label>
            <label className="resume-check">
              <input
                type="checkbox"
                checked={graphAnalyticsConsent}
                onChange={(event) => setGraphAnalyticsConsent(event.target.checked)}
              />
              <span>Allow confirmed data to be used for career graph analytics.</span>
            </label>
          </div>

          <Button onClick={handleUpload} disabled={uploading}>
            {uploading ? 'Uploading...' : 'Upload Resume'}
          </Button>

          <div className="resume-import-list">
            <div className="resume-import-list-header">
              <div>
                <span className="resume-panel-kicker">History</span>
                <h3>Your imports</h3>
              </div>
              <Button variant="secondary" onClick={loadImports} disabled={loading}>Refresh</Button>
            </div>
            {loading ? (
              <p className="resume-muted-copy">Loading imports...</p>
            ) : imports.length === 0 ? (
              <div className="resume-list-empty">
                <p>No resume imports yet.</p>
                <span>Your uploaded files and review sessions will appear here.</span>
              </div>
            ) : (
              imports.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`resume-import-item ${selectedImportId === item.id ? 'active' : ''}`}
                  onClick={() => setSelectedImportId(item.id)}
                >
                  <div className="resume-import-item-top">
                    <strong>{item.original_filename}</strong>
                    <span className={`resume-inline-pill tone-${statusTone(item.confirmation_status)}`}>
                      {item.confirmation_status}
                    </span>
                  </div>
                  <span>{item.processing_status} • {formatDateTime(item.created_at)}</span>
                </button>
              ))
            )}
          </div>
        </Card>

        <div className="resume-import-main">
          {!selectedImport ? (
            <Card className="resume-empty-state">
              <h2>Select an import</h2>
              <p>Choose an existing import or upload a new resume to start extraction and review.</p>
            </Card>
          ) : (
            <>
              <Card className="resume-overview-card">
                <div className="resume-overview-top">
                  <div>
                    <div className="resume-status-strip">
                      <span className={`resume-inline-pill tone-${statusTone(selectedStatus?.document)}`}>Document: {selectedStatus?.document}</span>
                      <span className={`resume-inline-pill tone-${statusTone(selectedStatus?.processing)}`}>Processing: {selectedStatus?.processing}</span>
                      <span className={`resume-inline-pill tone-${statusTone(selectedStatus?.confirmation)}`}>Confirmation: {selectedStatus?.confirmation}</span>
                      {draftDirty && <span className="resume-inline-pill tone-warning">Unsaved review changes</span>}
                    </div>

                    <h2>{selectedImport.original_filename}</h2>
                    <p>{selectedImport.mime_type} • Last updated {formatDateTime(selectedImport.updated_at || selectedImport.created_at)}</p>
                  </div>

                  <div className="resume-overview-actions">
                    <Button variant="secondary" onClick={handleReprocess}>Reprocess</Button>
                    <Button variant="secondary" onClick={() => loadImportDetails(selectedImport.id)}>Reload</Button>
                    <Button onClick={handleSaveDraft} disabled={!draft || savingDraft || !draftDirty}>
                      {savingDraft ? 'Saving...' : 'Save Review'}
                    </Button>
                  </div>
                </div>

                <div className="resume-summary-grid">
                  <div className="resume-summary-card">
                    <span className="resume-summary-label">Identity</span>
                    <strong>{cleanText(editableDraft?.identity.full_name) || 'Not detected yet'}</strong>
                    <span>{cleanText(editableDraft?.identity.current_role) || 'Role not extracted yet'}</span>
                  </div>
                  <div className="resume-summary-card">
                    <span className="resume-summary-label">Skills</span>
                    <strong>{selectedSummary.skills}</strong>
                    <span>recognized skills</span>
                  </div>
                  <div className="resume-summary-card">
                    <span className="resume-summary-label">Employment</span>
                    <strong>{selectedSummary.employment}</strong>
                    <span>experience entries</span>
                  </div>
                  <div className="resume-summary-card">
                    <span className="resume-summary-label">Education</span>
                    <strong>{selectedSummary.education}</strong>
                    <span>education entries</span>
                  </div>
                </div>
              </Card>

              {!draft || !editableDraft ? (
                <Card className="resume-empty-state">
                  <h2>Draft not ready yet</h2>
                  <p>The worker is still processing this resume. Keep this page open or use reload in a few seconds.</p>
                </Card>
              ) : (
                <>
                  <Card className="resume-review-card">
                    <div className="resume-section-header">
                      <div>
                        <span className="resume-panel-kicker">Review section</span>
                        <h3>Identity and current role</h3>
                      </div>
                    </div>
                    <div className="resume-field-grid">
                      {IDENTITY_FIELDS.map((field) => (
                        <label key={field.key} className="resume-field">
                          <span>{field.label}</span>
                          <input
                            type="text"
                            className="resume-input"
                            value={editableDraft.identity[field.key]}
                            onChange={(event) => updateIdentityField(field.key, event.target.value)}
                            placeholder={field.placeholder}
                          />
                        </label>
                      ))}
                    </div>
                  </Card>

                  <Card className="resume-review-card">
                    <div className="resume-section-header">
                      <div>
                        <span className="resume-panel-kicker">Review section</span>
                        <h3>Skills</h3>
                      </div>
                      <Button variant="secondary" onClick={() => addCollectionItem('skills')}>Add Skill</Button>
                    </div>
                    <div className="resume-entry-stack">
                      {editableDraft.skills.length === 0 ? (
                        <div className="resume-list-empty compact">
                          <p>No skills extracted yet.</p>
                        </div>
                      ) : (
                        editableDraft.skills.map((skill, index) => (
                          <div key={`skill-${index}`} className="resume-entry-card compact">
                            <div className="resume-entry-top">
                              <strong>Skill {index + 1}</strong>
                              <button type="button" className="resume-remove-btn" onClick={() => removeCollectionItem('skills', index)}>
                                Remove
                              </button>
                            </div>
                            <div className="resume-field-grid">
                              <label className="resume-field">
                                <span>Name</span>
                                <input
                                  type="text"
                                  className="resume-input"
                                  value={skill.name}
                                  onChange={(event) => updateCollectionItem('skills', index, 'name', event.target.value)}
                                  placeholder="Python"
                                />
                              </label>
                              <label className="resume-field">
                                <span>Canonical name</span>
                                <input
                                  type="text"
                                  className="resume-input"
                                  value={skill.canonical_name}
                                  onChange={(event) => updateCollectionItem('skills', index, 'canonical_name', event.target.value)}
                                  placeholder="python"
                                />
                              </label>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>

                  <Card className="resume-review-card">
                    <div className="resume-section-header">
                      <div>
                        <span className="resume-panel-kicker">Review section</span>
                        <h3>Employment</h3>
                      </div>
                      <Button variant="secondary" onClick={() => addCollectionItem('employment')}>Add Experience</Button>
                    </div>
                    <div className="resume-entry-stack">
                      {editableDraft.employment.length === 0 ? (
                        <div className="resume-list-empty compact">
                          <p>No employment entries extracted yet.</p>
                        </div>
                      ) : (
                        editableDraft.employment.map((item, index) => (
                          <div key={`employment-${index}`} className="resume-entry-card">
                            <div className="resume-entry-top">
                              <strong>{cleanText(item.role) || cleanText(item.company) || `Experience ${index + 1}`}</strong>
                              <button type="button" className="resume-remove-btn" onClick={() => removeCollectionItem('employment', index)}>
                                Remove
                              </button>
                            </div>

                            <div className="resume-field-grid">
                              <label className="resume-field">
                                <span>Company</span>
                                <input type="text" className="resume-input" value={item.company} onChange={(event) => updateCollectionItem('employment', index, 'company', event.target.value)} />
                              </label>
                              <label className="resume-field">
                                <span>Role</span>
                                <input type="text" className="resume-input" value={item.role} onChange={(event) => updateCollectionItem('employment', index, 'role', event.target.value)} />
                              </label>
                              <label className="resume-field">
                                <span>Location</span>
                                <input type="text" className="resume-input" value={item.location} onChange={(event) => updateCollectionItem('employment', index, 'location', event.target.value)} />
                              </label>
                              <label className="resume-field">
                                <span>Start date</span>
                                <input type="text" className="resume-input" value={item.start_date} onChange={(event) => updateCollectionItem('employment', index, 'start_date', event.target.value)} placeholder="2022-01" />
                              </label>
                              <label className="resume-field">
                                <span>End date</span>
                                <input type="text" className="resume-input" value={item.end_date} onChange={(event) => updateCollectionItem('employment', index, 'end_date', event.target.value)} placeholder="2024-03" />
                              </label>
                            </div>

                            <label className="resume-check inline">
                              <input
                                type="checkbox"
                                checked={Boolean(item.is_current)}
                                onChange={(event) => updateCollectionItem('employment', index, 'is_current', event.target.checked)}
                              />
                              <span>This is my current role</span>
                            </label>

                            <label className="resume-field">
                              <span>Description</span>
                              <textarea
                                className="resume-textarea"
                                rows="4"
                                value={item.description}
                                onChange={(event) => updateCollectionItem('employment', index, 'description', event.target.value)}
                                placeholder="Key responsibilities, tech stack, outcomes"
                              />
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>

                  <Card className="resume-review-card">
                    <div className="resume-section-header">
                      <div>
                        <span className="resume-panel-kicker">Review section</span>
                        <h3>Education</h3>
                      </div>
                      <Button variant="secondary" onClick={() => addCollectionItem('education')}>Add Education</Button>
                    </div>
                    <div className="resume-entry-stack">
                      {editableDraft.education.length === 0 ? (
                        <div className="resume-list-empty compact">
                          <p>No education entries extracted yet.</p>
                        </div>
                      ) : (
                        editableDraft.education.map((item, index) => (
                          <div key={`education-${index}`} className="resume-entry-card">
                            <div className="resume-entry-top">
                              <strong>{cleanText(item.school) || `Education ${index + 1}`}</strong>
                              <button type="button" className="resume-remove-btn" onClick={() => removeCollectionItem('education', index)}>
                                Remove
                              </button>
                            </div>

                            <div className="resume-field-grid">
                              <label className="resume-field">
                                <span>School</span>
                                <input type="text" className="resume-input" value={item.school} onChange={(event) => updateCollectionItem('education', index, 'school', event.target.value)} />
                              </label>
                              <label className="resume-field">
                                <span>Degree</span>
                                <input type="text" className="resume-input" value={item.degree} onChange={(event) => updateCollectionItem('education', index, 'degree', event.target.value)} />
                              </label>
                              <label className="resume-field">
                                <span>Faculty</span>
                                <input type="text" className="resume-input" value={item.faculty} onChange={(event) => updateCollectionItem('education', index, 'faculty', event.target.value)} />
                              </label>
                              <label className="resume-field">
                                <span>Program</span>
                                <input type="text" className="resume-input" value={item.program} onChange={(event) => updateCollectionItem('education', index, 'program', event.target.value)} />
                              </label>
                              <label className="resume-field">
                                <span>Field of study</span>
                                <input type="text" className="resume-input" value={item.field_of_study} onChange={(event) => updateCollectionItem('education', index, 'field_of_study', event.target.value)} />
                              </label>
                              <label className="resume-field">
                                <span>Start date</span>
                                <input type="text" className="resume-input" value={item.start_date} onChange={(event) => updateCollectionItem('education', index, 'start_date', event.target.value)} placeholder="2021-09" />
                              </label>
                              <label className="resume-field">
                                <span>End date</span>
                                <input type="text" className="resume-input" value={item.end_date} onChange={(event) => updateCollectionItem('education', index, 'end_date', event.target.value)} placeholder="2025-06" />
                              </label>
                            </div>

                            <label className="resume-field">
                              <span>Description</span>
                              <textarea
                                className="resume-textarea"
                                rows="4"
                                value={item.description}
                                onChange={(event) => updateCollectionItem('education', index, 'description', event.target.value)}
                                placeholder="Achievements, focus areas, or additional context"
                              />
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>

                  <Card className="resume-confirm-card">
                    <div className="resume-section-header">
                      <div>
                        <span className="resume-panel-kicker">Final step</span>
                        <h3>Confirm this resume as trusted data</h3>
                      </div>
                    </div>
                    <p className="resume-muted-copy">
                      Only confirmed data becomes the trusted source for your profile sync and career records.
                    </p>

                    <div className="resume-consent-stack">
                      <label className="resume-check">
                        <input
                          type="checkbox"
                          checked={profilePublishConsent}
                          onChange={(event) => setProfilePublishConsent(event.target.checked)}
                        />
                        <span>Sync confirmed data into my public profile.</span>
                      </label>
                      <label className="resume-check">
                        <input
                          type="checkbox"
                          checked={graphAnalyticsConsent}
                          onChange={(event) => setGraphAnalyticsConsent(event.target.checked)}
                        />
                        <span>Use confirmed data in career graph analytics.</span>
                      </label>
                    </div>

                    <div className="resume-confirm-actions">
                      <Button variant="secondary" onClick={handleSaveDraft} disabled={savingDraft || !draftDirty}>
                        {savingDraft ? 'Saving...' : 'Save Review'}
                      </Button>
                      <Button onClick={handleConfirm} disabled={confirming}>
                        {confirming ? 'Confirming...' : 'Confirm Resume Data'}
                      </Button>
                    </div>

                    {(draft.extraction_model || draft.extraction_version || draft.updated_at) && (
                      <div className="resume-processing-note">
                        <span>Processed with {draft.extraction_model || 'AI extraction pipeline'}</span>
                        {draft.extraction_version && <span>Version {draft.extraction_version}</span>}
                        <span>Draft updated {formatDateTime(draft.updated_at || draft.created_at)}</span>
                      </div>
                    )}
                  </Card>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        .resume-import-page {
          display: flex;
          flex-direction: column;
          gap: 24px;
          padding-bottom: 3rem;
        }

        .resume-import-shell {
          display: grid;
          grid-template-columns: minmax(280px, 320px) minmax(0, 1fr);
          gap: 22px;
          align-items: start;
        }

        .resume-import-sidebar,
        .resume-overview-card,
        .resume-review-card,
        .resume-confirm-card,
        .resume-empty-state {
          padding: 22px;
          border-radius: 28px;
          border: 1px solid rgba(17, 24, 39, 0.08);
          background:
            radial-gradient(circle at top right, rgba(47, 111, 237, 0.08), transparent 26%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(249, 250, 252, 0.97));
          box-shadow: 0 18px 50px rgba(15, 23, 42, 0.07);
        }

        .resume-import-main {
          display: grid;
          gap: 18px;
        }

        .resume-panel-header,
        .resume-section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
        }

        .resume-panel-header h2,
        .resume-section-header h3,
        .resume-empty-state h2 {
          margin: 6px 0 0;
          font-size: 1.32rem;
          letter-spacing: -0.03em;
          color: #111827;
          line-height: 1.12;
        }

        .resume-panel-kicker {
          display: inline-flex;
          align-items: center;
          min-height: 30px;
          padding: 0 10px;
          border-radius: 999px;
          background: rgba(17, 24, 39, 0.06);
          color: #334155;
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }

        .resume-upload-box {
          display: grid;
          gap: 14px;
          padding: 18px;
          border-radius: 22px;
          border: 1px dashed rgba(148, 163, 184, 0.42);
          background: linear-gradient(180deg, rgba(248, 250, 252, 0.95), rgba(255, 255, 255, 0.9));
        }

        .resume-upload-box input {
          max-width: 100%;
        }

        .resume-upload-box strong {
          display: block;
          color: #111827;
          line-height: 1.4;
        }

        .resume-upload-box p,
        .resume-muted-copy,
        .resume-empty-state p,
        .resume-list-empty span {
          margin: 8px 0 0;
          color: #667085;
          line-height: 1.65;
        }

        .resume-consent-stack {
          display: grid;
          gap: 12px;
        }

        .resume-check {
          display: grid;
          grid-template-columns: 18px minmax(0, 1fr);
          gap: 12px;
          align-items: start;
          padding: 14px 16px;
          border-radius: 18px;
          background: rgba(17, 24, 39, 0.04);
          border: 1px solid rgba(17, 24, 39, 0.06);
        }

        .resume-check.inline {
          margin-top: 4px;
        }

        .resume-check input {
          margin-top: 4px;
          width: 16px;
          height: 16px;
        }

        .resume-check span {
          color: #1f2937;
          line-height: 1.55;
          font-size: 0.95rem;
        }

        .resume-import-list {
          display: grid;
          gap: 12px;
          margin-top: 8px;
        }

        .resume-import-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .resume-import-list-header h3 {
          margin: 6px 0 0;
          font-size: 1.12rem;
          color: #111827;
        }

        .resume-import-list-header .btn {
          margin-left: auto;
        }

        .resume-import-item {
          display: grid;
          gap: 8px;
          padding: 16px;
          text-align: left;
          border-radius: 20px;
          border: 1px solid rgba(17, 24, 39, 0.08);
          background: rgba(255, 255, 255, 0.94);
          cursor: pointer;
          transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .resume-import-item:hover {
          transform: translateY(-1px);
          border-color: rgba(17, 24, 39, 0.14);
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
        }

        .resume-import-item.active {
          border-color: #2f6fed;
          box-shadow: 0 0 0 3px rgba(47, 111, 237, 0.12);
        }

        .resume-import-item-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .resume-import-item strong {
          color: #111827;
          line-height: 1.4;
          font-size: 0.98rem;
          overflow-wrap: anywhere;
        }

        .resume-import-item span {
          color: #667085;
          font-size: 0.84rem;
        }

        .resume-inline-pill {
          display: inline-flex;
          align-items: center;
          min-height: 30px;
          max-width: 100%;
          padding: 0 11px;
          border-radius: 999px;
          font-size: 0.64rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          line-height: 1.15;
          text-align: center;
          overflow-wrap: anywhere;
        }

        .tone-info {
          background: rgba(59, 130, 246, 0.12);
          color: #1d4ed8;
        }

        .tone-success {
          background: rgba(16, 185, 129, 0.13);
          color: #047857;
        }

        .tone-error {
          background: rgba(239, 68, 68, 0.12);
          color: #b91c1c;
        }

        .tone-warning {
          background: rgba(245, 158, 11, 0.14);
          color: #b45309;
        }

        .resume-overview-top {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: flex-start;
        }

        .resume-status-strip {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 14px;
        }

        .resume-overview-top h2 {
          margin: 0;
          font-size: 1.6rem;
          line-height: 1.06;
          letter-spacing: -0.04em;
          color: #111827;
          overflow-wrap: anywhere;
        }

        .resume-overview-top p {
          margin: 10px 0 0;
          color: #667085;
          font-size: 0.92rem;
        }

        .resume-overview-actions,
        .resume-confirm-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .resume-summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-top: 20px;
        }

        .resume-summary-card {
          padding: 18px;
          border-radius: 22px;
          border: 1px solid rgba(17, 24, 39, 0.08);
          background: rgba(255, 255, 255, 0.76);
        }

        .resume-summary-label {
          display: block;
          font-size: 0.72rem;
          letter-spacing: 0.11em;
          text-transform: uppercase;
          color: #7b8499;
          margin-bottom: 10px;
        }

        .resume-summary-card strong {
          display: block;
          color: #111827;
          font-size: 1.08rem;
          line-height: 1.18;
          overflow-wrap: anywhere;
        }

        .resume-summary-card span:last-child {
          display: block;
          margin-top: 6px;
          color: #667085;
          line-height: 1.5;
          font-size: 0.88rem;
        }

        .resume-field-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .resume-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .resume-field span {
          font-size: 0.84rem;
          font-weight: 700;
          color: #1f2937;
        }

        .resume-input,
        .resume-textarea {
          width: 100%;
          box-sizing: border-box;
          border-radius: 18px;
          border: 1px solid rgba(17, 24, 39, 0.1);
          background: rgba(255, 255, 255, 0.95);
          color: #111827;
          font: inherit;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
        }

        .resume-input {
          min-height: 48px;
          padding: 0 16px;
          font-size: 0.95rem;
        }

        .resume-textarea {
          min-height: 120px;
          padding: 14px 16px;
          resize: vertical;
          font-size: 0.95rem;
        }

        .resume-input:focus,
        .resume-textarea:focus {
          outline: none;
          border-color: #2f6fed;
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(47, 111, 237, 0.12);
        }

        .resume-entry-stack {
          display: grid;
          gap: 14px;
        }

        .resume-entry-card {
          padding: 18px;
          border-radius: 24px;
          border: 1px solid rgba(17, 24, 39, 0.08);
          background: rgba(255, 255, 255, 0.78);
          display: grid;
          gap: 14px;
        }

        .resume-entry-card.compact {
          gap: 12px;
        }

        .resume-entry-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
        }

        .resume-entry-top strong {
          color: #111827;
          line-height: 1.4;
          font-size: 1rem;
          overflow-wrap: anywhere;
        }

        .resume-remove-btn {
          border: 0;
          background: rgba(239, 68, 68, 0.1);
          color: #b91c1c;
          border-radius: 999px;
          min-height: 34px;
          padding: 0 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .resume-list-empty {
          padding: 18px;
          border-radius: 20px;
          border: 1px dashed rgba(148, 163, 184, 0.34);
          background: rgba(248, 250, 252, 0.8);
        }

        .resume-list-empty.compact {
          padding: 16px;
        }

        .resume-list-empty p {
          margin: 0;
          color: #334155;
          font-weight: 600;
        }

        .resume-confirm-card {
          display: grid;
          gap: 16px;
        }

        .resume-processing-note {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          padding-top: 6px;
          color: #667085;
          font-size: 0.92rem;
        }

        .resume-empty-state {
          min-height: 320px;
          display: grid;
          place-content: center;
          text-align: center;
          gap: 10px;
        }

        @media (max-width: 1180px) {
          .resume-import-shell {
            grid-template-columns: 1fr;
          }

          .resume-overview-top {
            flex-direction: column;
          }

          .resume-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .resume-import-page {
            gap: 18px;
          }

          .resume-import-sidebar,
          .resume-overview-card,
          .resume-review-card,
          .resume-confirm-card,
          .resume-empty-state {
            padding: 18px;
            border-radius: 24px;
          }

          .resume-field-grid,
          .resume-summary-grid {
            grid-template-columns: 1fr;
          }

          .resume-panel-header,
          .resume-section-header,
          .resume-import-item-top,
          .resume-entry-top {
            flex-direction: column;
            align-items: flex-start;
          }

          .resume-import-list-header,
          .resume-overview-actions,
          .resume-confirm-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .resume-overview-actions .btn,
          .resume-confirm-actions .btn,
          .resume-import-list-header .btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default ResumeImport;
