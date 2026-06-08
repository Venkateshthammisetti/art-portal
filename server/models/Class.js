const mongoose = require('mongoose');

const ClassSchema = new mongoose.Schema({
  className: { type: String, required: true },
  level: { type: String, required: true },
  subLevel: { type: String, required: true }, // Can be empty string
  classMode: { type: String, enum: ['online', 'offline'], default: 'online' },
  
  // ✨ NEW: SLOT & LINK MANAGEMENT
  schedule: [{
    day: { type: String, required: true },
    time: { type: String, required: true },
    link: { type: String, default: "" }
  }],
  meetingLink: { type: String },
  maxCapacity: { type: Number, default: 10 }, // Default 10 students

  // Relationships
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Class', ClassSchema);