const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'teacher', 'parent'], default: 'parent' },
  
  // Basic Info
  fullName: String,
  email: String,
  parentEmail: String,
  phone: String,
  location: String,
  city: String, // Added recently
  zoomId: String,
  referredBy: String,
  
  // Student Specific
  childName: String,
  childAge: Number,
  childDob: String,
  gender: String,
  admissionId: String,
  shortBio: String,
  childClass: String, // e.g. "Grade 5"
  
  // Fee & Class Info
  assignedClass: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  monthlyFee: { type: Number, default: 0 },
  monthlyClassesTarget: { type: Number, default: 8 },
  
  // Dates
  joiningDate: String, // Original joining date (for reference)
  
  // ✨ NEW FIELD: This controls when Fee Calculation starts
  registeredDate: { type: String, default: new Date().toISOString().split('T')[0] }, 

  // Teacher/Admin Specific
  specialization: String,
  education: String,
  dob: String,

  pushSubscription: { type: Object }, // Stores the device address

  isActive: { type: Boolean, default: true },
  
  // Payment History
  payments: [{
    month: String, // Format: "YYYY-MM"
    status: { type: String, enum: ['Paid', 'Pending'], default: 'Pending' },
    amount: Number,
    paidDate: Date
  }],

  // Fee Change History — records every fee revision so pending months use the correct rate
  feeChangeHistory: [{
    effectiveFrom: String, // "YYYY-MM" — the month from which this fee applies
    fee: Number
  }],

  // Student Pass History (months where fee is waived)
  passes: [{
    month: String, // Format: "YYYY-MM"
    reason: { type: String, default: '' },
    markedAt: { type: Date, default: Date.now },
    markedBy: String // admin username or ID
  }]
}, { timestamps: true });



module.exports = mongoose.model('User', UserSchema);