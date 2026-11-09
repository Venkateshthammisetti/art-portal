// Parent Home: "Install the app" card. Android: one tap opens the install
// prompt. iPhone/iPad: shows how to Add to Home Screen (needed there for
// notifications). "Not now" hides it for 14 days; More › Install the app is
// always available until the app is installed.
import React, { useState } from "react";
import { ParentSheet } from "./ParentExtras";
import { useInstallApp } from "../utils/installPrompt";
import "./InstallApp.css";

const SNOOZE_KEY = "installPromptSnoozedAt";
const SNOOZE_DAYS = 14;
const snoozed = () => {
  try {
    const at = Number(localStorage.getItem(SNOOZE_KEY));
    return at > 0 && Date.now() - at < SNOOZE_DAYS * 86400000;
  } catch { return false; }
};

const ShareIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12" /><path d="m8 7 4-4 4 4" /><path d="M6 11H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1" />
  </svg>
);
const PlusSquare = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="4" /><path d="M12 8v8M8 12h8" />
  </svg>
);
const PhoneIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="6" y="2" width="12" height="20" rx="3" /><path d="M12 18h.01" /><path d="m9.5 9.5 2.5 2.5 2.5-2.5M12 6v6" />
  </svg>
);

export const IosInstallSheet = ({ inAppBrowser, dark, onClose }) => (
  <ParentSheet title="Add to Home Screen" onClose={onClose} dark={dark}>
    <p className="ia-sheet-lead">On iPhone and iPad, class reminders and other notifications only arrive when the app is on your Home Screen.</p>
    <ol className="ia-steps">
      {inAppBrowser && (
        <li><span className="ia-num">1</span><span>Open this page in <strong>Safari</strong> (tap ••• or the compass, then "Open in browser").</span></li>
      )}
      <li><span className="ia-num">{inAppBrowser ? 2 : 1}</span><span>Tap the <strong>Share</strong> button <span className="ia-chip"><ShareIcon /></span> at the bottom of Safari (top right on iPad).</span></li>
      <li><span className="ia-num">{inAppBrowser ? 3 : 2}</span><span>Scroll down and tap <strong>Add to Home Screen</strong> <span className="ia-chip"><PlusSquare /></span></span></li>
      <li><span className="ia-num">{inAppBrowser ? 4 : 3}</span><span>Tap <strong>Add</strong>. Open VenkyArt from your Home Screen and log in once.</span></li>
    </ol>
    <button type="button" className="pd-btn-primary ia-sheet-done" onClick={onClose}>Got it</button>
  </ParentSheet>
);

// The card on Home. `onInstalled` lets the dashboard show a thank-you toast.
export const InstallCard = ({ dark, onInstalled }) => {
  const app = useInstallApp();
  const [hidden, setHidden] = useState(snoozed);
  const [steps, setSteps] = useState(false);
  if (!app.available || hidden) return steps ? <IosInstallSheet inAppBrowser={app.inAppBrowser} dark={dark} onClose={() => setSteps(false)} /> : null;

  const notNow = () => {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now())); } catch { /* ignore */ }
    setHidden(true);
  };
  const install = async () => {
    if (app.canPrompt) {
      const outcome = await app.promptInstall();
      if (outcome === "accepted") onInstalled?.();
    } else if (app.ios) setSteps(true);
  };

  return (
    <section className="ia-card" aria-labelledby="ia-title">
      <span className="ia-icon"><PhoneIcon /></span>
      <div className="ia-text">
        <h3 id="ia-title">{app.ios ? "Add VenkyArt to your Home Screen" : "Install the VenkyArt app"}</h3>
        <p>{app.ios
          ? "Open it like an app, and get class reminders and updates as notifications."
          : "Opens from your home screen like any app, works offline, and class reminders arrive on time."}</p>
      </div>
      <div className="ia-actions">
        <button type="button" className="ia-btn" onClick={install}>{app.ios ? "Show me how" : "Install"}</button>
        <button type="button" className="ia-later" onClick={notNow}>Not now</button>
      </div>
      {steps && <IosInstallSheet inAppBrowser={app.inAppBrowser} dark={dark} onClose={() => setSteps(false)} />}
    </section>
  );
};
