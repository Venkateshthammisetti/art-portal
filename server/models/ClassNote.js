// What happened in a class on a date, and any homework — written by the
// teacher after class, shown to the class's parents. One note per class per day.
const mongoose = require("mongoose");

const ClassNoteSchema = new mongoose.Schema({
  classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: String, required: true }, // "YYYY-MM-DD" (India date)
  text: { type: String, default: "" },
  homework: { type: String, default: "" },
}, { timestamps: true });

ClassNoteSchema.index({ classId: 1, date: -1 }, { unique: true });
ClassNoteSchema.index({ teacherId: 1, date: -1 });

module.exports = mongoose.model("ClassNote", ClassNoteSchema);
