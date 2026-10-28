const mongoose = require('mongoose');

// "Artist Spotlight" — an admin-published poster celebrating a student's
// achievement (academy work, school or outside competitions). Publishing one
// sends a push notification to every role.
const SpotlightSchema = new mongoose.Schema({
  studentName: { type: String, required: true, trim: true },
  // Set when the name matches an academy student; optional so outside
  // achievements can still be spotlighted by name alone.
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  achievementTitle: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  posterUrl: { type: String, required: true }, // Cloudinary URL
  publishedBy: { type: String, default: '' },
  publishedAt: { type: Date, default: Date.now },
  pushSentCount: { type: Number, default: 0 },
});

module.exports = mongoose.model('Spotlight', SpotlightSchema);
