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
            const width = target > 0 ? Math.min(100, (held / target) * 100) : 0;
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
                <div className="ca-track" role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.min(held, target)} aria-label={`${c.className}: ${held} of ${target} classes held`}>
                  {held > 0 && <span className={`ca-fill ${done ? "good" : "ok"}`} style={{ width: `${Math.max(2, width)}%` }} />}
                </div>
                <dl className="ca-nums">
                  <div><dt>Held</dt><dd>{held}</dd></div>
                  <div><dt>Target</dt><dd>{target}</dd></div>
                  <div><dt>Balance</dt><dd className={done ? "done" : ""}>{done ? "Done" : balance}</dd></div>
                </dl>
                {isOpen && (
                  <div id={listId} className="ca-kids">
                    {kids.length === 0 ? <p className="ca-msg">No active students in this class.</p> : (
                      <ul>
                        {kids.map((k) => {
                          const kt = Number(k.target) || 0;
                          const att = Number(k.attended) || 0;
                          const left = Math.max(0, Number(k.balance ?? kt - att) || 0);
                          const kDone = kt > 0 && left === 0;
                          return (
                            <li key={k._id} className="ca-kid">
                              <div className="ca-kid-top">
                                <span className="ca-kid-name">{k.name}</span>
                                <span className="ca-kid-val">{att}/{kt}</span>
                              </div>
                              <div className="ca-track ca-track-sm" role="progressbar" aria-valuemin={0} aria-valuemax={kt} aria-valuenow={Math.min(att, kt)} aria-label={`${k.name}: attended ${att} of ${kt}`}>
                                {att > 0 && <span className={`ca-fill ${kDone ? "good" : "ok"}`} style={{ width: `${Math.max(3, kt ? Math.min(100, (att / kt) * 100) : 0)}%` }} />}
                              </div>
                              <div className="ca-kid-meta">
                                <span>Attended <b>{att}</b></span>
                                {Number(k.absent) > 0 && <span>Absent <b>{k.absent}</b></span>}
                                {Number(k.missed) > 0 && <span>Missed <b>{k.missed}</b></span>}
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
