// src/components/Login.js
import React, { useState } from 'react';
import './Login.css';

const Login = ({ onLogin, error }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(username, password);
  };

  // SVG Icons
  // Replace EmailIcon with this:
const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="input-icon">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

  const LockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="input-icon">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>
  );

  return (
    <div className="login-container">
      {/* Left Side - Illustration & Logo */}
      {/* Left Side */}
<div className="login-illustration">
  
  {/* The 3D Flip Container */}
  <div className="logo-flip-box">
    <div className="logo-flip-inner">
      
      {/* FRONT: Your Normal Logo */}
      <div className="logo-front">
        <img src="/new-logo.png" alt="Academy Logo" />
      </div>

      {/* BACK: The Paintbrush (Reveals on Hover) */}
      <div className="logo-back">
        {/* Make sure paintbrush.png is in src/components or use public path */}
        <img src={require('./paintbrush.png')} alt="Art Brush" />
      </div>

    </div>
  </div>

</div>

      {/* Right Side - Login Form */}
      <div className="login-form-section">
        {/* ✨ NEW: Animated Floating Shapes */}
      <div className="floating-shape shape-1"></div>
      <div className="floating-shape shape-2"></div>
        {/* Blurred Background Layer */}
        <div className="login-bg-blur"></div>
        
        <div className="login-card">
          {/* --- ✨ NEW WELCOME NOTE START --- */}
        <div className="welcome-header">
          <h2>Welcome, Parents! 👋</h2>
          <p>Log in to track your child's artistic journey.</p>
        </div>
        {/* --- ✨ NEW WELCOME NOTE END --- */}
          

          <form onSubmit={handleSubmit} className="login-form">
            <div className="input-with-icon">
              <UserIcon />
              <input 
                type="text" 
                placeholder="User name"
                required 
                onChange={(e) => setUsername(e.target.value)} 
              />
            </div>

            <div className="input-with-icon">
              <LockIcon />
              <input 
                type="password" 
                placeholder="Password"
                required 
                onChange={(e) => setPassword(e.target.value)} 
              />
            </div>

            <div className="forgot-link">
              <a href="#">Forgot password?</a>
            </div>

            <button type="submit" className="login-btn">
              Log in
            </button>
          </form>

          {error && <p className="error-msg">{error}</p>}

          <div className="create-account-link">
            <p> <a href="#"></a></p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;