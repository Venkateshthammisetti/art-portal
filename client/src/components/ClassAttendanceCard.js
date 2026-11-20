// Attendance progress for each class in a month. Teacher home shows the
// teacher's own classes; Admin overview shows all, with a teacher filter.
// Data: GET /api/attendance/class-summary (server/classAttendance.js).
import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import "./ClassAttendanceCard.css";

const API = "https://art-portal-7n6r.onrender.com/api";
const LOW = 75;
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
const band = (rate) => (rate === null ? "none" : rate >= 85 ? "good" : rate >= LOW ? "ok" : "low");

const ClassAttendanceCard = ({ teacherId = null, showTeacherFilter = false, onOpenClass }) => {
  const [month, setMonth] = useState(istMonth());
  const [teacher, setTeacher] = useState("all");
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
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
  const low = classes.filter((c) => c.rate !== null && c.rate < LOW).length;

  return (
    <section className="ca-card" aria-labelledby="ca-title">
      <div className="ca-head">
        <div className="ca-title">
          <h3 id="ca-title">Class attendance</h3>
          {data && data.overall !== null && (
            <p>{Math.round(data.overall)}% overall{low ? ` · ${low} ${low === 1 ? "class" : "classes"} below ${LOW}%` : ""}</p>
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
        <p className="ca-msg ca-err">Couldn't load class attendance. <button type="button" onClick={load}>Try again</button></p>
      )}
      {loading && !data && <div className="ca-skel" aria-label="Loading" />}
      {data && !error && classes.length === 0 && <p className="ca-msg">No classes yet.</p>}

      {data && classes.length > 0 && (
        <ul className={`ca-list${loading ? " is-loading" : ""}`}>
          {classes.map((c) => {
            const b = band(c.rate);
            const inner = (
              <>
                <div className="ca-row-top">
                  <span className="ca-name">{c.className}</span>
                  <span className="ca-val">
                    {c.rate === null ? "Not marked" : `${Math.round(c.rate)}%`}
                    {b === "low" && <em className="ca-flag"><span aria-hidden="true">⚠</span> Low</em>}
                  </span>
                </div>
                <div
                  className="ca-track"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={c.rate === null ? 0 : Math.round(c.rate)}
                  aria-label={`${c.className} attendance`}
                >
                  {c.rate !== null && <span className={`ca-fill ${b}`} style={{ width: `${Math.max(2, c.rate)}%` }} />}
                </div>
                <div className="ca-meta">
                  {showTeacherFilter && c.teacher && <span>{c.teacher}</span>}
                  <span>{c.students} {c.students === 1 ? "student" : "students"}</span>
                  <span>{c.sessions} {c.sessions === 1 ? "session" : "sessions"}</span>
                  {c.marked > 0 && <span>{c.present} present · {c.absent + c.missed} missed</span>}
                </div>
              </>
            );
            return (
              <li key={c.classId}>
                {onOpenClass ? <button type="button" className="ca-row" onClick={() => onOpenClass(c)}>{inner}</button> : <div className="ca-row">{inner}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default ClassAttendanceCard;
