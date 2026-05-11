import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="boot-loader" role="status" aria-label="Loading">
        <div className="boot-loader-inner">
          <div className="boot-loader-orbit">
            <div className="boot-loader-core" />
          </div>
          <div>
            <span className="pulse-dot" /> &nbsp;ESTABLISHING SESSION
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
