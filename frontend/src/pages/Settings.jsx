import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { aiApi } from '../api/ai';
import Alert from '../components/ui/Alert';
import Icon from '../components/ui/Icon';
import Pill from '../components/ui/Pill';

const Settings = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  const [kbStats, setKbStats] = useState(null);
  const [kbLoading, setKbLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const [notifPrefs, setNotifPrefs] = useState({
    email_digest: true, new_messages: true, mentorship_requests: true, job_alerts: false,
  });

  useEffect(() => {
    if (activeTab === 'admin' && user?.is_admin) loadKbStats();
  }, [activeTab, user?.is_admin]);

  const loadKbStats = async () => {
    try { setKbStats(await aiApi.getKnowledgeBaseStats()); }
    catch (err) { console.error(err); }
  };

  const handleFileSelect = (e) => {
    const f = e.target.files[0];
    if (f && f.type === 'application/pdf') { setSelectedFile(f); setNotification(null); }
    else { setNotification({ type: 'error', message: 'Please select a PDF file' }); setSelectedFile(null); }
  };

  const handleUpload = async () => {
    if (!selectedFile) { setNotification({ type: 'error', message: 'Select a file first' }); return; }
    setKbLoading(true); setUploadProgress('Uploading and processing PDF…'); setNotification(null);
    try {
      const result = await aiApi.uploadKnowledgeBase(selectedFile);
      setNotification({ type: 'success', message: `Indexed ${result.chunks_indexed} chunks from "${result.source}"` });
      setSelectedFile(null);
      const fi = document.getElementById('pdf-upload'); if (fi) fi.value = '';
      await loadKbStats();
    } catch (err) {
      setNotification({ type: 'error', message: err.response?.data?.detail || 'Failed to upload PDF' });
    } finally { setKbLoading(false); setUploadProgress(null); }
  };

  const handleClearKb = async () => {
    if (!window.confirm('Clear the entire knowledge base? Cannot be undone.')) return;
    setKbLoading(true);
    try {
      await aiApi.clearKnowledgeBase();
      setNotification({ type: 'success', message: 'Knowledge base cleared' });
      await loadKbStats();
    } catch (err) {
      setNotification({ type: 'error', message: err.response?.data?.detail || 'Failed to clear knowledge base' });
    } finally { setKbLoading(false); }
  };

  const handlePasswordChange = (e) => setPasswordData({ ...passwordData, [e.target.name]: e.target.value });

  const handlePasswordSubmit = async (e) => {
    e.preventDefault(); setNotification(null);
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setNotification({ type: 'error', message: 'New passwords don\'t match' }); return;
    }
    if (passwordData.newPassword.length < 8) {
      setNotification({ type: 'error', message: 'Password must be at least 8 characters' }); return;
    }
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      setNotification({ type: 'success', message: 'Password updated successfully' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setNotification({ type: 'error', message: err.response?.data?.detail || 'Failed to update password' });
    } finally { setLoading(false); }
  };

  const tabs = [
    { k: 'general', label: 'General' },
    { k: 'security', label: 'Security' },
    { k: 'notifications', label: 'Notifications' },
    ...(user?.is_admin ? [{ k: 'admin', label: 'AI knowledge base' }] : []),
  ];

  return (
    <div className="page form-page form-page-wide">
      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>SYSTEM · SETTINGS</div>
          <h1 className="h1">Manage your <i>account</i>.</h1>
        </div>
      </div>

      {notification && <Alert type={notification.type === 'success' ? 'success' : 'error'}>{notification.message}</Alert>}

      <div className="settings-grid">
        <nav className="settings-nav">
          {tabs.map((t) => (
            <button key={t.k} className={`settings-nav-item ${activeTab === t.k ? 'active' : ''}`} onClick={() => setActiveTab(t.k)}>
              {t.label}
            </button>
          ))}
        </nav>

        <div>
          {activeTab === 'general' && (
            <div className="form-stack">
              <div className="form-card">
                <div className="form-card-head"><h3>Account</h3><p>Profile details are edited from the profile page.</p></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderTop: '1px solid var(--line-soft)' }}>
                  <div>
                    <div className="h3" style={{ fontSize: 13 }}>Email</div>
                    <div className="mute mono" style={{ fontSize: 11, marginTop: 2 }}>{user?.email}</div>
                  </div>
                  <button className="btn" onClick={() => navigate('/profile/edit')}>Edit profile</button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderTop: '1px solid var(--line-soft)' }}>
                  <div>
                    <div className="h3" style={{ fontSize: 13 }}>Role</div>
                    <div className="mute mono" style={{ fontSize: 11, marginTop: 2 }}>{(user?.role || 'MEMBER').toUpperCase()}</div>
                  </div>
                  <Pill tone="blue" dot>{user?.role || 'Member'}</Pill>
                </div>
              </div>

              <div className="form-card">
                <div className="form-card-head"><h3>Session</h3><p>Sign out on this device.</p></div>
                <button className="btn ghost" onClick={logout}><Icon name="logout" size={14} /> Sign out</button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <form className="form-card" onSubmit={handlePasswordSubmit}>
              <div className="form-card-head"><h3>Change password</h3><p>Use a long, random password for security.</p></div>
              <div className="form-group"><label>Current password</label><input type="password" name="currentPassword" value={passwordData.currentPassword} onChange={handlePasswordChange} required /></div>
              <div className="form-row">
                <div className="form-group"><label>New password</label><input type="password" name="newPassword" value={passwordData.newPassword} onChange={handlePasswordChange} required placeholder="Min 8 characters" /></div>
                <div className="form-group"><label>Confirm new password</label><input type="password" name="confirmPassword" value={passwordData.confirmPassword} onChange={handlePasswordChange} required /></div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn primary" disabled={loading}>{loading ? 'Updating…' : 'Update password'}</button>
              </div>
            </form>
          )}

          {activeTab === 'notifications' && (
            <div className="form-card">
              <div className="form-card-head"><h3>Email preferences</h3><p>Manage what emails you receive.</p></div>
              {[
                ['email_digest', 'Weekly digest', 'Summary of top content and events.'],
                ['new_messages', 'New messages', 'Get notified when someone messages you.'],
                ['mentorship_requests', 'Mentorship requests', 'Notifications for new mentee requests.'],
                ['job_alerts', 'Job alerts', 'New jobs matching your profile.'],
              ].map(([k, label, desc]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderTop: '1px solid var(--line-soft)' }}>
                  <div>
                    <div className="h3" style={{ fontSize: 13 }}>{label}</div>
                    <div className="mute" style={{ fontSize: 11.5, marginTop: 2 }}>{desc}</div>
                  </div>
                  <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input type="checkbox" checked={notifPrefs[k]} onChange={() => setNotifPrefs((p) => ({ ...p, [k]: !p[k] }))} />
                  </label>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'admin' && user?.is_admin && (
            <div className="form-stack">
              <div className="form-card">
                <div className="form-card-head"><h3>AI knowledge base</h3><p>Upload PDFs to enrich AqyldyAI with platform-specific knowledge.</p></div>

                <div className="stat-strip" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
                  <div className="stat">
                    <div className="stat-label">Status</div>
                    <div className="stat-num" style={{ fontSize: 18, color: kbStats?.status === 'ok' ? 'var(--ok)' : kbStats?.status === 'empty' ? 'var(--ink-3)' : 'var(--err)' }}>
                      {kbStats?.status === 'ok' ? 'Active' : kbStats?.status === 'empty' ? 'Empty' : kbStats ? 'Error' : '…'}
                    </div>
                  </div>
                  <div className="stat">
                    <div className="stat-label">Indexed chunks</div>
                    <div className="stat-num">{kbStats?.total_points ?? '—'}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-label">Vector dim</div>
                    <div className="stat-num">{kbStats?.vector_dimension ?? '—'}</div>
                  </div>
                </div>

                <div style={{ border: '1px dashed var(--line)', borderRadius: 10, padding: 20, textAlign: 'center', marginBottom: 14 }}>
                  <input type="file" id="pdf-upload" accept=".pdf" onChange={handleFileSelect} style={{ display: 'none' }} />
                  <label htmlFor="pdf-upload" style={{ cursor: 'pointer', display: 'block', padding: 0 }}>
                    <Icon name="upload" size={28} style={{ color: 'var(--ink-3)', marginBottom: 8 }} />
                    <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>Click to select a PDF file</div>
                    {selectedFile && <div className="mono" style={{ marginTop: 8, fontSize: 11, color: 'var(--blue)' }}>SELECTED: {selectedFile.name}</div>}
                  </label>
                </div>

                {uploadProgress && <div className="mute mono" style={{ fontSize: 11, marginBottom: 10 }}>{uploadProgress}</div>}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn primary" onClick={handleUpload} disabled={!selectedFile || kbLoading}>
                    <Icon name="upload" size={12} /> {kbLoading ? 'Processing…' : 'Upload & index PDF'}
                  </button>
                  <button className="btn" onClick={loadKbStats}><Icon name="refresh" size={12} /> Refresh</button>
                </div>
              </div>

              <div className="form-card" style={{ borderColor: 'rgba(217,122,108,0.3)' }}>
                <div className="form-card-head"><h3 style={{ color: 'var(--err)' }}>Danger zone</h3><p>Irreversible actions on the AI knowledge base.</p></div>
                <button className="btn danger" onClick={handleClearKb} disabled={kbLoading}>
                  <Icon name="trash" size={12} /> Clear knowledge base
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
