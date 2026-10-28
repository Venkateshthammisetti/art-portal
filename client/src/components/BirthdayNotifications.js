// Shared "notification centre" bell used by every dashboard.
// Surfaces admin posters — Artist Spotlights, festival greetings and announcements
// (newest first) — and student birthday reminders:
// 1 week before, 3 days before, and on the day.
import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import "./BirthdayNotifications.css";
import { IconBell, IconBirthday } from "./Icons";
import { SpotlightViewer, formatPublishedAt, isDarkContext, categoryOf } from "./ArtistSpotlight";

const SPOTLIGHTS_IN_BELL = 10; // most recent posters kept in the bell
const POPUP_WINDOW_DAYS = 7; // only posters this recent pop up automatically

const spotlightLine = (sp) => {
  if (sp.category === "festival_greeting") return <strong>{sp.achievementTitle}</strong>;
  if (sp.category === "announcement") return <>Announcement: <strong>{sp.achievementTitle}</strong></>;
  return <>Artist Spotlight: <strong>{sp.studentName}</strong></>;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const REMINDER_OFFSETS = [0, 3, 7]; // days before (0 = today)

// childDob is stored as a plain "YYYY-MM-DD" string, which Date parses as UTC midnight.
// We work in UTC throughout so local timezone never shifts the day-of-month by one.
const getNextBirthdayInfo = (dobStr, today) => {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return null;

  const month = dob.getUTCMonth();
  const day = dob.getUTCDate();
  const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

  let year = today.getFullYear();
  let next = Date.UTC(year, month, day);
  if (next < todayUTC) {
    year += 1;
    next = Date.UTC(year, month, day);
  }

  const daysUntil = Math.round((next - todayUTC) / MS_PER_DAY);
  return { daysUntil, year };
};

// Plain text — the row already shows a birthday icon beside it, so repeating
// the meaning as an emoji here would just be read out twice by a screen reader.
const labelForOffset = (daysUntil) => {
  if (daysUntil === 0) return "Birthday is today!";
  if (daysUntil === 3) return "Birthday in 3 days";
  return "Birthday in 1 week";
};

// Exported for reuse/testing — turns a list of student user docs into upcoming birthday reminders.
export const getBirthdayNotifications = (students, today = new Date()) => {
  const list = [];
  (students || []).forEach((s) => {
    if (!s || s.isActive === false || !s.childDob) return;
    const info = getNextBirthdayInfo(s.childDob, today);
    if (!info || !REMINDER_OFFSETS.includes(info.daysUntil)) return;
    list.push({
      id: `${s._id}-${info.year}-${info.daysUntil}`,
      name: s.childName || s.fullName || "A student",
      className: s.className || "",
      daysUntil: info.daysUntil,
    });
  });
  return list.sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name));
};

/**
 * Notification-centre bell. Pass the list of student user docs the viewer should be
 * reminded about (all students for Admin, assigned-class students for Teacher, none
 * for Parent) and a unique localStorage key so read state persists per user.
 *
 * `autoPopup` opens the newest unseen poster (from the last week) by itself when the
 * app opens, once per poster. `holdPopup` delays it while another dialog is showing
 * or the page is still loading, so popups never stack.
 */
const BirthdayNotificationBell = ({ students, storageKey, autoPopup = false, holdPopup = false }) => {
  const [open, setOpen] = useState(false);
  const [spotlights, setSpotlights] = useState([]);
  const [spotlightsLoaded, setSpotlightsLoaded] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [pendingSpotlightId, setPendingSpotlightId] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("spotlight");
    } catch {
      return null;
    }
  });
  const [readIds, setReadIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch {
      return [];
    }
  });
  const wrapRef = useRef(null);

  const notifications = useMemo(() => {
    const spotlightItems = spotlights.slice(0, SPOTLIGHTS_IN_BELL).map((sp) => ({
      id: `spotlight-${sp._id}`,
      type: "spotlight",
      spotlight: sp,
    }));
    return [...spotlightItems, ...getBirthdayNotifications(students)];
  }, [students, spotlights]);

  const fetchSpotlights = () =>
    axios
      .get("https://art-portal-7n6r.onrender.com/api/spotlights")
      .then((res) => {
        setSpotlights(res.data || []);
        setSpotlightsLoaded(true);
      })
      .catch((err) => console.error("Spotlights fetch failed:", err));

  // Load on mount, and again each time the bell is opened so newly published or
  // deleted spotlights show up without a page reload.
  useEffect(() => {
    fetchSpotlights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (open) fetchSpotlights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Tapping a spotlight push opens the app with ?spotlight=<id> (or, if the app is
  // already open, the service worker posts a message) — show that poster.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return undefined;
    const onMessage = (e) => {
      if (e.data?.type === "open-spotlight" && e.data.id) setPendingSpotlightId(e.data.id);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  // Auto popup: newest poster this user hasn't seen, shown once. The short delay
  // lets the dashboard's own load-time dialogs (e.g. fee reminder) claim the screen
  // first; `holdPopup` is re-checked when the timer fires.
  const holdRef = useRef(holdPopup);
  holdRef.current = holdPopup;
  const popupShownKey = `${storageKey}_popup_shown`;
  const poppedThisOpen = useRef(false); // at most one popup per app open; the rest wait in the bell
  useEffect(() => {
    if (!autoPopup || poppedThisOpen.current) return undefined;
    if (!spotlightsLoaded || holdPopup || viewing || pendingSpotlightId) return undefined;
    let shown;
    try {
      shown = JSON.parse(localStorage.getItem(popupShownKey) || "[]");
    } catch {
      shown = [];
    }
    const cutoff = Date.now() - POPUP_WINDOW_DAYS * MS_PER_DAY;
    const fresh = spotlights.find(
      (sp) =>
        new Date(sp.publishedAt).getTime() >= cutoff &&
        !shown.includes(sp._id) &&
        !readIds.includes(`spotlight-${sp._id}`),
    );
    if (!fresh) return undefined;
    const timer = setTimeout(() => {
      if (holdRef.current) return;
      poppedThisOpen.current = true;
      localStorage.setItem(popupShownKey, JSON.stringify([...shown, fresh._id].slice(-50)));
      markRead(`spotlight-${fresh._id}`);
      setViewing(fresh);
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPopup, spotlightsLoaded, holdPopup, viewing, pendingSpotlightId, spotlights]);

  useEffect(() => {
    if (!pendingSpotlightId || !spotlightsLoaded) return;
    const match = spotlights.find((sp) => sp._id === pendingSpotlightId);
    if (match) {
      poppedThisOpen.current = true;
      setViewing(match);
      markRead(`spotlight-${match._id}`);
    }
    setPendingSpotlightId(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has("spotlight")) {
      url.searchParams.delete("spotlight");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSpotlightId, spotlightsLoaded, spotlights]);

  // Drop read-ids that no longer correspond to an active notification (year/offset rolled over)
  // so localStorage doesn't grow forever. Wait for spotlights to load so their read
  // state isn't pruned before they appear.
  useEffect(() => {
    if (!spotlightsLoaded) return;
    const activeIds = new Set(notifications.map((n) => n.id));
    setReadIds((prev) => {
      const pruned = prev.filter((id) => activeIds.has(id));
      if (pruned.length !== prev.length) {
        localStorage.setItem(storageKey, JSON.stringify(pruned));
        return pruned;
      }
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications, storageKey, spotlightsLoaded]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const persistReadIds = (next) => {
    setReadIds(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const markRead = (id) => {
    setReadIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  };

  const activate = (n) => {
    markRead(n.id);
    if (n.type === "spotlight") {
      setOpen(false);
      setViewing(n.spotlight);
    }
  };

  const markAllRead = () => persistReadIds(notifications.map((n) => n.id));

  const unreadCount = notifications.filter((n) => !readIds.includes(n.id)).length;

  return (
    <div className="bday-notif-wrap" ref={wrapRef}>
      <button
        type="button"
        className="bday-notif-bell-btn"
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
      >
        <IconBell size={18} />
        {unreadCount > 0 && (
          <span className="bday-notif-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>
      {open && (
        <div className="bday-notif-dropdown">
          <div className="bday-notif-header">
            <span>Notifications</span>
            {notifications.length > 0 && (
              <button type="button" className="bday-notif-mark-all" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>
          <div className="bday-notif-list">
            {notifications.length === 0 ? (
              <div className="bday-notif-empty">No notifications yet</div>
            ) : (
              notifications.map((n) =>
                n.type === "spotlight" ? (
                  <div
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    className={`bday-notif-item spotlight${readIds.includes(n.id) ? "" : " unread"}`}
                    onClick={() => activate(n)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        activate(n);
                      }
                    }}
                  >
                    {(() => {
                      const c = categoryOf(n.spotlight);
                      return (
                        <div className={`bday-notif-icon spotlight tone-${c.tone}`}><c.Icon size={20} /></div>
                      );
                    })()}
                    <div className="bday-notif-body">
                      <p className="bday-notif-title">{spotlightLine(n.spotlight)}</p>
                      <p className="bday-notif-sub">
                        {n.spotlight.category === "artist_spotlight" || !n.spotlight.category
                          ? n.spotlight.achievementTitle
                          : categoryOf(n.spotlight).label}
                      </p>
                      <p className="bday-notif-sub">{formatPublishedAt(n.spotlight.publishedAt)}</p>
                    </div>
                    {!readIds.includes(n.id) && <span className="bday-notif-dot" />}
                  </div>
                ) : (
                <div
                  key={n.id}
                  className={`bday-notif-item${readIds.includes(n.id) ? "" : " unread"}`}
                  onClick={() => markRead(n.id)}
                >
                  <div className="bday-notif-icon"><IconBirthday size={20} /></div>
                  <div className="bday-notif-body">
                    <p className="bday-notif-title">
                      <strong>{n.name}</strong>&apos;s birthday
                      {n.className ? ` · ${n.className}` : ""}
                    </p>
                    <p className="bday-notif-sub">{labelForOffset(n.daysUntil)}</p>
                  </div>
                  {!readIds.includes(n.id) && <span className="bday-notif-dot" />}
                </div>
                ),
              )
            )}
          </div>
        </div>
      )}
      {viewing && (
        <SpotlightViewer
          spotlight={viewing}
          dark={isDarkContext(wrapRef.current)}
          onClose={() => setViewing(null)}
          onUpdate={(updated) => {
            setViewing(updated);
            setSpotlights((list) => list.map((sp) => (sp._id === updated._id ? updated : sp)));
          }}
        />
      )}
    </div>
  );
};

export default BirthdayNotificationBell;
