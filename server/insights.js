// Admin "Insights": how the academy is doing month by month.
//   GET /api/admin/insights?month=YYYY-MM&months=6
// - students: active, joined, left (went inactive), came back
// - fees: expected vs collected for that fee month (same rules as Fee Tracker:
//   not-yet-joined, inactive and pass months are left out)
// - attendance by class and by teacher, and each teacher's workload
//   (classes, students, reports written for the month)
const express = require("express");
const User = require("./models/User");
const Class = require("./models/Class");
const Attendance = require("./models/Attendance");
const Feedback = require("./models/Feedback");
const { getStudentStartMonth, isInactiveForMonth, getFeeForMonth } = require("./fees");

const istMonth = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 7);
const shift = (ym, n) => {
  const [y, m] = ym.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);

// "Joined" follows the joining date (as the Revenue screen's New Joins chart does)
const joinMonth = (u) => {
  const d = u.joiningDate || u.registeredDate || u.createdAt;
  return d ? (typeof d === "string" ? d : new Date(d).toISOString()).slice(0, 7) : null;
};
// Inactive that month: the inactive history, or switched off now without a history entry
const inactiveIn = (u, m, current) =>
  isInactiveForMonth(u, m) ||
  (u.isActive === false && m === current && !(u.inactiveHistory || []).some((e) => !e.inactiveTo));
const startedBy = (u, m) => getStudentStartMonth(u) <= m;

const studentMonth = (parents, m, current) => {
  let active = 0, joined = 0, left = 0, returned = 0, expected = 0, collected = 0, paidCount = 0, dueCount = 0, passes = 0;
  for (const u of parents) {
    if (joinMonth(u) === m) joined++;
    (u.inactiveHistory || []).forEach((e) => {
      if (e.inactiveFrom === m) left++;
      if (e.inactiveTo && shift(e.inactiveTo, 1) === m) returned++;
    });
    if (!startedBy(u, m) || inactiveIn(u, m, current)) continue;
    active++;
    if ((u.passes || []).some((p) => p.month === m)) { passes++; continue; }
    const fee = getFeeForMonth(u, m);
    const paid = (u.payments || []).find((p) => p.month === m && p.status === "Paid");
    dueCount++;
    expected += fee;
    if (paid) { paidCount++; collected += Number(paid.amount ?? fee) || 0; }
  }
  return { month: m, active, joined, left, returned, net: joined - left + returned, passes, expected, collected, paidCount, dueCount, collectionRate: pct(collected, expected) };
};

const computeInsights = async ({ month, months = 6 } = {}) => {
  const current = istMonth();
  const m = /^\d{4}-\d{2}$/.test(String(month)) ? month : current;
  const span = Math.min(12, Math.max(1, Number(months) || 6));
  const range = Array.from({ length: span }, (_, i) => shift(m, i - span + 1));

  const [parents, classes, teachers, attendance, reports] = await Promise.all([
    User.find({ role: "parent" })
      .select("childName registeredDate joiningDate createdAt isActive inactiveHistory payments passes monthlyFee feeChangeHistory feeOverrides assignedClass")
      .lean(),
    Class.find({}).select("className teacher students").lean(),
    User.find({ role: "teacher" }).select("fullName username isActive").lean(),
    Attendance.find({ date: { $gte: `${range[0]}-01`, $lte: `${m}-31` } }).select("date classId studentId status").lean(),
    Feedback.find({ month: m }).select("studentId teacherId").lean(),
  ]);

  const trend = range.map((ym) => {
    const row = studentMonth(parents, ym, current);
    const recs = attendance.filter((a) => a.date.startsWith(ym));
    row.attendanceRate = pct(recs.filter((a) => a.status === "Present").length, recs.length);
    return row;
  });

  // ----- attendance by class for the chosen month -----
  const byId = new Map(parents.map((p) => [String(p._id), p]));
  const teacherName = new Map(teachers.map((t) => [String(t._id), t.fullName || t.username || "Teacher"]));
  const monthRecs = attendance.filter((a) => a.date.startsWith(m));
  const activeInMonth = (id) => {
    const u = byId.get(String(id));
    return u && startedBy(u, m) && !inactiveIn(u, m, current);
  };
  // students per class: User.assignedClass is the source of truth
  const studentsOf = new Map();
  parents.forEach((p) => {
    if (!p.assignedClass) return;
    const k = String(p.assignedClass);
    if (!studentsOf.has(k)) studentsOf.set(k, []);
    studentsOf.get(k).push(p);
  });

  const classRows = classes.map((c) => {
    const recs = monthRecs.filter((a) => String(a.classId) === String(c._id));
    const present = recs.filter((a) => a.status === "Present").length;
    const students = (studentsOf.get(String(c._id)) || []).filter((p) => activeInMonth(p._id));
    return {
      classId: c._id,
      className: c.className,
      teacherId: c.teacher || null,
      teacher: c.teacher ? teacherName.get(String(c.teacher)) || "—" : "—",
      students: students.length,
      sessions: new Set(recs.map((a) => a.date)).size,
      marked: recs.length,
      present,
      absent: recs.length - present,
      attendanceRate: pct(present, recs.length),
    };
  }).sort((a, b) => (a.attendanceRate ?? 101) - (b.attendanceRate ?? 101) || a.className.localeCompare(b.className));

  // ----- teachers: workload and attendance for the chosen month -----
  const reportsBy = new Map();
  reports.forEach((r) => {
    const k = String(r.teacherId);
    if (!reportsBy.has(k)) reportsBy.set(k, new Set());
    reportsBy.get(k).add(String(r.studentId));
  });
  const teacherRows = teachers.filter((t) => t.isActive !== false || classRows.some((c) => String(c.teacherId) === String(t._id))).map((t) => {
    const mine = classRows.filter((c) => String(c.teacherId) === String(t._id));
    const studentIds = new Set(mine.flatMap((c) => (studentsOf.get(String(c.classId)) || []).filter((p) => activeInMonth(p._id)).map((p) => String(p._id))));
    const marked = mine.reduce((s, c) => s + c.marked, 0);
    const present = mine.reduce((s, c) => s + c.present, 0);
    const written = [...(reportsBy.get(String(t._id)) || [])].filter((id) => studentIds.has(id)).length;
    return {
      teacherId: t._id,
      teacher: t.fullName || t.username || "Teacher",
      classes: mine.length,
      students: studentIds.size,
      sessions: mine.reduce((s, c) => s + c.sessions, 0),
      attendanceRate: pct(present, marked),
      reportsWritten: written,
      reportsDue: studentIds.size,
    };
  }).sort((a, b) => b.students - a.students || a.teacher.localeCompare(b.teacher));

  const unassigned = parents.filter((p) => activeInMonth(p._id) && !p.assignedClass).length;
  return { month: m, months: range, current, trend, summary: trend[trend.length - 1], previous: trend[trend.length - 2] || null, classes: classRows, teachers: teacherRows, unassigned };
};

const router = express.Router();
router.get("/admin/insights", async (req, res) => {
  try {
    res.json(await computeInsights({ month: req.query.month, months: req.query.months }));
  } catch (err) {
    console.error("Insights error:", err);
    res.status(500).json({ message: "Couldn't load insights" });
  }
});

module.exports = { router, computeInsights };
