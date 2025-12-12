import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import EditProfile from './pages/EditProfile';
import Directory from './pages/Directory';
import Feed from './pages/Feed';
import Jobs from './pages/Jobs';
import Events from './pages/Events';
import Messages from './pages/Messages';
import Recommendations from './pages/Recommendations';
import Settings from './pages/Settings';
import AiChat from './pages/AiChat';
import BecomeMentor from './pages/BecomeMentor';
import Friends from './pages/Friends';
import AppShell from './components/AppShell';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <ScrollToTop />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Dashboard />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/feed"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Feed />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/directory"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Directory />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/become-mentor"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <BecomeMentor />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/jobs"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Jobs />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/events"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Events />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Messages />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/friends"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Friends />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/recommendations"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Recommendations />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ai"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <AiChat />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Profile />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile/edit"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <EditProfile />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile/:userId"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Profile />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Settings />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route path="/" element={<Landing />} />
          </Routes>
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
