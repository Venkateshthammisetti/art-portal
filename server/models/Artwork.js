const mongoose = require('mongoose');

const ArtworkSchema = new mongoose.Schema({
  studentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  teacherId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  imageUrl: { 
    type: String, 
    required: true 
  },
  title: { 
    type: String, 
    default: 'Untitled Artwork' 
  },
  medium: { 
    type: String, 
    default: 'graphite pencil' // e.g., Watercolors, Oil Pastels
  },
  dateCreated: { 
    type: String, 
    default: new Date().toISOString().split('T')[0] 
  }
}, { timestamps: true });

module.exports = mongoose.model('Artwork', ArtworkSchema);