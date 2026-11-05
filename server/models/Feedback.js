const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month: { type: String, required: true }, // Format: "YYYY-MM"
  feedbackText: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  reportFile: { type: String }, // Path to PDF
  
  // ✨ NEW FIELD: This is required to save the parent's comment
  parentComment: { type: String, default: "" }, 

  // Conversation about this report between the parent and the teacher
  messages: [{
    from: { type: String, enum: ['parent', 'teacher'] },
    name: { type: String, default: '' },
    text: String,
    at: { type: Date, default: Date.now }
  }],
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Feedback', feedbackSchema);