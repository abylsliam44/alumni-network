import { createContext, useState, useEffect } from 'react';
import { authApi } from '../api/auth';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      setError(err.response?.data?.detail || 'Login failed');
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
      setError(err.response?.data?.detail || 'Registration failed');
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
    <AuthContext.Provider value={{ user, loading, error, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};
