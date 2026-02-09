import React, { useEffect, useState } from 'react';
import './SplashScreen.css';

const SplashScreen = ({ onComplete }) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // 1. Wait 2.5 seconds, then start fading out
    const timer = setTimeout(() => {
      setFadeOut(true);
    }, 2500);

    // 2. Wait 3.0 seconds, then remove the screen
    const cleanup = setTimeout(() => {
      onComplete(); 
    }, 3000);

    return () => {
      clearTimeout(timer);
      clearTimeout(cleanup);
    };
  }, [onComplete]);

  return (
    <div className={`splash-container ${fadeOut ? 'fade-out' : ''}`}>
      {/* 1. The Background Art (Full Screen) */}
      <img 
        src="/splash.png" 
        alt="Background Art" 
        className="splash-image" 
      />

      {/* 2. TOP SECTION: Logo + Spinner */}
      <div className="splash-header">
        <img 
          src="/new-logo1.png" 
          alt="Logo" 
          className="splash-logo-top" 
        />
        <div className="art-loader"></div>
      </div>
    </div>
  );
};

export default SplashScreen;