// src/components/Login.js
import { useState } from 'react';
import axios from 'axios';
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
  // Forgot password: the academy resets it (passwords are never sent out)
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotId, setForgotId] = useState('');
  const [forgotState, setForgotState] = useState('idle'); // idle | sending | sent | error
  const sendForgot = async (e) => {
    e.preventDefault();
    if (!forgotId.trim()) return;
    setForgotState('sending');
    try {
      await axios.post('https://art-portal-7n6r.onrender.com/api/parent/forgot-password', { identifier: forgotId.trim() });
      setForgotState('sent');
    } catch {
      setForgotState('error');
    }
  };
  const waReset = `https://wa.me/919963613404?text=${encodeURIComponent(`Hello, I can't log in to the Thevenkyart app. Please reset my password. My username / phone: ${forgotId.trim() || username}`)}`;

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

            <div className="forgot-link">
              <button type="button" className="link-text" onClick={() => { setForgotOpen(true); setForgotId(username); setForgotState('idle'); }}>
                Forgot password?
              </button>
            </div>

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? <span className="login-spinner"></span> : 'Sign In'}
            </button>
          </form>

          {error && <p className="error-msg">{error}</p>}

          {forgotOpen && (
            <div className="forgot-panel" role="dialog" aria-modal="false" aria-labelledby="forgot-title">
              <h3 id="forgot-title">Forgot your password?</h3>
              {forgotState === 'sent' ? (
                <>
                  <p>Thanks — we've told the academy. They'll send you a new password soon. For a faster reply, message us on WhatsApp.</p>
                  <a className="forgot-wa" href={waReset} target="_blank" rel="noreferrer">Message on WhatsApp</a>
                </>
              ) : (
                <form onSubmit={sendForgot}>
                  <p>Enter your username or the parent phone number. The academy will reset your password.</p>
                  <input type="text" value={forgotId} onChange={(e) => setForgotId(e.target.value)} placeholder="Username or phone" aria-label="Username or phone" autoComplete="username" />
                  {forgotState === 'error' && <p className="error-msg">Couldn't send. Please check your internet, or message us on WhatsApp.</p>}
                  <div className="forgot-actions">
                    <button type="button" className="forgot-cancel" onClick={() => setForgotOpen(false)}>Cancel</button>
                    <button type="submit" className="login-btn" disabled={forgotState === 'sending'}>{forgotState === 'sending' ? 'Sending…' : 'Ask for a reset'}</button>
                  </div>
                  <a className="forgot-wa-link" href={waReset} target="_blank" rel="noreferrer">or message us on WhatsApp</a>
                </form>
              )}
            </div>
          )}

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