<<<<<<< HEAD
import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorScreen from './components/ui/ErrorScreen';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import EditProfile from './pages/EditProfile';
import ResumeImport from './pages/ResumeImport';
import Directory from './pages/Directory';
import Feed from './pages/Feed';
import Jobs from './pages/Jobs';
import JobCreate from './pages/JobCreate';
import JobDetail from './pages/JobDetail';
import Projects from './pages/Projects';
import ProjectCreate from './pages/ProjectCreate';
import ProjectDetail from './pages/ProjectDetail';
import ProjectEdit from './pages/ProjectEdit';
import Hiring from './pages/Hiring';
import MyApplications from './pages/MyApplications';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import EventCreate from './pages/EventCreate';
import EventsAdmin from './pages/EventsAdmin';
import Messages from './pages/Messages';
import VideoCall from './pages/VideoCall';
import Recommendations from './pages/Recommendations';
import Opportunities from './pages/Opportunities';
import Settings from './pages/Settings';
import AiChat from './pages/AiChat';
import Mentorship from './pages/Mentorship';
import BecomeMentor from './pages/BecomeMentor';
import Friends from './pages/Friends';
import AppShell from './components/AppShell';
import './App.css';

function App() {
  const [networkError, setNetworkError] = useState(false);

  useEffect(() => {
    const handle = () => setNetworkError(true);
    window.addEventListener('app:network-error', handle);
    return () => window.removeEventListener('app:network-error', handle);
  }, []);

  if (networkError) {
    return (
      <ErrorScreen
        onRetry={() => {
          setNetworkError(false);
          window.location.reload();
        }}
      />
    );
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <Router>
          <ScrollToTop />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            <Route
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/feed" element={<Feed />} />
              <Route path="/directory" element={<Directory />} />
              <Route path="/mentorship" element={<Mentorship />} />
              <Route path="/become-mentor" element={<BecomeMentor />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/jobs/hiring" element={<Hiring />} />
              <Route path="/jobs/applications" element={<MyApplications />} />
              <Route path="/jobs/create" element={<JobCreate />} />
              <Route path="/jobs/:jobId" element={<JobDetail />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/create" element={<ProjectCreate />} />
              <Route path="/projects/edit/:projectId" element={<ProjectEdit />} />
              <Route path="/projects/:projectId" element={<ProjectDetail />} />
              <Route path="/events/admin" element={<EventsAdmin />} />
              <Route path="/events" element={<Events />} />
              <Route path="/events/create" element={<EventCreate />} />
              <Route path="/events/:eventId" element={<EventDetail />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/video-call/:roomName" element={<VideoCall />} />
              <Route path="/friends" element={<Friends />} />
              <Route path="/recommendations" element={<Recommendations />} />
              <Route path="/opportunities" element={<Opportunities />} />
              <Route path="/ai" element={<AiChat />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/edit" element={<EditProfile />} />
              <Route path="/profile/resume-import" element={<ResumeImport />} />
              <Route path="/profile/:userId" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            <Route path="/" element={<Landing />} />
          </Routes>
          </Router>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
=======
import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorScreen from './components/ui/ErrorScreen';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import EditProfile from './pages/EditProfile';
import ResumeImport from './pages/ResumeImport';
import Directory from './pages/Directory';
import Feed from './pages/Feed';
import Jobs from './pages/Jobs';
import JobCreate from './pages/JobCreate';
import JobDetail from './pages/JobDetail';
import Hiring from './pages/Hiring';
import MyApplications from './pages/MyApplications';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import EventCreate from './pages/EventCreate';
import EventsAdmin from './pages/EventsAdmin';
import Messages from './pages/Messages';
import VideoCall from './pages/VideoCall';
import Recommendations from './pages/Recommendations';
import Opportunities from './pages/Opportunities';
import Settings from './pages/Settings';
import AiChat from './pages/AiChat';
import Mentorship from './pages/Mentorship';
import BecomeMentor from './pages/BecomeMentor';
import Friends from './pages/Friends';
import AppShell from './components/AppShell';
import './App.css';

function App() {
  const [networkError, setNetworkError] = useState(false);

  useEffect(() => {
    const handle = () => setNetworkError(true);
    window.addEventListener('app:network-error', handle);
    return () => window.removeEventListener('app:network-error', handle);
  }, []);

  if (networkError) {
    return (
      <ErrorScreen
        onRetry={() => {
          setNetworkError(false);
          window.location.reload();
        }}
      />
    );
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <Router>
          <ScrollToTop />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            <Route
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/feed" element={<Feed />} />
              <Route path="/directory" element={<Directory />} />
              <Route path="/mentorship" element={<Mentorship />} />
              <Route path="/become-mentor" element={<BecomeMentor />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/jobs/hiring" element={<Hiring />} />
              <Route path="/jobs/applications" element={<MyApplications />} />
              <Route path="/jobs/create" element={<JobCreate />} />
              <Route path="/jobs/:jobId" element={<JobDetail />} />
              <Route path="/events/admin" element={<EventsAdmin />} />
              <Route path="/events" element={<Events />} />
              <Route path="/events/create" element={<EventCreate />} />
              <Route path="/events/:eventId" element={<EventDetail />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/video-call/:roomName" element={<VideoCall />} />
              <Route path="/friends" element={<Friends />} />
              <Route path="/recommendations" element={<Recommendations />} />
              <Route path="/opportunities" element={<Opportunities />} />
              <Route path="/ai" element={<AiChat />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/edit" element={<EditProfile />} />
              <Route path="/profile/resume-import" element={<ResumeImport />} />
              <Route path="/profile/:userId" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            <Route path="/" element={<Landing />} />
          </Routes>
          </Router>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
>>>>>>> origin/main
