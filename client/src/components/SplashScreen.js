import { useEffect, useState } from 'react';
import './SplashScreen.css';

const SplashScreen = ({ onComplete }) => {
  const [phase, setPhase] = useState('enter'); // enter -> hold -> zoom

  useEffect(() => {
    // Phase 1: Logo appears with glow (already via CSS animation on mount)
    // Phase 2: After 1.2s, start the zoom-out transition
    const holdTimer = setTimeout(() => {
      setPhase('zoom');
    }, 1200);

    // Phase 3: After zoom animation completes, remove splash
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 1900);

    return () => {
      clearTimeout(holdTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div className={`splash-container splash-${phase}`}>
      {/* Animated background particles */}
      <div className="splash-particles">
        {[...Array(6)].map((_, i) => (
          <div key={i} className={`splash-particle p-${i + 1}`} />
        ))}
      </div>

      {/* Center logo group */}
      <div className="splash-center">
        {/* Animated ring behind logo */}
        <div className="splash-ring" />
        <div className="splash-ring ring-2" />

        {/* Academy logo */}
        <div className="splash-logo-wrapper">
          <img
            src="/new-logo1.png"
            alt="Academy Logo"
            className="splash-logo"
          />
        </div>

        {/* Academy name text */}
        <div className="splash-brand">
          <span className="splash-brand-text">Thevenkyart</span>
          <span className="splash-brand-sub">Art Academy</span>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
