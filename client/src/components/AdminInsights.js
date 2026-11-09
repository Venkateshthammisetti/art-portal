// Admin › Insights: how the academy is doing this month and over the last six.
// Data: GET /api/admin/insights (server/insights.js). Fee figures follow the
// Fee Tracker's rules; the Revenue screen has the rupee detail.
import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { downloadCSV } from "../utils/csv";
import "./AdminInsights.css";

const API = "https://art-portal-7n6r.onrender.com/api";
const LOW_ATTENDANCE = 75; // % below which a class is flagged

const istMonth = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 7);
const shift = (ym, n) => {
  const [y, m] = ym.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};
const label = (ym, opts = { month: "long", year: "numeric" }) => {
  const [y, m] = String(ym).split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", opts);
};
const short = (ym) => label(ym, { month: "short" });
const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const pc = (v) => (v === null || v === undefined ? "—" : `${Math.round(v)}%`);
const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

// ---------- small charts (HTML columns; one hue; tooltip on hover/focus) ----------
const RateChart = ({ title, points, unit = "%" }) => {
  const [tip, setTip] = useState(null);
  const last = points.length - 1;
  return (
    <figure className="ins-chart">
      <figcaption>{title}</figcaption>
      <div className="ins-plot" onMouseLeave={() => setTip(null)}>
        <div className="ins-grid" aria-hidden="true"><span data-v="100" /><span data-v="50" /></div>
        <div className="ins-cols">
          {points.map((p, i) => (
            <button
              key={p.key}
              type="button"
              className="ins-col"
              aria-label={`${label(p.key)}: ${p.value === null ? "no data" : `${Math.round(p.value)}${unit}`}${p.detail ? `, ${p.detail}` : ""}`}
              onMouseEnter={() => setTip(i)}
              onFocus={() => setTip(i)}
              onBlur={() => setTip(null)}
            >
              <span className="ins-col-track">
                {p.value !== null && <span className="ins-col-bar" style={{ height: `${Math.max(2, Math.min(100, p.value))}%` }} />}
                {i === last && p.value !== null && <span className="ins-col-val" style={{ bottom: `${Math.min(100, p.value)}%` }}>{Math.round(p.value)}{unit}</span>}
              </span>
              <span className="ins-col-x">{short(p.key)}</span>
              {tip === i && (
                <span className="ins-tip" role="presentation">
                  <strong>{label(p.key)}</strong>
                  <span>{p.value === null ? "No data" : `${Math.round(p.value)}${unit}`}</span>
                  {p.detail && <span>{p.detail}</span>}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </figure>
  );
};

// Joined above the line, left below it (two series: legend + tooltip)
const InOutChart = ({ points }) => {
  const [tip, setTip] = useState(null);
  const max = Math.max(1, ...points.map((p) => Math.max(p.in, p.out)));
  return (
    <figure className="ins-chart">
      <figcaption>
        Joined vs left
        <span className="ins-legend">
          <span><i className="sw-in" />Joined</span>
          <span><i className="sw-out" />Left</span>
        </span>
      </figcaption>
      <div className="ins-plot io" onMouseLeave={() => setTip(null)}>
        <div className="ins-cols">
          {points.map((p, i) => (
            <button
              key={p.key}
              type="button"
              className="ins-col"
              aria-label={`${label(p.key)}: ${p.in} joined, ${p.out} left${p.back ? `, ${p.back} came back` : ""}`}
              onMouseEnter={() => setTip(i)}
              onFocus={() => setTip(i)}
              onBlur={() => setTip(null)}
            >
              <span className="io-half up">{p.in > 0 && <span className="ins-col-bar in" style={{ height: `${(p.in / max) * 100}%` }} />}</span>
              <span className="io-axis" aria-hidden="true" />
              <span className="io-half down">{p.out > 0 && <span className="ins-col-bar out" style={{ height: `${(p.out / max) * 100}%` }} />}</span>
              <span className="ins-col-x">{short(p.key)}</span>
              {tip === i && (
                <span className="ins-tip" role="presentation">
                  <strong>{label(p.key)}</strong>
                  <span>{p.in} joined · {p.out} left</span>
                  {p.back > 0 && <span>{p.back} came back</span>}
                  <span>Net {signed(p.in - p.out + p.back)}</span>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </figure>
  );
};

const Tile = ({ title, value, sub, delta, meter }) => (
  <div className="ins-tile">
    <p className="ins-tile-title">{title}</p>
    <p className="ins-tile-value">{value}</p>
    {meter !== undefined && meter !== null && (
      <span className="ins-meter" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, meter))}%` }} /></span>
    )}
    {sub && <p className="ins-tile-sub">{sub}</p>}
    {delta && <p className={`ins-delta ${delta.dir}`}>{delta.text}</p>}
  </div>
);

const deltaOf = (now, before, prevLabel, unit = "") => {
  if (now === null || now === undefined || before === null || before === undefined) return null;
  const d = Math.round((now - before) * 10) / 10;
  if (!d) return { dir: "flat", text: `Same as ${prevLabel}` };
  return { dir: d > 0 ? "up" : "down", text: `${d > 0 ? "▲" : "▼"} ${Math.abs(Math.round(d))}${unit} vs ${prevLabel}` };
};

const AdminInsights = ({ onOpenRevenue }) => {
  const [month, setMonth] = useState(istMonth());
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    axios.get(`${API}/admin/insights?month=${month}&months=6`)
      .then((r) => { if (r.data && Array.isArray(r.data.trend) && r.data.trend.length) setData(r.data); else setError(true); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [month]);
  useEffect(() => { load(); }, [load]);

  const thisMonth = istMonth();
  const s = data?.summary;
  const prev = data?.previous;
  const prevLabel = data ? `${short(shift(data.month, -1))}${data.month === thisMonth ? " (month not over)" : ""}` : "";
  const classes = data?.classes || [];
  const teachers = data?.teachers || [];
  const marked = classes.filter((c) => c.marked > 0);
  const unmarked = classes.filter((c) => !c.marked);

  const exportMonths = () => downloadCSV(`insights-${data.month}-months`,
    ["Month", "Active", "Joined", "Left", "Came back", "Net", "On pass", "Fees expected", "Fees collected", "Paid", "Due", "Collection %", "Attendance %"],
    data.trend.map((r) => [label(r.month), r.active, r.joined, r.left, r.returned, r.net, r.passes, r.expected, r.collected, r.paidCount, r.dueCount, r.collectionRate ?? "", r.attendanceRate ?? ""]));
  const exportClasses = () => downloadCSV(`attendance-by-class-${data.month}`,
    ["Class", "Teacher", "Students", "Sessions", "Present", "Absent", "Attendance %"],
    classes.map((c) => [c.className, c.teacher, c.students, c.sessions, c.present, c.absent, c.attendanceRate ?? ""]));
  const exportTeachers = () => downloadCSV(`teachers-${data.month}`,
    ["Teacher", "Classes", "Students", "Sessions", "Attendance %", "Reports written", "Reports due"],
    teachers.map((t) => [t.teacher, t.classes, t.students, t.sessions, t.attendanceRate ?? "", t.reportsWritten, t.reportsDue]));

  return (
    <div className="ins-root">
      <div className="ins-top">
        <div className="ins-month" role="group" aria-label="Month">
          <button type="button" onClick={() => setMonth((m) => shift(m, -1))} aria-label="Previous month">‹</button>
          <strong aria-live="polite">{label(month)}</strong>
          <button type="button" onClick={() => setMonth((m) => shift(m, 1))} disabled={month >= thisMonth} aria-label="Next month">›</button>
        </div>
        {onOpenRevenue && <button type="button" className="ins-link" onClick={onOpenRevenue}>Revenue details →</button>}
      </div>

      {error && !data && (
        <div className="ins-card ins-error" role="alert">
          Couldn't load insights. <button type="button" onClick={load}>Try again</button>
        </div>
      )}
      {loading && !data && !error && <div className="ins-card ins-skel" aria-label="Loading" />}

      {data && s && (
        <div className={loading ? "ins-body is-loading" : "ins-body"}>
          <div className="ins-tiles">
            <Tile title="Active students" value={s.active} delta={deltaOf(s.active, prev?.active, prevLabel)}
              sub={`${s.passes ? `${s.passes} on a pass · ` : ""}${data.unassigned ? `${data.unassigned} without a class` : "all in a class"}`} />
            <Tile title="Joined / left" value={<>{signed(s.joined)} <span className="ins-slash">/</span> {s.left ? `−${s.left}` : "0"}</>}
              sub={`Net ${signed(s.net)}${s.returned ? ` · ${s.returned} came back` : ""}`} />
            <Tile title="Fees collected" value={pc(s.collectionRate)} meter={s.collectionRate}
              sub={`${inr(s.collected)} of ${inr(s.expected)} · ${s.paidCount} of ${s.dueCount} paid`}
              delta={deltaOf(s.collectionRate, prev?.collectionRate, prevLabel, " pts")} />
            <Tile title="Attendance" value={pc(s.attendanceRate)} meter={s.attendanceRate}
              sub={s.attendanceRate === null ? "Nothing marked yet" : "Present out of all marked"}
              delta={deltaOf(s.attendanceRate, prev?.attendanceRate, prevLabel, " pts")} />
          </div>

          <section className="ins-card">
            <div className="ins-card-head">
              <h3>Last 6 months</h3>
              <button type="button" className="ins-csv" onClick={exportMonths}>Export CSV</button>
            </div>
            <div className="ins-charts">
              <RateChart title="Fees collected" points={data.trend.map((r) => ({ key: r.month, value: r.collectionRate, detail: `${inr(r.collected)} of ${inr(r.expected)}` }))} />
              <RateChart title="Attendance" points={data.trend.map((r) => ({ key: r.month, value: r.attendanceRate }))} />
              <InOutChart points={data.trend.map((r) => ({ key: r.month, in: r.joined, out: r.left, back: r.returned }))} />
            </div>
            <details className="ins-table-toggle">
              <summary>Show as a table</summary>
              <div className="ins-table-wrap">
                <table className="ins-table">
                  <thead><tr><th scope="col">Month</th><th scope="col">Active</th><th scope="col">Joined</th><th scope="col">Left</th><th scope="col">Fees</th><th scope="col">Collected</th><th scope="col">Attendance</th></tr></thead>
                  <tbody>
                    {[...data.trend].reverse().map((r) => (
                      <tr key={r.month}>
                        <th scope="row">{label(r.month, { month: "short", year: "numeric" })}</th>
                        <td>{r.active}</td><td>{r.joined}</td><td>{r.left}</td>
                        <td>{inr(r.collected)} / {inr(r.expected)}</td><td>{pc(r.collectionRate)}</td><td>{pc(r.attendanceRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>

          <section className="ins-card">
            <div className="ins-card-head">
              <h3>Attendance by class <span>{label(data.month, { month: "short" })} · lowest first</span></h3>
              {classes.length > 0 && <button type="button" className="ins-csv" onClick={exportClasses}>Export CSV</button>}
            </div>
            {marked.length === 0 ? (
              <p className="ins-empty">No attendance marked for {label(data.month)}.</p>
            ) : (
              <ul className="ins-bars">
                {marked.map((c) => {
                  const low = c.attendanceRate !== null && c.attendanceRate < LOW_ATTENDANCE;
                  return (
                    <li key={c.classId}>
                      <div className="ins-bar-label">
                        <strong>{c.className}</strong>
                        <span>{c.teacher} · {c.sessions} {c.sessions === 1 ? "session" : "sessions"} · {c.students} {c.students === 1 ? "student" : "students"}</span>
                      </div>
                      <div className="ins-bar-row">
                        <span className="ins-hbar-track" aria-hidden="true"><span className="ins-hbar" style={{ width: `${Math.max(1, c.attendanceRate)}%` }} /></span>
                        <span className="ins-bar-val">{pc(c.attendanceRate)}</span>
                        <span className="ins-flag-slot">{low && <span className="ins-flag"><span aria-hidden="true">⚠</span> Low</span>}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {unmarked.length > 0 && marked.length > 0 && (
              <p className="ins-note">No attendance marked: {unmarked.map((c) => c.className).join(", ")}</p>
            )}
          </section>

          <section className="ins-card">
            <div className="ins-card-head">
              <h3>Teachers <span>{label(data.month, { month: "short" })}</span></h3>
              {teachers.length > 0 && <button type="button" className="ins-csv" onClick={exportTeachers}>Export CSV</button>}
            </div>
            {teachers.length === 0 ? (
              <p className="ins-empty">No teachers yet.</p>
            ) : (
              <div className="ins-table-wrap">
                <table className="ins-table ins-teachers">
                  <thead>
                    <tr><th scope="col">Teacher</th><th scope="col">Classes</th><th scope="col">Students</th><th scope="col">Sessions</th><th scope="col">Attendance</th><th scope="col">{label(data.month, { month: "short" })} reports</th></tr>
                  </thead>
                  <tbody>
                    {teachers.map((t) => (
                      <tr key={t.teacherId}>
                        <th scope="row">{t.teacher}</th>
                        <td data-label="Classes">{t.classes}</td>
                        <td data-label="Students">{t.students}</td>
                        <td data-label="Sessions">{t.sessions}</td>
                        <td data-label="Attendance">{pc(t.attendanceRate)}</td>
                        <td data-label="Reports">
                          <span className="ins-rep">
                            {t.reportsWritten} of {t.reportsDue}
                            {t.reportsDue > 0 && <span className="ins-meter sm" aria-hidden="true"><span style={{ width: `${(t.reportsWritten / t.reportsDue) * 100}%` }} /></span>}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="ins-note">Reports are written for the month before (October's in November), so the current month fills up next month.</p>
          </section>
        </div>
      )}
    </div>
  );
};

export default AdminInsights;
