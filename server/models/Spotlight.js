const mongoose = require('mongoose');

// Admin-published poster: an Artist Spotlight (a student's achievement), a
// festival greeting, or an important announcement. Publishing one sends a push
// notification to every role; parents and teachers can react to it.
// (Collection name kept as "spotlights" so existing posters carry over.)
const CATEGORIES = ['artist_spotlight', 'festival_greeting', 'announcement'];
const REACTIONS = ['❤️', '👏', '🎉', '🌟', '😍'];

const SpotlightSchema = new mongoose.Schema({
  category: { type: String, enum: CATEGORIES, default: 'artist_spotlight' },
  // Artist Spotlight only — the student being celebrated.
  studentName: { type: String, trim: true, default: '' },
  // Set when the name matches an academy student; optional so outside
  // achievements can still be spotlighted by name alone.
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  // Headline for every category: the achievement, the greeting, or the announcement.
  achievementTitle: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  posterUrl: { type: String, required: true }, // Cloudinary URL
  publishedBy: { type: String, default: '' },
  publishedAt: { type: Date, default: Date.now },
  pushSentCount: { type: Number, default: 0 },
  // One reaction per parent/teacher; reacting again changes or removes it.
  reactions: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, default: '' },
    role: { type: String, default: '' },
    emoji: { type: String, enum: REACTIONS, required: true },
    reactedAt: { type: Date, default: Date.now },
  }],
});

module.exports = mongoose.model('Spotlight', SpotlightSchema);
module.exports.CATEGORIES = CATEGORIES;
module.exports.REACTIONS = REACTIONS;
