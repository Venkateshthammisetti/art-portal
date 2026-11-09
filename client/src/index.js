import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import './utils/authHeader'; // sends the login pass with every API call
import './utils/installPrompt'; // catches Chrome's install event before the app draws
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// Dev-only browser-preference panel; the dynamic import keeps it out of production builds.
if (process.env.NODE_ENV === 'development') {
  import('devknobs').then(({ mount }) => mount());
}

// Service worker: push notifications plus offline reading for parents.
// Registered in production builds (and in development only with localStorage swDev=1).
if ("serviceWorker" in navigator) {
  let devOptIn = false;
  try { devOptIn = localStorage.getItem("swDev") === "1"; } catch { /* ignore */ }
  if (process.env.NODE_ENV === "production" || devOptIn) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => console.log("SW registration failed:", err.message));
      // hand the worker the app files already loaded, so a first visit is enough for offline use
      navigator.serviceWorker.ready.then((reg) => {
        const urls = [window.location.origin + "/", ...performance.getEntriesByType("resource").map((r) => r.name)];
        (navigator.serviceWorker.controller || reg.active)?.postMessage({ type: "cache-app-files", urls });
      }).catch(() => {});
    });
  }
}
