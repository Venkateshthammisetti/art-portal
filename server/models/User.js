const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  // --- LOGIN CREDENTIALS ---
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'teacher', 'parent'], required: true },
  
  // --- PERSONAL DETAILS ---
  fullName: { type: String, required: true },
  firstName: String, 
  lastName: String, 
  gender: String, 
  dob: Date,
  email: String, 
  phone: String, 
  location: String, 
  shortBio: String,
  
  // --- SYSTEM FIELDS ---
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  
  // ==================================================
  //       SPECIFIC TO PARENTS / STUDENTS
  // ==================================================
  
  childName: String, 
  childAge: String, 
  childDob: Date, 
  admissionId: String, 
  
  assignedClass: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },

  // ✨ NEW: CUSTOMIZABLE CLASS TARGET
  // Default is 8, but can be changed to 4, 12, etc. per student
  monthlyClassesTarget: { type: Number, default: 8 }, 

  monthlyFee: { type: Number, default: 0 },
  payments: [{
    month: { type: String, required: true }, 
    amount: Number,
    status: { type: String, enum: ['Paid', 'Pending'], default: 'Pending' },
    paidDate: { type: Date }
  }],

  // ... (Teacher fields remain same)
  specialization: String, 
  education: String,
  zoomId: String, 
  joiningDate: Date,
});

module.exports = mongoose.model('User', UserSchema);