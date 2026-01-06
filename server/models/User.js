// server/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  // Login Info
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true },
  
  // Personal Info
  fullName: String,
  email: String,
  phone: String,
  location: String,
  zoomId: String,
  referredBy: String,

  // Student Info (Parent)
  childName: String,
  childAge: String,
  childClass: String,
  
  // ✨ CHANGED: Replaced 'childSchool' with 'monthlyFee'
  monthlyFee: { type: Number, default: 0 }, 

  // Teacher Info
  specialization: String,
  
  // System Info
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);