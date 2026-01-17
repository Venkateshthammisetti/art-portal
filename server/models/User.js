const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  // --- LOGIN CREDENTIALS ---
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true }, // 'parent', 'teacher', 'admin'
  
  // --- STUDENT / PARENT SPECIFIC ---
  firstName: String, 
  lastName: String, 
  gender: String, 
  admissionId: String, 
  shortBio: String,
  studentEmail: String, 
  studentPhone: String,
  
  // --- SHARED CONTACT INFO (Parent/Teacher/Admin) ---
  fullName: String, 
  email: String, 
  phone: String, 
  location: String, 
  zoomId: String, 
  referredBy: String,
  joiningDate: Date,
  
  // --- ACADEMIC DETAILS ---
  childName: String, 
  childAge: String, 
  childDob: Date, 
  childClass: String,
  monthlyFee: { type: Number, default: 0 },
  
  // --- PROFESSIONAL DETAILS (Teacher/Admin) ---
  specialization: String, 
  education: String,
  dob: Date, 
  
  // --- SYSTEM FIELDS ---
  assignedClass: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },

  // ✨ NEW: FEE TRACKER HISTORY
  // Stores records like: { month: "2026-01", status: "Paid", amount: 4000 }
  payments: [{
    month: { type: String, required: true }, // Format: "YYYY-MM"
    status: { type: String, enum: ['Paid', 'Pending'], default: 'Paid' },
    amount: Number,
    paidDate: { type: Date, default: Date.now }
  }]
});

module.exports = mongoose.model('User', UserSchema);