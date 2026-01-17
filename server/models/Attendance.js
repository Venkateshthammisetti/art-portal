const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
  date: { type: String, required: true }, // Format: "YYYY-MM-DD"
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  records: [{
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    studentName: String,
    status: { type: String, enum: ['Present', 'Absent'], default: 'Absent' }
  }]
});

// Ensure one record per class per day
AttendanceSchema.index({ date: 1, classId: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', AttendanceSchema);