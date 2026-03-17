import { createContext, useState, useEffect, useContext } from 'react';
import { authApi } from '../api/auth';

export const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const userData = await authApi.getCurrentUser();
          setUser(userData);
        } catch (err) {
          console.error('Auth check failed:', err);
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const data = await authApi.login(email, password);
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('refreshToken', data.refresh_token);

      const userData = await authApi.getCurrentUser();
      setUser(userData);
      return true;
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        const messages = detail.map(e => e.msg || e.message || 'Validation error').join('. ');
        setError(messages);
      } else if (typeof detail === 'string') {
        setError(detail);
      } else {
        setError('Login failed');
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    setLoading(true);
    setError(null);
    try {
      const data = await authApi.register(userData);

      if (data?.access_token) {
        localStorage.setItem('token', data.access_token);
        if (data.refresh_token) {
          localStorage.setItem('refreshToken', data.refresh_token);
        }
        const current = await authApi.getCurrentUser();
        setUser(current);
      }
      return true;
    } catch (err) {
      console.error('Registration error:', err);
      if (err.response) {
        const detail = err.response?.data?.detail;
        // Handle Pydantic validation errors (array format)
        if (Array.isArray(detail)) {
          const messages = detail.map(e => e.msg || e.message || 'Validation error').join('. ');
          setError(messages);
        } else if (typeof detail === 'string') {
          setError(detail);
        } else {
          setError('Registration failed');
        }
      } else {
        setError('Network Error: Unable to reach backend');
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  const refreshUser = async () => {
    const current = await authApi.getCurrentUser();
    setUser(current);
    return current;
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, error, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};
