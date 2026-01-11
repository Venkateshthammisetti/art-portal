const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  // ... (Keep all existing fields: username, role, student details, etc.)
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true },
  
  // Student/Parent Fields
  firstName: String, lastName: String, gender: String, admissionId: String, shortBio: String,
  studentEmail: String, studentPhone: String,
  
  // Shared Fields
  fullName: String, email: String, phone: String, location: String, zoomId: String, referredBy: String,
  joiningDate: Date,
  
  // Academic
  childName: String, childAge: String, childDob: Date, childClass: String,
  monthlyFee: { type: Number, default: 0 },
  specialization: String, // Teacher
  dob: Date, // Admin
  
  assignedClass: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },

  // ✨ NEW: PAYMENT HISTORY
  // Stores records like: { month: "2026-01", status: "Paid", amount: 4000, date: ... }
  payments: [{
    month: { type: String, required: true }, // Format: "YYYY-MM"
    status: { type: String, enum: ['Paid', 'Pending'], default: 'Paid' },
    amount: Number,
    paidDate: { type: Date, default: Date.now }
  }]
});

module.exports = mongoose.model('User', UserSchema);