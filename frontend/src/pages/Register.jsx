import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'STUDENT'
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

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleBlur = (e) => {
    setTouched({ ...touched, [e.target.name]: true });
  };

  const getFieldError = (field) => {
    if (!touched[field]) return null;

    switch (field) {
      case 'name':
        if (!formData.name.trim()) return 'Name is required';
        if (formData.name.trim().length < 2) return 'Name must be at least 2 characters';
        return null;
      case 'email':
        if (!formData.email) return 'Email is required';
        if (!isEmailValid) return 'Please enter a valid email address';
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

    setTouched({
      name: true,
      email: true,
      password: true,
      confirmPassword: true
    });

    if (!isNameValid || !isEmailValid || !isPasswordValid || !passwordsMatch) {
      return;
    }

    setIsSubmitting(true);

    const success = await register({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      role: formData.role
    });

    setIsSubmitting(false);

    if (success) {
      navigate('/dashboard');
    }
  };

  const getServerErrorMessage = (error) => {
    if (!error) return null;

    if (error.includes('already registered') || error.includes('already exists')) {
      return 'A user with this email already exists';
    }
    if (error.includes('Invalid email')) {
      return 'Invalid email format';
    }
    if (error.includes('Network') || error.includes('fetch')) {
      return 'Network error. Please check your connection';
    }
    return error;
  };

  return (
    <div className="auth-page">
      <div className="auth-wrapper">
        {/* Left side - Branding */}
        <div className="auth-branding">
          <div className="auth-branding-content">
            <div className="auth-logo">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            </div>
            <h1 className="auth-branding-title">Alumni Network</h1>
            <p className="auth-branding-subtitle">
              Join thousands of students and alumni from Astana IT University.
              Start building your professional network today.
            </p>
            <div className="auth-branding-features">
              <div className="auth-feature">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span>Connect with Alumni</span>
              </div>
              <div className="auth-feature">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
                <span>Find Job Opportunities</span>
              </div>
              <div className="auth-feature">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
                <span>Get Mentorship</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Form */}
        <div className="auth-form-section">
          <div className="auth-form-container">
            <div className="auth-form-header">
              <h2>Create your account</h2>
              <p>Join the AITU alumni community</p>
            </div>

            {error && (
              <div className="auth-error">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {getServerErrorMessage(error)}
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className={`auth-input-group ${getFieldError('name') ? 'has-error' : ''}`}>
                <label htmlFor="name">Full name</label>
                <input
                  id="name"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="John Doe"
                />
                {getFieldError('name') && (
                  <span className="field-error">{getFieldError('name')}</span>
                )}
              </div>

              <div className={`auth-input-group ${getFieldError('email') ? 'has-error' : ''}`}>
                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="name@example.com"
                />
                {getFieldError('email') && (
                  <span className="field-error">{getFieldError('email')}</span>
                )}
              </div>

              <div className="auth-input-group">
                <label htmlFor="role">I am a...</label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                >
                  <option value="STUDENT">Student — Current AITU student</option>
                  <option value="ALUMNI">Alumni — AITU graduate</option>
                  <option value="STAFF">Staff — University administration</option>
                </select>
              </div>

              <div className="auth-input-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Enter password"
                />

                {formData.password && (
                  <div className="password-requirements">
                    <p className="requirements-title">Password requirements:</p>
                    <ul className="requirements-list">
                      <li className={passwordChecks.length ? 'valid' : 'invalid'}>
                        <span className="check-icon">{passwordChecks.length ? '✓' : '✗'}</span>
                        At least 8 characters
                      </li>
                      <li className={passwordChecks.uppercase ? 'valid' : 'invalid'}>
                        <span className="check-icon">{passwordChecks.uppercase ? '✓' : '✗'}</span>
                        One uppercase letter (A-Z)
                      </li>
                      <li className={passwordChecks.lowercase ? 'valid' : 'invalid'}>
                        <span className="check-icon">{passwordChecks.lowercase ? '✓' : '✗'}</span>
                        One lowercase letter (a-z)
                      </li>
                      <li className={passwordChecks.number ? 'valid' : 'invalid'}>
                        <span className="check-icon">{passwordChecks.number ? '✓' : '✗'}</span>
                        One number (0-9)
                      </li>
                      <li className={passwordChecks.special ? 'valid' : 'invalid'}>
                        <span className="check-icon">{passwordChecks.special ? '✓' : '✗'}</span>
                        One special character (!@#$%^&*)
                      </li>
                    </ul>
                  </div>
                )}
              </div>

              <div className={`auth-input-group ${getFieldError('confirmPassword') ? 'has-error' : ''}`}>
                <label htmlFor="confirmPassword">Confirm password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Confirm password"
                />
                {getFieldError('confirmPassword') && (
                  <span className="field-error">{getFieldError('confirmPassword')}</span>
                )}
                {touched.confirmPassword && passwordsMatch && formData.confirmPassword && (
                  <span className="field-success">Passwords match</span>
                )}
              </div>

              <button type="submit" className="auth-submit-btn" disabled={isSubmitting}>
                {isSubmitting ? 'Creating account...' : 'Create account'}
              </button>
            </form>

            <div className="auth-divider">
              <span>Already have an account?</span>
            </div>

            <Link to="/login" className="auth-secondary-btn">
              Sign in instead
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
