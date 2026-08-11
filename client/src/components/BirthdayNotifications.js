// Shared "notification centre" bell used by AdminDashboard and TeacherDashboard.
// Surfaces student birthday reminders: 1 week before, 3 days before, and on the day.
import React, { useState, useEffect, useMemo, useRef } from "react";
import "./BirthdayNotifications.css";

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

const labelForOffset = (daysUntil) => {
  if (daysUntil === 0) return "🎉 Birthday is today!";
  if (daysUntil === 3) return "🎂 Birthday in 3 days";
  return "🎈 Birthday in 1 week";
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
 * reminded about (all students for Admin, assigned-class students for Teacher) and a
 * unique localStorage key so read state persists per user.
 */
const BirthdayNotificationBell = ({ students, storageKey }) => {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch {
      return [];
    }
  });
  const wrapRef = useRef(null);

  const notifications = useMemo(() => getBirthdayNotifications(students), [students]);

  // Drop read-ids that no longer correspond to an active notification (year/offset rolled over)
  // so localStorage doesn't grow forever.
  useEffect(() => {
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
  }, [notifications, storageKey]);

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
    if (readIds.includes(id)) return;
    persistReadIds([...readIds, id]);
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
      >
        <span aria-hidden="true">🔔</span>
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
              <div className="bday-notif-empty">No upcoming birthdays 🎈</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`bday-notif-item${readIds.includes(n.id) ? "" : " unread"}`}
                  onClick={() => markRead(n.id)}
                >
                  <div className="bday-notif-icon">🎂</div>
                  <div className="bday-notif-body">
                    <p className="bday-notif-title">
                      <strong>{n.name}</strong>&apos;s birthday
                      {n.className ? ` · ${n.className}` : ""}
                    </p>
                    <p className="bday-notif-sub">{labelForOffset(n.daysUntil)}</p>
                  </div>
                  {!readIds.includes(n.id) && <span className="bday-notif-dot" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BirthdayNotificationBell;
