// "I'm aware" for the missed-classes check-in lists (Teacher home, Admin
// Needs attention). The mark covers the current run of absences only.
const express = require("express");
const mongoose = require("mongoose");
const User = require("./models/User");
const { absenceStreaks } = require("./attention");

const router = express.Router();
const validId = (id) => mongoose.Types.ObjectId.isValid(id);

router.post("/checkins/:studentId", async (req, res) => {
  try {
    const { by, note = "" } = req.body || {};
    if (!validId(req.params.studentId) || !validId(by)) return res.status(400).json({ message: "Missing student or user" });
    const [student, viewer] = await Promise.all([User.findById(req.params.studentId), User.findById(by).select("role")]);
    if (!student || student.role !== "parent") return res.status(404).json({ message: "Student not found" });
    if (!viewer || !["teacher", "admin"].includes(viewer.role)) return res.status(403).json({ message: "Not allowed" });
    const streak = (await absenceStreaks([student._id])).get(String(student._id));
    if (!streak) return res.status(409).json({ message: "This student is no longer missing classes" });
    // one mark per person (teachers) or one shared mark for the admin team
    student.checkInAcks = (student.checkInAcks || []).filter((a) =>
      viewer.role === "admin" ? a.role !== "admin" : String(a.by) !== String(by));
    student.checkInAcks.push({ by, role: viewer.role, streakStart: streak.streakStart, note: String(note).trim().slice(0, 140), at: new Date() });
    if (student.checkInAcks.length > 20) student.checkInAcks = student.checkInAcks.slice(-20);
    await student.save();
    res.json({ ok: true, streakStart: streak.streakStart });
  } catch (err) {
    console.error("Check-in ack error:", err);
    res.status(500).json({ message: "Couldn't save" });
  }
});

// undo
router.delete("/checkins/:studentId", async (req, res) => {
  try {
    const by = req.query.by || req.body?.by;
    if (!validId(req.params.studentId) || !validId(by)) return res.status(400).json({ message: "Missing student or user" });
    const [student, viewer] = await Promise.all([User.findById(req.params.studentId), User.findById(by).select("role")]);
    if (!student || !viewer) return res.status(404).json({ message: "Not found" });
    student.checkInAcks = (student.checkInAcks || []).filter((a) =>
      viewer.role === "admin" ? a.role !== "admin" : String(a.by) !== String(by));
    await student.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Couldn't undo" });
  }
});

module.exports = router;
