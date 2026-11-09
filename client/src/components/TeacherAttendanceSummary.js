// Teacher › Attendance › Monthly Sheet: each student's attendance % for the
// month, a short summary above the sheet, and a CSV export of the whole sheet.
// % = Present ÷ classes marked for that student (Absent and Missed both count
// as not attended; unmarked days are left out).
import React from "react";
import { downloadCSV } from "../utils/csv";
import "./TeacherAttendanceSummary.css";

export const LOW_ATTENDANCE = 75;

// history: one "P" | "A" | "M" | null per day of the month
export const statsFor = (history = []) => {
  const p = history.filter((h) => h === "P").length;
  const a = history.filter((h) => h === "A").length;
  const m = history.filter((h) => h === "M").length;
  const marked = p + a + m;
  return { p, a, m, marked, pct: marked ? Math.round((p / marked) * 100) : null };
};

const monthName = (ym) => {
  const [y, mo] = String(ym).split("-").map(Number);
  return y && mo ? new Date(y, mo - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" }) : ym;
};
const firstName = (s) => String(s || "").trim().split(/\s+/)[0];

export const PctCell = ({ history }) => {
  const { pct } = statsFor(history);
  const low = pct !== null && pct < LOW_ATTENDANCE;
  return (
    <td className={`summary-col pct-val${low ? " low" : ""}`} title={low ? `Below ${LOW_ATTENDANCE}%` : undefined}>
      {pct === null ? "—" : <>{low && <span aria-hidden="true">⚠ </span>}{pct}%{low && <span className="sr-only"> (low)</span>}</>}
    </td>
  );
};

const MonthlyAttendanceSummary = ({ rows = [], days = [], month }) => {
  const stats = rows.map((r) => ({ row: r, ...statsFor(r.history) }));
  const markedStudents = stats.filter((s) => s.marked > 0);
  const totalP = markedStudents.reduce((n, s) => n + s.p, 0);
  const totalMarked = markedStudents.reduce((n, s) => n + s.marked, 0);
  const average = totalMarked ? Math.round((totalP / totalMarked) * 100) : null;
  const low = markedStudents.filter((s) => s.pct < LOW_ATTENDANCE).sort((x, y) => x.pct - y.pct);

  const exportCSV = () => {
    const header = ["Student", "Class", "Present", "Absent", "Missed", "Classes marked", "Attendance %", ...days.map((d) => d.fullDateStr)];
    const body = stats.map((s) => [
      s.row.childName || "",
      s.row.className || "",
      s.p, s.a, s.m, s.marked,
      s.pct === null ? "" : s.pct,
      ...days.map((_, i) => s.row.history?.[i] || ""),
    ]);
    downloadCSV(`attendance-${month}`, header, body);
  };

  if (!rows.length) return null;
  return (
    <div className="tas-bar">
      <div className="tas-stats">
        <p className="tas-avg">
          <strong>{average === null ? "—" : `${average}%`}</strong>
          <span>average for {monthName(month)}{markedStudents.length < rows.length ? ` · ${rows.length - markedStudents.length} not marked yet` : ""}</span>
        </p>
        {low.length > 0 ? (
          <p className="tas-low">
            <span aria-hidden="true">⚠</span> {low.length} below {LOW_ATTENDANCE}%: {low.slice(0, 4).map((s) => `${firstName(s.row.childName)} ${s.pct}%`).join(", ")}{low.length > 4 ? ` +${low.length - 4} more` : ""}
          </p>
        ) : markedStudents.length > 0 ? (
          <p className="tas-ok">Everyone is at {LOW_ATTENDANCE}% or above</p>
        ) : null}
      </div>
      <button type="button" className="tas-export" onClick={exportCSV}>Export CSV</button>
    </div>
  );
};

export default MonthlyAttendanceSummary;
