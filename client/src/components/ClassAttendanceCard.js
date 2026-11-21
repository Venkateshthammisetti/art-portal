// Class progress for a month: classes held, target and balance for each class.
// Teacher home shows the teacher's own classes; Admin overview (at the bottom)
// shows all, with a teacher filter.
// The arrow on each class opens its students: attended / target, absent, missed, left.
// Data: GET /api/attendance/class-summary (server/classAttendance.js).
import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import "./ClassAttendanceCard.css";

const API = "https://art-portal-7n6r.onrender.com/api";
const istMonth = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 7);
const shift = (ym, n) => {
  const [y, m] = ym.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};
const label = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
};

// Stacked bar: segments [{ n, cls }] laid out of `max` (at least the sum, so it never overflows).
const StackBar = ({ segments, max, small, label: aria }) => {
  const total = segments.reduce((s, x) => s + x.n, 0);
  const scale = Math.max(max, total) || 1;
  return (
    <div className={`ca-track${small ? " ca-track-sm" : ""}`} role="img" aria-label={aria}>
      {segments.filter((x) => x.n > 0).map((x) => (
        <span key={x.cls} className={`ca-fill ${x.cls}`} style={{ width: `${Math.max(small ? 3 : 2, (x.n / scale) * 100)}%` }} />
      ))}
    </div>
  );
};

const ClassAttendanceCard = ({ teacherId = null, showTeacherFilter = false }) => {
  const [month, setMonth] = useState(istMonth());
  const [teacher, setTeacher] = useState("all");
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(() => new Set());
  const toggle = (id) => setOpen((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const thisMonth = istMonth();
  const forTeacher = teacherId || (teacher !== "all" ? teacher : "");

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    axios.get(`${API}/attendance/class-summary`, { params: { month, ...(forTeacher ? { teacherId: forTeacher } : {}) } })
      .then((r) => { if (Array.isArray(r.data?.classes)) setData(r.data); else setError(true); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [month, forTeacher]);
  useEffect(() => { load(); }, [load]);

  const classes = data?.classes || [];
  const teachers = data?.teachers || [];
  const totals = data?.totals;

  return (
    <section className="ca-card" aria-labelledby="ca-title">
      <div className="ca-head">
        <div className="ca-title">
          <h3 id="ca-title">Class progress</h3>
          {totals && totals.target > 0 && (
            <p>{totals.held} of {totals.target} classes held{totals.balance ? ` · ${totals.balance} to complete` : " · all complete"}</p>
          )}
        </div>
        <div className="ca-controls">
          {showTeacherFilter && (
            <label className="ca-filter">
              <span>Teacher</span>
              <select value={teacher} onChange={(e) => setTeacher(e.target.value)}>
                <option value="all">All teachers</option>
                {teachers.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                {teacher !== "all" && !teachers.some((t) => t._id === teacher) && <option value={teacher}>Selected teacher</option>}
              </select>
            </label>
          )}
          <div className="ca-month" role="group" aria-label="Month">
            <button type="button" onClick={() => setMonth((m) => shift(m, -1))} aria-label="Previous month">‹</button>
            <strong aria-live="polite">{label(month)}</strong>
            <button type="button" onClick={() => setMonth((m) => shift(m, 1))} disabled={month >= thisMonth} aria-label="Next month">›</button>
          </div>
        </div>
      </div>

      {error && !loading && (
        <p className="ca-msg ca-err">Couldn't load class progress. <button type="button" onClick={load}>Try again</button></p>
      )}
      {loading && !data && <div className="ca-skel" aria-label="Loading" />}
      {data && !error && classes.length === 0 && <p className="ca-msg">No classes yet.</p>}

      {data && classes.length > 0 && (
        <ul className={`ca-list${loading ? " is-loading" : ""}`}>
          {classes.map((c) => {
            const held = Number(c.held ?? c.sessions) || 0;
            const target = Number(c.target) || 0;
            const balance = Math.max(0, Number(c.balance ?? target - held) || 0);
            const done = target > 0 && balance === 0;
            // Split the held part of the bar by how the marks went (present / absent / missed).
            const marks = Number(c.marked) || 0;
            const cAbsent = Number(c.absent) || 0;
            const cMissed = Number(c.missed) || 0;
            const share = (n) => (marks > 0 ? (held * n) / marks : 0);
            const kids = Array.isArray(c.studentList) ? c.studentList : [];
            const isOpen = open.has(String(c.classId));
            const listId = `ca-kids-${c.classId}`;
            return (
              <li key={c.classId} className={`ca-row${isOpen ? " is-open" : ""}`}>
                <div className="ca-row-top">
                  <span className="ca-name">{c.className}{showTeacherFilter && c.teacher ? <small>{c.teacher}</small> : null}</span>
                  <span className="ca-val">
                    {held}/{target}
                    <button type="button" className="ca-expand" aria-expanded={isOpen} aria-controls={listId} onClick={() => toggle(String(c.classId))}
                      aria-label={`${isOpen ? "Hide" : "Show"} students in ${c.className}`} title={isOpen ? "Hide students" : "Show students"}>
                      <span aria-hidden="true">▾</span>
                    </button>
                  </span>
                </div>
                <StackBar
                  max={target}
                  label={`${c.className}: ${held} of ${target} classes held, ${cAbsent} absences`}
                  segments={marks > 0
                    ? [{ n: share(marks - cAbsent - cMissed), cls: done ? "good" : "ok" }, { n: share(cAbsent), cls: "absent" }, { n: share(cMissed), cls: "low" }]
                    : [{ n: held, cls: done ? "good" : "ok" }]}
                />
                <dl className="ca-nums">
                  <div><dt>Held</dt><dd>{held}</dd></div>
                  <div><dt>Target</dt><dd>{target}</dd></div>
                  {cAbsent > 0 && <div><dt>Absent</dt><dd className="absent">{cAbsent}</dd></div>}
                  {cMissed > 0 && <div><dt>Missed</dt><dd className="missed">{cMissed}</dd></div>}
                  <div><dt>Balance</dt><dd className={done ? "done" : ""}>{done ? "Done" : balance}</dd></div>
                </dl>
                {isOpen && (
                  <div id={listId} className="ca-kids">
                    {kids.length === 0 ? <p className="ca-msg">No active students in this class.</p> : (
                      <ul>
                        {kids.map((k) => {
                          const kt = Number(k.target) || 0;
                          const att = Number(k.attended) || 0;
                          // Balance = target - (attended + absent); worked out here so an older server's figure is ignored.
                          const left = Math.max(0, kt - att - (Number(k.absent) || 0));
                          const kDone = kt > 0 && left === 0;
                          return (
                            <li key={k._id} className="ca-kid">
                              <div className="ca-kid-top">
                                <span className="ca-kid-name">{k.name}</span>
                                <span className="ca-kid-val">{att}/{kt}</span>
                              </div>
                              <StackBar
                                small
                                max={kt}
                                label={`${k.name}: attended ${att}, absent ${Number(k.absent) || 0}, missed ${Number(k.missed) || 0}, target ${kt}`}
                                segments={[
                                  { n: att, cls: kDone ? "good" : "ok" },
                                  { n: Number(k.absent) || 0, cls: "absent" },
                                  { n: Number(k.missed) || 0, cls: "low" },
                                ]}
                              />
                              <div className="ca-kid-meta">
                                <span>Attended <b>{att}</b></span>
                                {Number(k.absent) > 0 && <span className="absent">Absent <b>{k.absent}</b></span>}
                                {Number(k.missed) > 0 && <span className="missed">Missed <b>{k.missed}</b></span>}
                                <span className={kDone ? "done" : ""}>{kDone ? "Done" : <>Balance <b>{left}</b></>}</span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default ClassAttendanceCard;
