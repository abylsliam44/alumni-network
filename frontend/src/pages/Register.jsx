import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'STUDENT'
  });
  const [validationError, setValidationError] = useState(null);
  const { register, error } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError(null);

    if (formData.password !== formData.confirmPassword) {
      setValidationError("Passwords don't match");
      return;
    }

    const success = await register({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      role: formData.role
    });

    if (success) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="auth-container">
      <Card className="auth-card">
        <h2>Create Account</h2>
        <p className="auth-subtitle">Join the alumni network</p>

        {(error || validationError) && (
          <div className="error-message">{error || validationError}</div>
        )}

        <form onSubmit={handleSubmit}>
          <Input
            label="Full Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="John Doe"
          />
          <Input
            label="Email"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            placeholder="john@example.com"
          />
          <div className="form-group">
            <label className="form-label">Role</label>
            <select
              className="form-input"
              name="role"
              value={formData.role}
              onChange={handleChange}
            >
              <option value="STUDENT">Student — Current AITU student</option>
              <option value="ALUMNI">Alumni — AITU graduate / soon-to-be</option>
            </select>
          </div>
          <Input
            label="Password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            placeholder="******"
          />
          <Input
            label="Confirm Password"
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            placeholder="******"
          />

          <Button type="submit" className="w-full">Register</Button>
        </form>

        <div className="auth-footer">
          Already have an account? <Link to="/login">Login</Link>
        </div>
      </Card>
    </div>
  );
};

export default Register;
