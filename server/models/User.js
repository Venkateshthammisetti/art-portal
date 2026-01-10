const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  // Login Info
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true }, // 'admin', 'teacher', 'parent'
  
  // Personal Info (Editable)
  fullName: String,
  email: String,
  phone: String,
  location: String,
  zoomId: String,
  referredBy: String,

  // Student Info (Parent Role)
  childName: String,
  childAge: String,
  childDob: { type: Date },
  childClass: String,
  

  joiningDate: { type: Date },
  
  // Financials (Used for Fee OR Salary)
  monthlyFee: { type: Number, default: 0 }, 

  // Teacher Info
  specialization: String,
  
  // Progress Tracking
  progress: String,
  feedback: String,

  // System Info
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },

  // ✨ NEW: Track which class the student belongs to
  // If null, they are not assigned. If populated, they are assigned.
  assignedClass: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null }
});

module.exports = mongoose.model('User', UserSchema);