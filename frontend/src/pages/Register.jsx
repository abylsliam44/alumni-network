import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Icon, { AituGlyph } from '../components/ui/Icon';
import ThemeToggle from '../components/ui/ThemeToggle';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'STUDENT',
  });
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, error } = useAuth();
  const navigate = useNavigate();

  const passwordChecks = useMemo(() => {
    const password = formData.password;
    return {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };
  }, [formData.password]);

  const isPasswordValid = Object.values(passwordChecks).every(Boolean);
  const passwordsMatch = formData.password === formData.confirmPassword;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
  const isNameValid = formData.name.trim().length >= 2;

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleBlur = (e) => setTouched({ ...touched, [e.target.name]: true });

  const getFieldError = (field) => {
    if (!touched[field]) return null;
    switch (field) {
      case 'name':
        if (!formData.name.trim()) return 'Name is required';
        if (formData.name.trim().length < 2) return 'Name must be at least 2 characters';
        return null;
      case 'email':
        if (!formData.email) return 'Email is required';
        if (!isEmailValid) return 'Enter a valid email address';
        return null;
      case 'confirmPassword':
        if (!formData.confirmPassword) return 'Please confirm your password';
        if (!passwordsMatch) return 'Passwords do not match';
        return null;
      default:
        return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true, confirmPassword: true });
    if (!isNameValid || !isEmailValid || !isPasswordValid || !passwordsMatch) return;

    setIsSubmitting(true);
    const success = await register({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      role: formData.role,
    });
    setIsSubmitting(false);
    if (success) navigate('/dashboard');
  };

  const getServerErrorMessage = (err) => {
    if (!err) return null;
    if (err.includes('already registered') || err.includes('already exists')) return 'A user with this email already exists';
    if (err.includes('Invalid email')) return 'Invalid email format';
    if (err.includes('Network') || err.includes('fetch')) return 'Network error. Check your connection';
    return err;
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
            <div className="eyebrow" style={{ marginBottom: 18 }}>● ONBOARDING · STEP 01</div>
            <h1 className="auth-branding-title">
              Join the <i>network</i><br />that builds your <i>career</i>.
            </h1>
            <p className="auth-branding-subtitle">
              Get matched with mentors and peers, find roles hand-picked from alumni teams,
              and import your resume so AqyldyAI can suggest your next move.
            </p>
            <div className="auth-branding-features">
              <div className="auth-feature"><Icon name="users" size={18} /><span>Connect with alumni & mentors</span></div>
              <div className="auth-feature"><Icon name="briefcase" size={18} /><span>Discover internships and full-time roles</span></div>
              <div className="auth-feature"><Icon name="spark" size={18} /><span>AqyldyAI · personal career copilot</span></div>
            </div>
          </div>

          <div className="auth-foot">© 2026 · Alumni Networking Platform</div>
        </div>

        <div className="auth-form-section">
          <div className="auth-form-container">
            <div className="auth-form-header">
              <h2>Create your account</h2>
              <p>Takes about 60 seconds.</p>
            </div>

            {error && (
              <div className="auth-error">
                <Icon name="alert" size={14} />
                {getServerErrorMessage(error)}
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="auth-input-group">
                <label htmlFor="name">Full name</label>
                <input id="name" type="text" name="name" value={formData.name} onChange={handleChange} onBlur={handleBlur} placeholder="Aizhan Kuanysh" />
                {getFieldError('name') && <span className="help" style={{ color: 'var(--err)' }}>{getFieldError('name')}</span>}
              </div>

              <div className="auth-input-group">
                <label htmlFor="email">Email address</label>
                <input id="email" type="email" name="email" value={formData.email} onChange={handleChange} onBlur={handleBlur} placeholder="name@example.com" />
                {getFieldError('email') && <span className="help" style={{ color: 'var(--err)' }}>{getFieldError('email')}</span>}
              </div>

              <div className="auth-input-group">
                <label htmlFor="role">I am a…</label>
                <select id="role" name="role" value={formData.role} onChange={handleChange}>
                  <option value="STUDENT">Student — current university student</option>
                  <option value="ALUMNI">Alumni — university graduate</option>
                  <option value="HR">HR — hiring partner or recruiter</option>
                  <option value="STAFF">Staff — university administration</option>
                </select>
              </div>

              <div className="auth-input-group">
                <label htmlFor="password">Password</label>
                <input id="password" type="password" name="password" value={formData.password} onChange={handleChange} onBlur={handleBlur} placeholder="Choose a strong password" />
                {formData.password && (
                  <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {[
                      ['length', '8+ characters'],
                      ['uppercase', 'One uppercase letter'],
                      ['lowercase', 'One lowercase letter'],
                      ['number', 'One number'],
                      ['special', 'One special character'],
                    ].map(([k, label]) => (
                      <li key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--mono)', fontSize: 10.5, color: passwordChecks[k] ? 'var(--ok)' : 'var(--ink-3)' }}>
                        <span style={{ width: 12, textAlign: 'center' }}>{passwordChecks[k] ? '✓' : '·'}</span>
                        {label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="auth-input-group">
                <label htmlFor="confirmPassword">Confirm password</label>
                <input id="confirmPassword" type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} onBlur={handleBlur} placeholder="Re-enter your password" />
                {getFieldError('confirmPassword') && <span className="help" style={{ color: 'var(--err)' }}>{getFieldError('confirmPassword')}</span>}
                {touched.confirmPassword && passwordsMatch && formData.confirmPassword && (
                  <span className="help" style={{ color: 'var(--ok)' }}>Passwords match</span>
                )}
              </div>

              <button type="submit" className="auth-submit-btn" disabled={isSubmitting}>
                {isSubmitting ? 'Creating account…' : 'Create account'}
              </button>
            </form>

            <div className="auth-divider"><span>Already have one?</span></div>
            <Link to="/login" className="auth-secondary-btn">Sign in instead</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
