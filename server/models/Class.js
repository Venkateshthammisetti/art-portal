const mongoose = require('mongoose');

const ClassSchema = new mongoose.Schema({
  className: { type: String, required: true },
  level: { type: String, required: true }, // e.g., Beginner, Intermediate
  subLevel: { type: String, required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Link to Teacher User
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // List of Students
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Class', ClassSchema);