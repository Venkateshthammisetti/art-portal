const mongoose = require('mongoose');

const FeedbackSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month: { type: String, required: true }, // Format: "YYYY-MM"
  feedbackText: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5 }, // Optional: 1-5 Star rating
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Feedback', FeedbackSchema);