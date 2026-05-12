import { Link } from 'react-router-dom';
import Icon, { AituGlyph } from '../components/ui/Icon';
import ThemeToggle from '../components/ui/ThemeToggle';

const ForgotPassword = () => (
  <div className="auth-page">
    <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 5 }}>
      <ThemeToggle />
    </div>
    <div className="auth-wrapper">
      <div className="auth-branding">
        <Link to="/" className="auth-brand-mark">
          <span className="mark"><AituGlyph size={26} color="var(--bg)" accent="var(--blue-2)" /></span>
          <span className="name">Alumni Networking Platform<span>Astana IT University</span></span>
        </Link>
        <div className="auth-branding-content">
          <div className="eyebrow" style={{ marginBottom: 18 }}>● ACCOUNT RECOVERY</div>
          <h1 className="auth-branding-title">Lost the <i>thread</i>?<br />Let's get you back in.</h1>
          <p className="auth-branding-subtitle">
            Password reset is currently handled by the platform admin team.
            Reach out via the contact form on the registration page or email
            your university administrator.
          </p>
        </div>
        <div className="auth-foot">© 2026 · Alumni Networking Platform</div>
      </div>

      <div className="auth-form-section">
        <div className="auth-form-container">
          <div className="auth-form-header">
            <h2>Forgot password</h2>
            <p>This feature is coming soon.</p>
          </div>
          <p style={{ color: 'var(--ink-2)', fontSize: 13.5, lineHeight: 1.6, margin: '0 0 24px' }}>
            <Icon name="info" size={14} style={{ verticalAlign: 'middle', marginRight: 6, color: 'var(--blue)' }} />
            Self-serve password reset will be available soon. In the meantime,
            please contact your university administrator to reset your account.
          </p>
          <Link to="/login" className="auth-secondary-btn">Back to sign in</Link>
        </div>
      </div>
    </div>
  </div>
);

export default ForgotPassword;
