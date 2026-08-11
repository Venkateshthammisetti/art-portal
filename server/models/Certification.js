const mongoose = require('mongoose');

const CertificationSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  title: {
    type: String,
    default: 'Certificate of Achievement'
  },
  issuer: {
    type: String,
    default: 'Thevenkyart Art Academy'
  },
  fileUrl: {
    type: String,
    required: true
  },
  dateIssued: {
    type: String,
    default: new Date().toISOString().split('T')[0]
  }
}, { timestamps: true });

module.exports = mongoose.model('Certification', CertificationSchema);
