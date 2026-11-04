const mongoose = require('mongoose');

// Admissions CRM: a family that has enquired, from first contact to a demo class
// to becoming an enrolled parent (or being marked lost).
const STAGES = ['new', 'contacted', 'demo_scheduled', 'demo_done', 'converted', 'lost'];
const SOURCES = ['Instagram', 'Facebook', 'Google', 'WhatsApp', 'Referral', 'Website', 'Walk-in', 'Phone call', 'Other'];

const FollowUpSchema = new mongoose.Schema({
  dueAt: { type: Date, required: true },
  type: { type: String, enum: ['first_contact', 'pre_demo', 'post_demo', 'reschedule', 'general'], default: 'general' },
  title: { type: String, default: '' },
  channel: { type: String, enum: ['call', 'whatsapp', 'email', 'visit'], default: 'call' },
  note: { type: String, default: '' },
  done: { type: Boolean, default: false },
  doneAt: { type: Date, default: null },
  outcome: { type: String, default: '' },
  auto: { type: Boolean, default: false }, // created by the system, not by hand
});

const ActivitySchema = new mongoose.Schema({
  at: { type: Date, default: Date.now },
  by: { type: String, default: '' },
  type: { type: String, default: 'note' }, // created | stage | note | call | whatsapp | demo | followup | converted | lost | updated
  text: { type: String, default: '' },
});

const LeadSchema = new mongoose.Schema({
  parentName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, trim: true, default: '' },
  childName: { type: String, trim: true, default: '' },
  childAge: { type: Number, default: null },
  city: { type: String, trim: true, default: '' },
  source: { type: String, enum: SOURCES, default: 'Other' },
  referredBy: { type: String, trim: true, default: '' },
  interestMode: { type: String, enum: ['online', 'offline', 'either'], default: 'either' },
  preferredTime: { type: String, trim: true, default: '' },
  notes: { type: String, default: '' },

  stage: { type: String, enum: STAGES, default: 'new' },
  lostReason: { type: String, default: '' },

  demo: {
    date: { type: Date, default: null }, // demo start (date + time)
    mode: { type: String, enum: ['online', 'offline', ''], default: '' },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    meetingLink: { type: String, default: '' },
    status: { type: String, enum: ['', 'scheduled', 'attended', 'no_show', 'cancelled'], default: '' },
    feedback: { type: String, default: '' },
    rating: { type: Number, default: null },
  },

  followUps: [FollowUpSchema],
  activities: [ActivitySchema],
  // Earliest open follow-up — kept in sync on every save for fast sorting/filtering
  nextFollowUpAt: { type: Date, default: null },

  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdBy: { type: String, default: '' },
  convertedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  convertedAt: { type: Date, default: null },
  stageChangedAt: { type: Date, default: Date.now },
}, { timestamps: true });

LeadSchema.pre('save', function syncNextFollowUp() {
  const open = (this.followUps || []).filter((f) => !f.done).map((f) => f.dueAt).sort((a, b) => a - b);
  this.nextFollowUpAt = open[0] || null;
});

LeadSchema.index({ stage: 1, nextFollowUpAt: 1 });
LeadSchema.index({ phone: 1 });

module.exports = mongoose.model('Lead', LeadSchema);
module.exports.STAGES = STAGES;
module.exports.SOURCES = SOURCES;
