const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  // --- LOGIN CREDENTIALS ---
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true }, // 'parent' (Student), 'teacher', 'admin'
  
  // --- PARENT / ACCOUNT HOLDER DETAILS ---
  fullName: String,   // Parent Name
  email: String,      // Parent Email
  phone: String,      // Parent Phone
  location: String,
  zoomId: String,
  referredBy: String,
  joiningDate: { type: Date },

  // --- STUDENT DETAILS ---
  firstName: String, 
  lastName: String,  
  gender: String,
  admissionId: String,
  shortBio: String,
  
  // Student Contact (Separate from Parent)
  studentEmail: String, // ✨ NEW
  studentPhone: String, // ✨ NEW

  // Legacy/Computed fields
  childName: String, // Will store "FirstName LastName"
  childAge: String,
  childDob: { type: Date },
  childClass: String,
  
  // --- ACADEMIC / FINANCIAL ---
  monthlyFee: { type: Number, default: 0 }, 
  specialization: String, // For Teachers
  
  // --- SYSTEM ---
  assignedClass: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  
  // Admin Specific
  dob: Date 
});

module.exports = mongoose.model('User', UserSchema);