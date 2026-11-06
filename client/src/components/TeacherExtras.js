// Teacher dashboard extras: student profile sheet, "More" sheet for the phone
// bottom bar, and small helpers shared by the Overview and Attendance tabs.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { AttendanceCalendar, attendanceStreak, bestStreak } from "./ParentProgress";
import { TeacherReportThread } from "./ParentSelf";
import "./TeacherExtras.css";

const API = "https://art-portal-7n6r.onrender.com/api";

// ---------- helpers ----------
// Today's date in India (class times are IST), "YYYY-MM-DD"
export const istDateKey = (offsetDays = 0) => new Date(Date.now() + 330 * 60000 + offsetDays * 86400000).toISOString().slice(0, 10);

// Parent absence notices for a student on a date. A notice names the class and
// time it was sent for; older notices without them match on the date alone.
export const absenceFor = (student, date, classId = null, time = null) =>
  (student?.absenceNotices || []).find((n) =>
    n.date === date &&
    (!n.classId || !classId || String(n.classId) === String(classId)) &&
    (!n.time || !time || n.time === time));

const monthLabel = (ym) => {
  const [y, m] = String(ym || "").split("-").map(Number);
  return y && m ? new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" }) : "";
};

// ---------- sheet ----------
const open = [];
export const TSheet = ({ title, subtitle, onClose, dark, children, wide }) => {
  const ref = useRef(null);
  const me = useRef({});
  useEffect(() => {
    const token = me.current;
    open.push(token);
    const prev = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => e.key === "Escape" && open[open.length - 1] === token && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const i = open.indexOf(token);
      if (i > -1) open.splice(i, 1);
      prev?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return createPortal(
    <div className="tsheet-backdrop" data-theme={dark ? "dark" : "light"} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`tsheet${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="tsheet-title" tabIndex={-1}>
        <div className="tsheet-head">
          <div>
            <h2 id="tsheet-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="tsheet-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="tsheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
};

// ---------- More (phone bottom bar) ----------
export const TMoreSheet = ({ items, active, onPick, onClose, dark }) => (
  <TSheet title="More" onClose={onClose} dark={dark}>
    <ul className="tmore-list">
      {items.map(({ key, label, hint, icon }) => (
        <li key={key}>
          <button type="button" className={`tmore-item${active === key ? " active" : ""}`} onClick={() => onPick(key)} aria-current={active === key ? "page" : undefined}>
            <span className="tmore-icon">{icon}</span>
            <span className="tmore-text"><strong>{label}</strong>{hint && <span>{hint}</span>}</span>
          </button>
        </li>
      ))}
    </ul>
  </TSheet>
);

// ---------- student profile ----------
const Stars = ({ n }) => <span className="tsp-stars" aria-label={`${n} out of 5`}>{"★".repeat(n)}<span>{"★".repeat(Math.max(0, 5 - n))}</span></span>;

export const StudentProfileSheet = ({ student, dark, onClose, onWriteReport }) => {
  const [data, setData] = useState({ loading: true, att: [], reports: [], art: [], certs: [], failed: false });
  const sid = student._id;

  const load = useCallback(() => {
    setData((d) => ({ ...d, loading: true, failed: false }));
    Promise.allSettled([
      axios.get(`${API}/attendance/student/${sid}`),
      axios.get(`${API}/feedback/student/${sid}`),
      axios.get(`${API}/gallery/student/${sid}`),
      axios.get(`${API}/certifications/student/${sid}`),
    ]).then(([a, r, g, c]) => {
      const ok = (x) => (x.status === "fulfilled" && Array.isArray(x.value.data) ? x.value.data : []);
      setData({ loading: false, att: ok(a), reports: ok(r), art: ok(g), certs: ok(c), failed: [a, r, g, c].some((x) => x.status === "rejected") });
    });
  }, [sid]);
  useEffect(() => { load(); }, [load]);

  const monthKey = istDateKey().slice(0, 7);
  const stats = useMemo(() => {
    const inMonth = data.att.filter((r) => String(r.date).slice(0, 7) === monthKey);
    const present = inMonth.filter((r) => r.status === "Present").length;
    const absent = inMonth.filter((r) => r.status === "Absent").length;
    const missed = inMonth.filter((r) => r.status === "Missed").length;
    const held = present + absent + missed;
    const allHeld = data.att.length;
    const allPresent = data.att.filter((r) => r.status === "Present").length;
    // recent trouble: absent/missed in each of the last 3 recorded classes
    const last3 = [...data.att].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 3);
    return {
      present, absent, missed, held,
      rate: held ? Math.round((present / held) * 100) : null,
      overall: allHeld ? Math.round((allPresent / allHeld) * 100) : null,
      streak: attendanceStreak(data.att),
      best: bestStreak(data.att),
      worry: last3.length === 3 && last3.every((r) => r.status !== "Present"),
    };
  }, [data.att, monthKey]);

  const upcoming = (student.absenceNotices || []).filter((n) => n.date >= istDateKey()).sort((a, b) => a.date.localeCompare(b.date));
  const reports = [...data.reports].sort((a, b) => String(b.month).localeCompare(String(a.month)));
  const latestArt = [...data.art].sort((a, b) => String(b.dateCreated || b.createdAt).localeCompare(String(a.dateCreated || a.createdAt))).slice(0, 6);
  const [artOpen, setArtOpen] = useState(null);

  return (
    <TSheet title={student.childName || student.username} subtitle={[student.className, student.classMode === "offline" ? "Offline" : "Online", student.childAge ? `${student.childAge} yrs` : null].filter(Boolean).join(" · ")} onClose={onClose} dark={dark} wide>
      {data.failed && (
        <div className="tsp-banner" role="alert">
          <span>Some details couldn't load.</span>
          <button type="button" onClick={load}>Retry</button>
        </div>
      )}
      {stats.worry && (
        <div className="tsp-banner warn" role="status">Hasn't attended the last 3 classes. Worth a check-in with the parent.</div>
      )}

      {upcoming.length > 0 && (
        <section className="tsp-section">
          <h3>Parent has told us</h3>
          <ul className="tsp-list">
            {upcoming.map((n) => (
              <li key={n._id || `${n.date}-${n.time}`}>
                <strong>{new Date(`${n.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}{n.time ? ` · ${n.time}` : ""}</strong>
                <span>{n.reason || "Can't attend"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="tsp-section">
        <h3>Attendance</h3>
        {data.loading ? <div className="tsp-skel" aria-hidden="true" /> : (
          <>
            <div className="tsp-stats">
              <div><strong>{stats.rate === null ? "–" : `${stats.rate}%`}</strong><span>this month ({stats.present}/{stats.held})</span></div>
              <div><strong>{stats.overall === null ? "–" : `${stats.overall}%`}</strong><span>overall</span></div>
              <div><strong>{stats.streak}</strong><span>in a row (best {stats.best})</span></div>
              {stats.missed > 0 && <div><strong>{stats.missed}</strong><span>missed this month</span></div>}
            </div>
            <AttendanceCalendar month={monthKey} records={data.att} />
          </>
        )}
      </section>

      <section className="tsp-section">
        <div className="tsp-section-head">
          <h3>Reports</h3>
          <button type="button" className="tsp-link" onClick={() => onWriteReport(student)}>Write a report</button>
        </div>
        {data.loading ? <div className="tsp-skel" aria-hidden="true" /> : reports.length === 0 ? <p className="tsp-empty">No reports yet.</p> : (
          <ul className="tsp-list">
            {reports.slice(0, 4).map((r) => (
              <li key={r._id}>
                <strong>{monthLabel(r.month)} <Stars n={Number(r.rating) || 0} /></strong>
                <span>{String(r.feedbackText || "").slice(0, 110)}{String(r.feedbackText || "").length > 110 ? "…" : ""}</span>
                {(r.messages?.length > 0 || r.parentComment) && <em className="tsp-chip">{r.messages?.length || 1} message{(r.messages?.length || 1) === 1 ? "" : "s"} with the parent</em>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="tsp-section">
        <h3>Artwork <span className="tsp-count">{data.art.length}</span></h3>
        {data.loading ? <div className="tsp-skel" aria-hidden="true" /> : latestArt.length === 0 ? <p className="tsp-empty">No artwork uploaded yet.</p> : (
          <div className="tsp-art">
            {latestArt.map((a) => (
              <button key={a._id} type="button" className="tsp-art-thumb" onClick={() => setArtOpen(a)} aria-label={`Open artwork: ${a.title || "Untitled"}`}>
                <img src={a.imageUrl} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="tsp-section">
        <h3>Certificates <span className="tsp-count">{data.certs.length}</span></h3>
        {!data.loading && data.certs.length === 0 && <p className="tsp-empty">None yet.</p>}
        {data.certs.length > 0 && <ul className="tsp-list">{data.certs.slice(0, 4).map((c) => <li key={c._id}><strong>{c.title || "Certificate"}</strong><span>{c.dateIssued ? new Date(c.dateIssued).toLocaleDateString("en-GB") : ""}</span></li>)}</ul>}
      </section>

      {artOpen && (
        <TSheet title={artOpen.title || "Artwork"} subtitle={[artOpen.medium, artOpen.dateCreated && new Date(artOpen.dateCreated).toLocaleDateString("en-GB")].filter(Boolean).join(" · ")} onClose={() => setArtOpen(null)} dark={dark}>
          <img src={artOpen.imageUrl} alt={artOpen.title || "Artwork"} className="tsp-art-full" />
        </TSheet>
      )}
    </TSheet>
  );
};


// ---------- parent conversations (inbox) ----------
// Polls every minute, on focus, and when a push arrives (the service worker
// tells open tabs), so a new parent message shows up without a reload.
export const useTeacherThreads = (teacherId) => {
  const [threads, setThreads] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(() => {
    if (!teacherId) return;
    axios.get(`${API}/feedback/teacher/${teacherId}/threads`)
      .then((res) => { setThreads(Array.isArray(res.data) ? res.data : []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [teacherId]);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 60000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    const onSw = (e) => e.data?.type === "push-received" && refresh();
    if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", onSw);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      if ("serviceWorker" in navigator) navigator.serviceWorker.removeEventListener("message", onSw);
    };
  }, [refresh]);
  const markRead = useCallback((id) => {
    setThreads((list) => list.map((t) => (t._id === id ? { ...t, unread: false } : t)));
    axios.put(`${API}/feedback/${id}/read`, { as: "teacher", userId: teacherId }).catch(() => {});
  }, [teacherId]);
  const update = useCallback((next) => {
    setThreads((list) => list.map((t) => (t._id === next._id ? { ...t, ...next, messages: next.messages, unread: false } : t)));
  }, []);
  return { threads, loaded, unread: threads.filter((t) => t.unread).length, refresh, markRead, update };
};

const ago = (d) => {
  const mins = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} hr${h === 1 ? "" : "s"} ago`;
  const days = Math.round(h / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
};

export const TeacherInbox = ({ inbox, teacherId, openId }) => {
  const [openThread, setOpenThread] = useState(null);
  const { threads, loaded, markRead, update } = inbox;
  // a tapped push opens that exact conversation
  useEffect(() => {
    if (openId && threads.some((t) => t._id === openId)) {
      setOpenThread(openId);
      const t = threads.find((x) => x._id === openId);
      if (t?.unread) markRead(openId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, loaded]);

  const toggle = (t) => {
    const next = openThread === t._id ? null : t._id;
    setOpenThread(next);
    if (next && t.unread) markRead(t._id);
  };

  if (loaded && threads.length === 0) return null;
  return (
    <div className="ti-card" id="parent-messages">
      <h3>Parent messages {inbox.unread > 0 && <span className="ti-count">{inbox.unread} new</span>}</h3>
      {!loaded ? <div className="tsp-skel" aria-hidden="true" /> : (
        <ul className="ti-list">
          {threads.slice(0, 12).map((t) => {
            const last = t.messages[t.messages.length - 1];
            const isOpen = openThread === t._id;
            return (
              <li key={t._id} className={t.unread ? "unread" : ""}>
                <button type="button" className="ti-row" onClick={() => toggle(t)} aria-expanded={isOpen}>
                  <span className="ti-main">
                    <strong>{t.studentId?.childName || "Student"} <em>· {monthLabel(t.month)} report</em></strong>
                    <span className="ti-last">{last.from === "teacher" ? "You: " : ""}{String(last.text || "").slice(0, 90)}</span>
                  </span>
                  <span className="ti-meta">{ago(t.lastAt)}{t.unread && <i className="ti-dot" aria-label="New message" />}</span>
                </button>
                {isOpen && <TeacherReportThread report={t} teacherId={teacherId} onUpdated={update} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
