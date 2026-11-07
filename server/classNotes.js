// Class notes & homework: teacher writes after class, parents read (and get a push).
const express = require("express");
const mongoose = require("mongoose");
const ClassNote = require("./models/ClassNote");
const Class = require("./models/Class");
const User = require("./models/User");
const parentPush = require("./parentPush");

const router = express.Router();
const validId = (id) => mongoose.Types.ObjectId.isValid(id);
const istDateKey = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const clean = (s, max) => String(s || "").trim().slice(0, max);

// create or update today's (or a given day's) note for a class
router.post("/class-notes", async (req, res) => {
  try {
    const { classId, teacherId } = req.body || {};
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.date)) ? req.body.date : istDateKey();
    const text = clean(req.body?.text, 1500);
    const homework = clean(req.body?.homework, 600);
    if (!validId(classId) || !validId(teacherId)) return res.status(400).json({ message: "Missing class or teacher" });
    if (!text && !homework) return res.status(400).json({ message: "Write what you did in class or the homework" });
    if (date > istDateKey()) return res.status(400).json({ message: "Notes can't be written for a future date" });
    const cls = await Class.findById(classId).select("className teacher");
    if (!cls) return res.status(404).json({ message: "Class not found" });
    if (String(cls.teacher) !== String(teacherId)) return res.status(403).json({ message: "Only this class's teacher can post notes" });

    const existing = await ClassNote.findOne({ classId, date });
    const note = existing || new ClassNote({ classId, teacherId, date });
    note.text = text;
    note.homework = homework;
    note.teacherId = teacherId;
    await note.save();
    res.json({ note, created: !existing });

    if (!existing) {
      parentPush.later("Class note", async () => {
        const parents = await parentPush.classParents(classId);
        return parentPush.pushToUsers(parents, (u) => ({
          title: homework ? `📝 Homework from ${cls.className}` : `🎨 Today in ${cls.className}`,
          body: homework ? `${u.childName ? `For ${u.childName}: ` : ""}${homework.slice(0, 110)}` : text.slice(0, 120),
          tag: `note-${note._id}`,
          url: `${parentPush.APP_URL}/#overview`,
        }), { pref: "classNotes" });
      });
    }
  } catch (err) {
    console.error("Class note error:", err);
    if (!res.headersSent) res.status(500).json({ message: "Couldn't save the note" });
  }
});

router.get("/class-notes/class/:classId", async (req, res) => {
  try {
    if (!validId(req.params.classId)) return res.status(404).json({ message: "Not found" });
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    res.json(await ClassNote.find({ classId: req.params.classId }).sort({ date: -1 }).limit(limit).lean());
  } catch (err) {
    res.status(500).json({ message: "Error loading notes" });
  }
});

// a teacher's recent notes (to know which of today's classes already have one)
router.get("/class-notes/teacher/:teacherId", async (req, res) => {
  try {
    if (!validId(req.params.teacherId)) return res.status(404).json({ message: "Not found" });
    const since = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.since)) ? req.query.since : istDateKey();
    res.json(await ClassNote.find({ teacherId: req.params.teacherId, date: { $gte: since } }).sort({ date: -1 }).limit(100).lean());
  } catch (err) {
    res.status(500).json({ message: "Error loading notes" });
  }
});

// a student's class notes (parents)
router.get("/class-notes/student/:studentId", async (req, res) => {
  try {
    if (!validId(req.params.studentId)) return res.status(404).json({ message: "Not found" });
    const student = await User.findById(req.params.studentId).select("assignedClass role");
    if (!student || student.role !== "parent" || !student.assignedClass) return res.json([]);
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const notes = await ClassNote.find({ classId: student.assignedClass }).sort({ date: -1 }).limit(limit)
      .populate("teacherId", "fullName").populate("classId", "className").lean();
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: "Error loading notes" });
  }
});

router.delete("/class-notes/:id", async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ message: "Not found" });
    const note = await ClassNote.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Not found" });
    if (String(note.teacherId) !== String(req.body?.teacherId || req.query.teacherId)) return res.status(403).json({ message: "Not allowed" });
    await note.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Couldn't delete" });
  }
});

module.exports = router;
