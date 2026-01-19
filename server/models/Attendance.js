const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
  date: { type: String, required: true }, 
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  
  // ✨ NEW: Direct link to student (No 'records' array)
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  status: { 
    type: String, 
    enum: ['Present', 'Absent', 'Missed'], 
    required: true 
  }
});

// ✨ NEW: This index allows multiple students in one class, 
// but prevents the SAME student being marked twice for the same class/date.
AttendanceSchema.index({ date: 1, studentId: 1, classId: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', AttendanceSchema);