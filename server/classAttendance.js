// Class progress for one month (Teacher home + Admin overview):
//   GET /api/attendance/class-summary?month=YYYY-MM&teacherId=<id>
// held    = days attendance was marked for the class that month
// target  = the class's "Classes / Month" (the most common target among its
//           active students, 8 when none is set)
// balance = classes still to complete (target - held, never below 0)
const express = require("express");
const mongoose = require("mongoose");
const Class = require("./models/Class");
const User = require("./models/User");
const Attendance = require("./models/Attendance");

const istMonth = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 7);
const DEFAULT_TARGET = 8;
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);

const classSummary = async ({ month, teacherId } = {}) => {
  const m = /^\d{4}-\d{2}$/.test(String(month)) ? month : istMonth();
  const filter = teacherId && mongoose.Types.ObjectId.isValid(teacherId) ? { teacher: teacherId } : {};
  const classes = await Class.find(filter).populate("teacher", "fullName username").lean();
  const ids = classes.map((c) => c._id);
  const [recs, students] = await Promise.all([
    Attendance.find({ classId: { $in: ids }, date: { $gte: `${m}-01`, $lte: `${m}-31` } }).select("classId date status").lean(),
    User.find({ role: "parent", isActive: { $ne: false }, assignedClass: { $in: ids } }).select("assignedClass monthlyClassesTarget").lean(),
  ]);
  const targetOf = (kids) => {
    const counts = new Map();
    kids.forEach((k) => { const n = Number(k.monthlyClassesTarget) || 0; if (n > 0) counts.set(n, (counts.get(n) || 0) + 1); });
    if (!counts.size) return DEFAULT_TARGET;
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
  };
  const rows = classes.map((c) => {
    const mine = recs.filter((r) => String(r.classId) === String(c._id));
    const kids = students.filter((s) => String(s.assignedClass) === String(c._id));
    const held = new Set(mine.map((r) => r.date)).size;
    const target = targetOf(kids);
    const present = mine.filter((r) => r.status === "Present").length;
    const absent = mine.filter((r) => r.status === "Absent").length;
    return {
      classId: c._id,
      className: c.className,
      level: c.level || "",
      teacherId: c.teacher?._id || c.teacher || null,
      teacher: c.teacher?.fullName || c.teacher?.username || "",
      students: kids.length,
      sessions: held,
      held,
      target,
      balance: Math.max(0, target - held),
      marked: mine.length,
      present,
      absent,
      missed: mine.length - present - absent,
      rate: pct(present, mine.length),
    };
  }).sort((a, b) => b.balance - a.balance || a.held / a.target - b.held / b.target || a.className.localeCompare(b.className));
  const marked = rows.reduce((s, r) => s + r.marked, 0);
  const present = rows.reduce((s, r) => s + r.present, 0);
  const teachers = [];
  classes.forEach((c) => {
    const id = String(c.teacher?._id || c.teacher || "");
    if (id && !teachers.some((t) => t._id === id)) teachers.push({ _id: id, name: c.teacher?.fullName || c.teacher?.username || "Teacher" });
  });
  teachers.sort((a, b) => a.name.localeCompare(b.name));
  const totals = { held: rows.reduce((s, r) => s + r.held, 0), target: rows.reduce((s, r) => s + r.target, 0), balance: rows.reduce((s, r) => s + r.balance, 0) };
  return { month: m, overall: pct(present, marked), totals, classes: rows, teachers };
};

const router = express.Router();
router.get("/attendance/class-summary", async (req, res) => {
  try {
    res.json(await classSummary({ month: req.query.month, teacherId: req.query.teacherId }));
  } catch (err) {
    console.error("Class attendance summary error:", err);
    res.status(500).json({ message: "Couldn't load class attendance" });
  }
});

module.exports = { router, classSummary };
