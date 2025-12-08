import React from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/ui/Card';

const ForgotPassword = () => {
  return (
    <div className="auth-container">
      <Card className="auth-card">
        <h2>Forgot Password</h2>
        <p>This feature is coming soon.</p>
        <div className="auth-footer">
          <Link to="/login">Back to Login</Link>
        </div>
      </Card>
    </div>
  );
};

export default ForgotPassword;
