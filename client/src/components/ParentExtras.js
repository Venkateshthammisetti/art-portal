// Parent dashboard extras: notification settings, the "What's new" card and the
// phone "More" sheet. Kept out of ParentDashboard.js, which is already large.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";

const API = "https://art-portal-7n6r.onrender.com/api";

// ---------- small icons (24×24, currentColor) ----------
const Svg = ({ children, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
export const IconBellSm = (p) => <Svg {...p}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></Svg>;
const IconClose = (p) => <Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>;
const IconImage = (p) => <Svg {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></Svg>;
const IconDoc = (p) => <Svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8" /></Svg>;
const IconAward = (p) => <Svg {...p}><circle cx="12" cy="8" r="6" /><path d="M9 13.5 7 22l5-3 5 3-2-8.5" /></Svg>;
const IconStar = (p) => <Svg {...p}><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></Svg>;
const IconChevron = (p) => <Svg {...p}><path d="m9 18 6-6-6-6" /></Svg>;

// ---------- bottom sheet ----------
export const ParentSheet = ({ title, onClose, children, dark }) => {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [onClose]);
  return createPortal(
    <div className={`pd-sheet-backdrop${dark ? " dark" : ""}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="pd-sheet" role="dialog" aria-modal="true" aria-labelledby="pd-sheet-title" tabIndex={-1}>
        <div className="pd-sheet-head">
          <h2 id="pd-sheet-title">{title}</h2>
          <button type="button" className="pd-sheet-close" onClick={onClose} aria-label="Close"><IconClose /></button>
        </div>
        <div className="pd-sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
};

// ---------- notification settings ----------
export const NOTIFY_TYPES = [
  { key: "reports", label: "Progress reports", hint: "When the teacher shares a new report" },
  { key: "artwork", label: "New artwork", hint: "When new photos are added to the gallery" },
  { key: "certificates", label: "Certificates", hint: "When a certificate is issued" },
  { key: "attendance", label: "Absences", hint: "If your child is marked absent" },
  { key: "classReminders", label: "Class reminders", hint: "30 minutes before each class" },
  { key: "classChanges", label: "Timetable changes", hint: "If class timing or the joining link changes" },
  { key: "posters", label: "Academy posters", hint: "Spotlights, festival greetings and announcements" },
];

const permissionState = () => {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";
  return Notification.permission; // "granted" | "denied" | "default"
};

export const NotificationSettings = ({ userId, initialPrefs, dark, onClose, onEnableDevice, onSaved }) => {
  const [prefs, setPrefs] = useState(() => {
    const p = {};
    NOTIFY_TYPES.forEach(({ key }) => { p[key] = initialPrefs?.[key] !== false; });
    return p;
  });
  const [perm, setPerm] = useState(permissionState);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  const toggle = async (key) => {
    const value = !prefs[key];
    setPrefs((p) => ({ ...p, [key]: value }));
    setSaving(key);
    setError("");
    try {
      const res = await axios.put(`${API}/users/${userId}/notify-prefs`, { prefs: { [key]: value } });
      onSaved?.(res.data?.notifyPrefs);
    } catch {
      setPrefs((p) => ({ ...p, [key]: !value }));
      setError("Couldn't save that change. Please check your internet and try again.");
    } finally {
      setSaving("");
    }
  };

  const enable = async () => {
    await onEnableDevice?.();
    setPerm(permissionState());
  };

  return (
    <ParentSheet title="Notifications" onClose={onClose} dark={dark}>
      <div className={`pd-device-status ${perm}`}>
        <IconBellSm />
        <div>
          <strong>
            {perm === "granted" ? "Alerts are on for this phone" : perm === "denied" ? "Alerts are blocked on this phone" : perm === "unsupported" ? "This browser can't show alerts" : "Alerts are off on this phone"}
          </strong>
          <span>
            {perm === "granted" ? "Choose below which updates you want."
              : perm === "denied" ? "Allow notifications for this app in your phone's settings, then come back."
                : perm === "unsupported" ? "On iPhone, add the app to your Home Screen first (Share → Add to Home Screen)."
                  : "Turn them on to hear about reports, classes and more."}
          </span>
        </div>
        {perm === "default" && <button type="button" className="pd-btn-primary" onClick={enable}>Turn on</button>}
      </div>

      <ul className="pd-toggle-list">
        {NOTIFY_TYPES.map(({ key, label, hint }) => (
          <li key={key}>
            <label className="pd-toggle-row">
              <span className="pd-toggle-text"><strong>{label}</strong><span>{hint}</span></span>
              <input type="checkbox" role="switch" checked={prefs[key]} disabled={saving === key} onChange={() => toggle(key)} />
              <span className="pd-switch" aria-hidden="true" />
            </label>
          </li>
        ))}
      </ul>
      {error && <p className="pd-sheet-error" role="alert">{error}</p>}
      <p className="pd-sheet-note">Fee reminders and birthday wishes are always sent.</p>
    </ParentSheet>
  );
};

// ---------- what's new ----------
const SEEN_DAYS = 14; // only things from the last two weeks can be "new"
const seenKey = (id) => `parent_whatsnew_seen_${id}`;
const readSeen = (id) => {
  try { return JSON.parse(localStorage.getItem(seenKey(id)) || "null"); } catch { return null; }
};
const writeSeen = (id, ids) => {
  try { localStorage.setItem(seenKey(id), JSON.stringify(ids.slice(-80))); } catch { /* ignore */ }
};
const timeAgo = (d) => {
  const ms = Date.now() - new Date(d).getTime();
  const days = Math.floor(ms / 86400000);
  if (days <= 0) { const h = Math.floor(ms / 3600000); return h <= 0 ? "Just now" : `${h}h ago`; }
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};
const monthName = (ym) => {
  const [y, m] = String(ym || "").split("-").map(Number);
  return y && m ? new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long" }) : "";
};

export const WhatsNewCard = ({ userId, childName, reports, onOpen }) => {
  const [extra, setExtra] = useState({ art: [], certs: [], posters: [], loaded: false });
  const [seen, setSeen] = useState(() => readSeen(userId));

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      axios.get(`${API}/gallery/student/${userId}`),
      axios.get(`${API}/certifications/student/${userId}`),
      axios.get(`${API}/spotlights`),
    ]).then(([a, c, s]) => {
      if (!alive) return;
      setExtra({
        art: a.status === "fulfilled" ? a.value.data || [] : [],
        certs: c.status === "fulfilled" ? c.value.data || [] : [],
        posters: s.status === "fulfilled" ? s.value.data || [] : [],
        loaded: true,
      });
    });
    return () => { alive = false; };
  }, [userId]);

  const items = useMemo(() => {
    const list = [];
    // Artwork: one entry per upload day ("3 new artworks")
    const byDay = new Map();
    extra.art.forEach((a) => {
      const at = a.createdAt || a.dateCreated;
      if (!at) return;
      const day = String(at).slice(0, 10);
      const cur = byDay.get(day) || { at, count: 0, image: a.imageUrl };
      cur.count++;
      if (new Date(at) > new Date(cur.at)) cur.at = at;
      byDay.set(day, cur);
    });
    byDay.forEach((v, day) => list.push({ id: `art-${day}`, kind: "art", tab: "gallery", at: v.at, image: v.image, title: v.count === 1 ? "New artwork added" : `${v.count} new artworks added`, sub: "Gallery" }));
    (reports || []).forEach((r) => r.createdAt && list.push({ id: `rep-${r._id}`, kind: "report", tab: "reports", at: r.createdAt, title: `${monthName(r.month)} progress report`, sub: r.teacherId?.fullName ? `From ${r.teacherId.fullName}` : "Reports" }));
    extra.certs.forEach((c) => { const at = c.createdAt || c.dateIssued; if (at) list.push({ id: `cert-${c._id}`, kind: "cert", tab: "certifications", at, title: c.title || "New certificate", sub: "Certificates" }); });
    extra.posters.forEach((p) => {
      const at = p.publishedAt || p.createdAt;
      if (!at) return;
      const mine = p.studentId && String(p.studentId) === String(userId);
      list.push({
        id: `poster-${p._id}`, kind: "poster", poster: p, at,
        title: mine ? `${childName || "Your child"} is in the Artist Spotlight!` : p.category === "artist_spotlight" ? `Artist Spotlight: ${p.studentName}` : p.achievementTitle,
        sub: p.category === "festival_greeting" ? "Greeting" : p.category === "announcement" ? "Announcement" : "Spotlight",
        mine,
      });
    });
    return list.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 6);
  }, [extra, reports, userId, childName]);

  // First time ever: everything already here counts as seen, so the card
  // doesn't open with a wall of dots.
  useEffect(() => {
    if (seen === null && extra.loaded) {
      const ids = items.map((i) => i.id);
      writeSeen(userId, ids);
      setSeen(ids);
    }
  }, [seen, extra.loaded, items, userId]);

  const isNew = (i) => seen !== null && !seen.includes(i.id) && Date.now() - new Date(i.at).getTime() < SEEN_DAYS * 86400000;
  const unread = items.filter(isNew).length;
  const markSeen = (ids) => {
    const next = Array.from(new Set([...(seen || []), ...ids]));
    writeSeen(userId, next);
    setSeen(next);
  };

  const Icon = { art: IconImage, report: IconDoc, cert: IconAward, poster: IconStar };
  return (
    <div className="info-card whats-new-card">
      <div className="wn-head">
        <h3><IconBellSm size={18} /> What's new {unread > 0 && <span className="wn-count">{unread}</span>}</h3>
        {unread > 0 && <button type="button" className="wn-mark" onClick={() => markSeen(items.map((i) => i.id))}>Mark all read</button>}
      </div>
      {!extra.loaded && items.length === 0 ? (
        <div className="wn-skeleton" aria-hidden="true"><span /><span /><span /></div>
      ) : items.length === 0 ? (
        <p className="empty-mini">Nothing new yet. New artwork, reports and certificates will appear here.</p>
      ) : (
        <ul className="wn-list">
          {items.map((i) => {
            const I = Icon[i.kind];
            return (
              <li key={i.id}>
                <button type="button" className={`wn-item${isNew(i) ? " unread" : ""}${i.mine ? " mine" : ""}`} onClick={() => { markSeen([i.id]); onOpen(i); }}>
                  {i.image ? <img src={i.image} alt="" className="wn-thumb" loading="lazy" /> : <span className={`wn-icon ${i.kind}`}><I size={18} /></span>}
                  <span className="wn-text"><strong>{i.title}</strong><span>{i.sub} · {timeAgo(i.at)}</span></span>
                  {isNew(i) && <span className="wn-dot" aria-label="New" />}
                  <IconChevron size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

// ---------- phone "More" sheet ----------
export const MoreSheet = ({ items, active, onPick, onClose, dark }) => (
  <ParentSheet title="More" onClose={onClose} dark={dark}>
    <ul className="pd-more-list">
      {items.map(({ key, label, hint, icon }) => (
        <li key={key}>
          <button type="button" className={`pd-more-item${active === key ? " active" : ""}`} onClick={() => onPick(key)} aria-current={active === key ? "page" : undefined}>
            <span className="pd-more-icon">{icon}</span>
            <span className="pd-more-text"><strong>{label}</strong>{hint && <span>{hint}</span>}</span>
            <IconChevron size={16} />
          </button>
        </li>
      ))}
    </ul>
  </ParentSheet>
);
