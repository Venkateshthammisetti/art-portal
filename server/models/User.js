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
  parentDesignation: String,
  
  // Class Mode
  classMode: { type: String, enum: ['online', 'offline'], default: 'online' },

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

  // Per-Month Fee Overrides — a one-off custom fee for a single still-unpaid month
  // (e.g. a discount or partial month), without affecting any other month or
  // creating a payment record. Once that month is actually paid, the amount lives
  // on the payments[] entry instead and this override is no longer consulted for it.
  feeOverrides: [{
    month: String, // Format: "YYYY-MM"
    amount: Number
  }],

  // Student Pass History (months where fee is waived)
  passes: [{
    month: String, // Format: "YYYY-MM"
    reason: { type: String, default: '' },
    markedAt: { type: Date, default: Date.now },
    markedBy: String // admin username or ID
  }],

  // Inactivity History — tracks periods when a student is not attending
  inactiveHistory: [{
    inactiveFrom: String,    // "YYYY-MM" — first inactive month (inclusive)
    inactiveTo: String,      // "YYYY-MM" — last inactive month (inclusive); null = still inactive
    reason: { type: String, default: '' },
    markedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });



module.exports = mongoose.model('User', UserSchema);