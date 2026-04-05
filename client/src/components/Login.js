// src/components/Login.js
import { useState } from 'react';
import './Login.css';

// ✨ Import your assets for the Mobile View
import logoImg from './new-logo.png'; 
import titleImg from './logo-title-copy.png';
import brushImg from './paintbrush.png'; // Ensure this exists or remove if not needed
import bgImg from './va-black.jpg'; 

const Login = ({ onLogin, error }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onLogin(username, password);
    } finally {
      setLoading(false);
    }
  };

  // Icons
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
      {/* --- Left Side (Desktop Only) --- */}
      <div className="login-illustration">
        <div className="logo-flip-box">
          <div className="logo-flip-inner">
            <div className="logo-front">
              <img src={logoImg} alt="Academy Logo" />
            </div>
            <div className="logo-back">
              <img src={brushImg} alt="Art Brush" />
            </div>
          </div>
        </div>
      </div>

      {/* --- Right Side (Form) --- */}
      <div className="login-form-section">
        <div className="login-bg-blur" style={{ backgroundImage: `url(${bgImg})` }}></div>
        {/* Floating Shapes (Visible on Mobile via CSS) */}
        <div className="floating-shape shape-1"></div>
        <div className="floating-shape shape-2"></div>
        
        {/* Blurred Background */}
        <div className="login-bg-blur"></div>
        
        <div className="login-card">
          
          {/* ✨ 1. MOBILE BRAND HEADER (Hidden on Desktop) */}
          <div className="mobile-brand-header">
            <div className="mobile-logo-wrapper">
              <img src={logoImg} alt="Venky Art Logo" className="mobile-logo" />
            </div>
            <img src={titleImg} alt="Venky Art Academy" className="mobile-title" />
            <p className="mobile-tagline">Sign in to your academy portal</p>
          </div>

          {/* ✨ 2. DESKTOP WELCOME HEADER (Hidden on Mobile) */}
          <div className="welcome-header desktop-only">
            <h2>Welcome Back!</h2>
            <p>Sign in to your Thevenkyart Academy portal.</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="input-with-icon">
              <UserIcon />
              <input 
                type="text" 
                placeholder="Username"
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

            {/* <div className="forgot-link">
              <span className="link-text">Forgot password?</span>
            </div> */}

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? <span className="login-spinner"></span> : 'Sign In'}
            </button>
          </form>

          {error && <p className="error-msg">{error}</p>}

          <div className="create-account-link">
             {/* Removed empty link to clean up */}
          </div>
          
          {/* Mobile Footer */}
          <div className="mobile-footer">
            <p>© Thevenkyart Art Academy</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;