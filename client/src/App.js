// src/App.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css'; 

// Import Components
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import TeacherDashboard from './components/TeacherDashboard';
import ParentDashboard from './components/ParentDashboard';

function App() {
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
      const res = await axios.post('http://localhost:5000/api/login', { username, password });
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

  return (
    <div className="App">
      {!user ? (
        <Login onLogin={handleLoginLogic} error={error} />
      ) : (
        <>
          {/* PASS USER PROP TO ALL DASHBOARDS */}
          {user.role === 'admin' && <AdminDashboard user={user} onLogout={handleLogout} />}
          
          {user.role === 'teacher' && <TeacherDashboard user={user} onLogout={handleLogout} />}
          
          {user.role === 'parent' && <ParentDashboard user={user} onLogout={handleLogout} />}
        </>
      )}
    </div>
  );
}

export default App;