// "Forgot password" requests from the login screen, shown in the Admin
// notification bell until an admin resets the password or marks it done.
const mongoose = require("mongoose");

const ResetRequestSchema = new mongoose.Schema({
  identifier: { type: String, default: "" }, // what the parent typed
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // null = no matching account
  fullName: { type: String, default: "" },
  childName: { type: String, default: "" },
  username: { type: String, default: "" },
  phone: { type: String, default: "" },
  at: { type: Date, default: Date.now },
  resolved: { type: Boolean, default: false },
  resolvedAt: Date,
});

ResetRequestSchema.index({ resolved: 1, at: -1 });

module.exports = mongoose.model("ResetRequest", ResetRequestSchema);
