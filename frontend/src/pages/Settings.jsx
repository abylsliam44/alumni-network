import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Alert from '../components/ui/Alert';
import { aiApi } from '../api/ai';

const Settings = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Knowledge Base State
  const [kbStats, setKbStats] = useState(null);
  const [kbLoading, setKbLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  // Password Change State
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Load KB stats when admin tab is selected
  useEffect(() => {
    if (activeTab === 'admin' && user?.is_admin) {
      loadKbStats();
    }
  }, [activeTab, user?.is_admin]);

  const loadKbStats = async () => {
    try {
      const stats = await aiApi.getKnowledgeBaseStats();
      setKbStats(stats);
    } catch (err) {
      console.error('Failed to load KB stats:', err);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setNotification(null);
    } else {
      setNotification({ type: 'error', message: 'Please select a PDF file' });
      setSelectedFile(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setNotification({ type: 'error', message: 'Please select a file first' });
      return;
    }

    setKbLoading(true);
    setUploadProgress('Uploading and processing PDF...');
    setNotification(null);

    try {
      const result = await aiApi.uploadKnowledgeBase(selectedFile);
      setNotification({
        type: 'success',
        message: `Successfully indexed ${result.chunks_indexed} chunks from "${result.source}"`
      });
      setSelectedFile(null);
      // Reset file input
      const fileInput = document.getElementById('pdf-upload');
      if (fileInput) fileInput.value = '';
      // Reload stats
      await loadKbStats();
    } catch (err) {
      setNotification({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to upload PDF'
      });
    } finally {
      setKbLoading(false);
      setUploadProgress(null);
    }
  };

  const handleClearKb = async () => {
    if (!window.confirm('Are you sure you want to clear the entire knowledge base? This cannot be undone.')) {
      return;
    }

    setKbLoading(true);
    try {
      await aiApi.clearKnowledgeBase();
      setNotification({ type: 'success', message: 'Knowledge base cleared successfully' });
      await loadKbStats();
    } catch (err) {
      setNotification({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to clear knowledge base'
      });
    } finally {
      setKbLoading(false);
    }
  };

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value
    });
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setNotification(null);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setNotification({ type: 'error', message: "New passwords don't match" });
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setNotification({ type: 'error', message: "Password must be at least 8 characters" });
      return;
    }

    setLoading(true);
    try {
      // Mock API call - in real app, replace with:
      // await api.post('/api/v1/auth/change-password', {
      //   current_password: passwordData.currentPassword,
      //   new_password: passwordData.newPassword
      // });

      // Simulating network delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      setNotification({ type: 'success', message: 'Password updated successfully' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setNotification({ type: 'error', message: err.response?.data?.detail || 'Failed to update password' });
    } finally {
      setLoading(false);
    }
  };

  // Notification Preference State (Mock)
  const [notifPrefs, setNotifPrefs] = useState({
    email_digest: true,
    new_messages: true,
    mentorship_requests: true,
    job_alerts: false
  });

  const toggleNotif = (key) => {
    setNotifPrefs(prev => ({ ...prev, [key]: !prev[key] }));
    // Ideally save to backend here
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Settings</h1>
        <p>Manage your account settings and preferences.</p>
      </div>

      <div className="settings-layout">
        {/* Sidebar Navigation */}
        <div className="settings-sidebar">
          <nav>
            <button
              className={`settings-nav-item ${activeTab === 'general' ? 'active' : ''}`}
              onClick={() => setActiveTab('general')}
            >
              General
            </button>
            <button
              className={`settings-nav-item ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              Security
            </button>
            <button
              className={`settings-nav-item ${activeTab === 'notifications' ? 'active' : ''}`}
              onClick={() => setActiveTab('notifications')}
            >
              Notifications
            </button>
            {user?.is_admin && (
              <button
                className={`settings-nav-item ${activeTab === 'admin' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin')}
              >
                AI Knowledge Base
              </button>
            )}
          </nav>
        </div>

        {/* Content Area */}
        <div className="settings-content">

          {notification && (
            <Alert type={notification.type}>{notification.message}</Alert>
          )}

          {/* General Settings */}
          <div className={`settings-section ${activeTab === 'general' ? 'active' : ''}`}>
            <div className="settings-card">
              <h2>Appearance</h2>
              <p className="section-desc">Customize how the Alumni Network looks for you.</p>

              <div className="settings-row">
                <div className="settings-info">
                  <span className="settings-label">Dark Mode</span>
                  <span className="settings-description">
                    Switch between light and dark themes.
                  </span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={theme === 'dark'}
                    onChange={toggleTheme}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div className="settings-card">
              <h2>Account Information</h2>
              <p className="section-desc">Profile details can be changed in your profile page.</p>

              <div className="settings-row">
                <div className="settings-info">
                  <span className="settings-label">Email Address</span>
                  <span className="settings-description">{user?.email}</span>
                </div>
              </div>

              <div style={{ marginTop: '16px' }}>
                <Button variant="secondary" onClick={() => navigate('/profile/edit')}>
                  Edit Profile Information
                </Button>
              </div>
            </div>

            <div className="settings-card">
              <h2>Session</h2>
              <div className="settings-row">
                <div className="settings-info">
                  <span className="settings-label">Sign Out</span>
                  <span className="settings-description">Log out of your account on this device.</span>
                </div>
                <Button variant="secondary" onClick={logout}>Sign Out</Button>
              </div>
            </div>
          </div>

          {/* Security Settings */}
          <div className={`settings-section ${activeTab === 'security' ? 'active' : ''}`}>
            <div className="settings-card">
              <h2>Change Password</h2>
              <p className="section-desc">Ensure your account is using a long, random password to stay secure.</p>

              <form onSubmit={handlePasswordSubmit}>
                <Input
                  label="Current Password"
                  type="password"
                  name="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  required
                />
                <div className="form-row-2">
                  <Input
                    label="New Password"
                    type="password"
                    name="newPassword"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    required
                    placeholder="Min 8 characters"
                  />
                  <Input
                    label="Confirm New Password"
                    type="password"
                    name="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    required
                  />
                </div>
                <div className="form-footer">
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Updating...' : 'Update Password'}
                  </Button>
                </div>
              </form>
            </div>
          </div>

          {/* Notification Settings */}
          <div className={`settings-section ${activeTab === 'notifications' ? 'active' : ''}`}>
            <div className="settings-card">
              <h2>Email Preferences</h2>
              <p className="section-desc">Manage what emails you receive.</p>

              <div className="settings-row">
                <div className="settings-info">
                  <span className="settings-label">Weekly Digest</span>
                  <span className="settings-description">Summary of top contents and events.</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={notifPrefs.email_digest}
                    onChange={() => toggleNotif('email_digest')}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="settings-row">
                <div className="settings-info">
                  <span className="settings-label">New Message Alerts</span>
                  <span className="settings-description">Get notified when someone messages you.</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={notifPrefs.new_messages}
                    onChange={() => toggleNotif('new_messages')}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="settings-row">
                <div className="settings-info">
                  <span className="settings-label">Mentorship Requests</span>
                  <span className="settings-description">Notifications for new mentee requests.</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={notifPrefs.mentorship_requests}
                    onChange={() => toggleNotif('mentorship_requests')}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="settings-row">
                <div className="settings-info">
                  <span className="settings-label">Job Alerts</span>
                  <span className="settings-description">New jobs matching your profile.</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={notifPrefs.job_alerts}
                    onChange={() => toggleNotif('job_alerts')}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>

          {/* Admin Settings - AI Knowledge Base */}
          {user?.is_admin && (
            <div className={`settings-section ${activeTab === 'admin' ? 'active' : ''}`}>
              <div className="settings-card">
                <h2>AI Knowledge Base</h2>
                <p className="section-desc">
                  Upload PDF documents to train the AI assistant with AITU-specific knowledge.
                  The AI will use this information to answer student questions.
                </p>

                {/* Stats */}
                <div className="kb-stats" style={{
                  background: 'var(--bg-secondary)',
                  padding: '16px',
                  borderRadius: '8px',
                  marginBottom: '20px'
                }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>
                    Knowledge Base Status
                  </h3>
                  {kbStats ? (
                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                      <div>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Status</span>
                        <p style={{ margin: '4px 0 0 0', fontWeight: '500' }}>
                          {kbStats.status === 'ok' ? 'Active' : kbStats.status === 'empty' ? 'Empty' : 'Error'}
                        </p>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Documents Indexed</span>
                        <p style={{ margin: '4px 0 0 0', fontWeight: '500' }}>{kbStats.total_points || 0} chunks</p>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Vector Dimension</span>
                        <p style={{ margin: '4px 0 0 0', fontWeight: '500' }}>{kbStats.vector_dimension || 384}</p>
                      </div>
                    </div>
                  ) : (
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Loading...</p>
                  )}
                </div>

                {/* Upload Section */}
                <div className="kb-upload" style={{ marginBottom: '20px' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>
                    Upload PDF Document
                  </h3>
                  <div style={{
                    border: '2px dashed var(--border-color)',
                    borderRadius: '8px',
                    padding: '24px',
                    textAlign: 'center'
                  }}>
                    <input
                      type="file"
                      id="pdf-upload"
                      accept=".pdf"
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                    />
                    <label
                      htmlFor="pdf-upload"
                      style={{
                        cursor: 'pointer',
                        display: 'block'
                      }}
                    >
                      <div style={{ fontSize: '32px', marginBottom: '8px' }}>PDF</div>
                      <p style={{ margin: '0 0 8px 0', color: 'var(--text-secondary)' }}>
                        Click to select a PDF file
                      </p>
                      {selectedFile && (
                        <p style={{
                          margin: '8px 0 0 0',
                          color: 'var(--primary)',
                          fontWeight: '500'
                        }}>
                          Selected: {selectedFile.name}
                        </p>
                      )}
                    </label>
                  </div>

                  {uploadProgress && (
                    <p style={{
                      margin: '12px 0 0 0',
                      color: 'var(--primary)',
                      fontSize: '14px'
                    }}>
                      {uploadProgress}
                    </p>
                  )}

                  <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
                    <Button
                      onClick={handleUpload}
                      disabled={!selectedFile || kbLoading}
                    >
                      {kbLoading ? 'Processing...' : 'Upload & Index PDF'}
                    </Button>
                  </div>
                </div>

                {/* Clear Section */}
                <div className="kb-clear" style={{
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '20px'
                }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: 'var(--error)' }}>
                    Danger Zone
                  </h3>
                  <p style={{ margin: '0 0 12px 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
                    Clear all data from the knowledge base. This action cannot be undone.
                  </p>
                  <Button
                    variant="secondary"
                    onClick={handleClearKb}
                    disabled={kbLoading}
                    style={{ borderColor: 'var(--error)', color: 'var(--error)' }}
                  >
                    Clear Knowledge Base
                  </Button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Settings;
