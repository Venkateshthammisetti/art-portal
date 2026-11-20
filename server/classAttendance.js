// Attendance progress per class for one month (Teacher home + Admin overview):
//   GET /api/attendance/class-summary?month=YYYY-MM&teacherId=<id>
// rate = Present ÷ all marked (Absent and Missed count as not attended).
const express = require("express");
const mongoose = require("mongoose");
const Class = require("./models/Class");
const User = require("./models/User");
const Attendance = require("./models/Attendance");

const istMonth = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 7);
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);

const classSummary = async ({ month, teacherId } = {}) => {
  const m = /^\d{4}-\d{2}$/.test(String(month)) ? month : istMonth();
  const filter = teacherId && mongoose.Types.ObjectId.isValid(teacherId) ? { teacher: teacherId } : {};
  const classes = await Class.find(filter).populate("teacher", "fullName username").lean();
  const ids = classes.map((c) => c._id);
  const [recs, students] = await Promise.all([
    Attendance.find({ classId: { $in: ids }, date: { $gte: `${m}-01`, $lte: `${m}-31` } }).select("classId date status").lean(),
    User.find({ role: "parent", isActive: { $ne: false }, assignedClass: { $in: ids } }).select("assignedClass").lean(),
  ]);
  const rows = classes.map((c) => {
    const mine = recs.filter((r) => String(r.classId) === String(c._id));
    const present = mine.filter((r) => r.status === "Present").length;
    const absent = mine.filter((r) => r.status === "Absent").length;
    return {
      classId: c._id,
      className: c.className,
      level: c.level || "",
      teacherId: c.teacher?._id || c.teacher || null,
      teacher: c.teacher?.fullName || c.teacher?.username || "",
      students: students.filter((s) => String(s.assignedClass) === String(c._id)).length,
      sessions: new Set(mine.map((r) => r.date)).size,
      marked: mine.length,
      present,
      absent,
      missed: mine.length - present - absent,
      rate: pct(present, mine.length),
    };
  }).sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101) || a.className.localeCompare(b.className));
  const marked = rows.reduce((s, r) => s + r.marked, 0);
  const present = rows.reduce((s, r) => s + r.present, 0);
  const teachers = [];
  classes.forEach((c) => {
    const id = String(c.teacher?._id || c.teacher || "");
    if (id && !teachers.some((t) => t._id === id)) teachers.push({ _id: id, name: c.teacher?.fullName || c.teacher?.username || "Teacher" });
  });
  teachers.sort((a, b) => a.name.localeCompare(b.name));
  return { month: m, overall: pct(present, marked), classes: rows, teachers };
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
