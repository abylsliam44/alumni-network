import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AituGlyph } from '../components/ui/Icon';
import Icon from '../components/ui/Icon';
import ThemeToggle from '../components/ui/ThemeToggle';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const success = await login(email, password);
      if (success) navigate('/dashboard');
    } finally {
      setSubmitting(false);
    }
  };

  return (
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
            <div className="eyebrow" style={{ marginBottom: 18 }}>● LIVE · 2026</div>
            <h1 className="auth-branding-title">
              Build a <i>career</i><br />you can <i>trace</i>.
            </h1>
            <p className="auth-branding-subtitle">
              Connect with mentors and peers from Astana IT University, find roles
              hand-picked by alumni, and let our AI surface the people you should meet.
            </p>
            <div className="auth-branding-features">
              <div className="auth-feature">
                <Icon name="users" size={18} />
                <span>1,200+ alumni · 130+ accepting mentees</span>
              </div>
              <div className="auth-feature">
                <Icon name="briefcase" size={18} />
                <span>Jobs hand-picked from alumni-led teams</span>
              </div>
              <div className="auth-feature">
                <Icon name="spark" size={18} />
                <span>AqyldyAI · your career copilot</span>
              </div>
            </div>
          </div>

          <div className="auth-foot">SESS · {Math.random().toString(16).slice(2, 8).toUpperCase()} · {new Date().toISOString().slice(0, 10)}</div>
        </div>

        <div className="auth-form-section">
          <div className="auth-form-container">
            <div className="auth-form-header">
              <h2>Welcome back</h2>
              <p>Sign in to continue to your network.</p>
            </div>

            {error && (
              <div className="auth-error">
                <Icon name="alert" size={14} />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="auth-input-group">
                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@example.com"
                  autoComplete="email"
                />
              </div>

              <div className="auth-input-group">
                <div className="auth-label-row">
                  <label htmlFor="password">Password</label>
                  <Link to="/forgot-password" className="auth-forgot-link">Forgot?</Link>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
              </div>

              <button type="submit" className="auth-submit-btn" disabled={submitting}>
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <div className="auth-divider"><span>New here?</span></div>
            <Link to="/register" className="auth-secondary-btn">Create an account</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
