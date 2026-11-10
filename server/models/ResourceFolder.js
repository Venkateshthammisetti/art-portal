const mongoose = require('mongoose');

// Admin › Academic Resources: folders of links, notes, images and files the
// academy keeps handy to send to parents (registration forms, material lists…).
const ResourceItemSchema = new mongoose.Schema({
  kind: { type: String, enum: ['link', 'note', 'image', 'file'], required: true },
  title: { type: String, trim: true, default: '' },
  url: { type: String, trim: true, default: '' }, // link target or Cloudinary URL
  text: { type: String, default: '' }, // note body, or an optional description
  fileName: { type: String, default: '' },
  mimeType: { type: String, default: '' },
  size: { type: Number, default: 0 },
  publicId: { type: String, default: '' }, // Cloudinary id (asset is kept on delete, like artwork)
  pinned: { type: Boolean, default: false },
  createdBy: { type: String, default: '' },
}, { timestamps: true });

const ResourceFolderSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  color: { type: String, default: 'cobalt' },
  items: [ResourceItemSchema],
  createdBy: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('ResourceFolder', ResourceFolderSchema);
