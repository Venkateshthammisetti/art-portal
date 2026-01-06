// src/App.js
import React, { useState } from 'react';
import axios from 'axios';
import './App.css'; 

// Import the components
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import TeacherDashboard from './components/TeacherDashboard';
import ParentDashboard from './components/ParentDashboard';

function App() {
  const [user, setUser] = useState(null); // Stores logged-in user info
  const [error, setError] = useState('');

  // Function to handle login logic
  const handleLoginLogic = async (username, password) => {
    try {
      const res = await axios.post('http://localhost:5000/api/login', { username, password });
      setUser(res.data); // Save user data
      setError('');
    } catch (err) {
      setError('Login Failed. Check credentials.');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setError('');
  };

  return (
    <div className="App">
      {!user ? (
        // SHOW LOGIN COMPONENT
        <Login onLogin={handleLoginLogic} error={error} />
      ) : (
        // SHOW DASHBOARDS
        // We removed the global <nav> here. 
        // We now pass 'onLogout' to the dashboards so they can put the button inside their own beautiful headers.
        <>
          {user.role === 'admin' && <AdminDashboard onLogout={handleLogout} />}
          {user.role === 'teacher' && <TeacherDashboard onLogout={handleLogout} />}
          {user.role === 'parent' && <ParentDashboard user={user} onLogout={handleLogout} />}
        </>
      )}
    </div>
  );
}

export default App;