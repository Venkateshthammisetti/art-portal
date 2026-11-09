// Daily counts from the watch-only access check (server/authWatch.js): requests
// the planned rules would have refused. Rows older than 35 days are removed.
const mongoose = require("mongoose");

const authWatchSchema = new mongoose.Schema({
  day: { type: String, required: true }, // "YYYY-MM-DD" (IST)
  method: { type: String, required: true },
  route: { type: String, required: true }, // e.g. "/api/users/:id"; "*" for the daily total
  reason: { type: String, required: true }, // no-token | bad-token | wrong-role | not-own | no-rule | checked
  role: { type: String, default: "-" },
  count: { type: Number, default: 0 },
  lastAt: { type: Date, default: Date.now, expires: 35 * 24 * 60 * 60 },
  lastUser: { type: String, default: "" },
});
authWatchSchema.index({ day: 1, method: 1, route: 1, reason: 1, role: 1 }, { unique: true });

module.exports = mongoose.model("AuthWatch", authWatchSchema);
