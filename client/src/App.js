// src/App.js
import React, { useState, useEffect, lazy, Suspense } from 'react';
import axios from 'axios';
import './App.css'; 

// Import Components
import Login from './components/Login';
// Stylesheets stay global, in the same order as before: the dashboards share
// classes with each other (e.g. the Parent gallery uses grid/card styles from the
// Teacher and Admin sheets), so only their JavaScript is loaded on demand.
import './components/AdminDashboard.css';
import './components/BirthdayNotifications.css';
import './components/Icons.css';
import './components/ArtistSpotlight.css';
import './components/ListCountHeader.css';
import './components/ArtworkViewer.css';
import './components/TeacherDashboard.css';
import './components/ParentDashboard.css';
import SplashScreen from './components/SplashScreen';
import ChatbotWidget from './components/ChatbotWidget';
import { useMobileTableLabels } from './utils/mobileTableLabels';

// Each role downloads only its own dashboard (the bundle used to ship all three).
const loadAdmin = () => import('./components/AdminDashboard');
const loadTeacher = () => import('./components/TeacherDashboard');
const loadParent = () => import('./components/ParentDashboard');
const AdminDashboard = lazy(loadAdmin);
const TeacherDashboard = lazy(loadTeacher);
const ParentDashboard = lazy(loadParent);
const PRELOAD = { admin: loadAdmin, teacher: loadTeacher, parent: loadParent };

const DashboardLoading = () => (
  <div className="app-loading" role="status" aria-live="polite">
    <span className="app-loading-spinner" aria-hidden="true" />
    <span className="app-loading-text">Loading…</span>
  </div>
);

function App() {
  const [showSplash, setShowSplash] = useState(true);
  useMobileTableLabels();
  
  // 1. Initialize State
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [error, setError] = useState('');

  // Start downloading this user's dashboard straight away (during the splash
  // screen, or right after login), so it's ready by the time it's shown.
  useEffect(() => {
    if (user?.role) PRELOAD[user.role]?.();
  }, [user?.role]);

  // 2. Persist to LocalStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  // 3. Login Logic
  const handleLoginLogic = async (username, password) => {
    try {
      const res = await axios.post('https://art-portal-7n6r.onrender.com/api/login', { username, password });
      console.log("Login Response:", res.data); // Debugging
      setUser(res.data);
      setError('');
    } catch (err) {
      console.error(err);
      setError('Login Failed. Check credentials.');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    window.location.href = "/"; // Force refresh
  };

  // 🛑 SAFETY CHECK: If user exists but is invalid (missing ID), Auto-Logout
  if (user && (!user._id || !user.role)) {
    console.warn("Detected corrupted user data. Logging out...");
    handleLogout();
    return null;
  }

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <div className="App">
      {!user ? (
        <Login onLogin={handleLoginLogic} error={error} />
      ) : (
        <>
          {/* PASS USER PROP TO ALL DASHBOARDS */}
          <Suspense fallback={<DashboardLoading />}>
            {user.role === 'admin' && <AdminDashboard user={user} onLogout={handleLogout} />}

            {user.role === 'teacher' && <TeacherDashboard user={user} onLogout={handleLogout} />}

            {user.role === 'parent' && <ParentDashboard user={user} onLogout={handleLogout} />}
          </Suspense>

          <ChatbotWidget user={user} />
        </>
      )}
    </div>
  );
}

export default App;