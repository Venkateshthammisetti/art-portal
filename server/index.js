require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Import Models
const User = require('./models/User');
const Class = require('./models/Class');
const Attendance = require('./models/Attendance'); // Ensure this matches Step 1
const Feedback = require('./models/Feedback');

const app = express();
app.use(cors());
app.use(express.json());

// --- CONNECT TO DATABASE ---
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/art_academy')
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch(err => console.error("❌ DB Error:", err));

// --- HELPER FUNCTIONS ---
function escapeRegex(text) {
    if (!text) return "";
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

// ===========================
//         AUTH & USERS
// ===========================

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    if (user) res.json(user); 
    else res.status(401).json({ success: false, message: "Wrong credentials" });
});

app.post('/api/register', async (req, res) => {
  try {
    const { username } = req.body;
    if (await User.findOne({ username })) return res.status(400).json({ message: 'Username taken' });
    const newUser = new User(req.body); 
    await newUser.save();
    res.json({ message: 'User registered successfully!' });
  } catch (err) { res.status(500).json({ message: 'Server Error' }); }
});

app.get('/api/users/parent/:phone', async (req, res) => {
  try {
    const parent = await User.findOne({ phone: req.params.phone, role: 'parent' });
    if (parent) res.json(parent);
    else res.status(404).json({ message: "Parent not found" });
  } catch (err) { res.status(500).json({ message: "Server Error" }); }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.json(users);
  } catch (err) { res.status(500).json({ message: 'Server Error' }); }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedUser);
  } catch (err) { res.status(500).json({ message: "Error updating user" }); }
});

app.put('/api/users/:id/status', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        user.isActive = !user.isActive; 
        await user.save();
        res.json({ message: "Status updated", isActive: user.isActive });
    } catch (err) { res.status(500).json({ message: "Server Error" }); }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (err) { res.status(500).json({ message: 'Server Error' }); }
});

app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: 'parent' });
    const totalTeachers = await User.countDocuments({ role: 'teacher' });
    const revenueResult = await User.aggregate([
      { $match: { role: 'parent' } }, 
      { $group: { _id: null, totalRevenue: { $sum: "$monthlyFee" } } }
    ]);
    res.json({ students: totalStudents, teachers: totalTeachers, revenue: revenueResult[0]?.totalRevenue || 0 });
  } catch (err) { res.status(500).json({ message: 'Error fetching stats' }); }
});

// ===========================
//      CLASS MANAGEMENT
// ===========================

app.get('/api/classes', async (req, res) => {
  try {
    const classes = await Class.find()
      .populate('teacher', 'fullName username')
      .populate('students', 'childName fullName username childAge joiningDate');
    res.json(classes);
  } catch (err) { res.status(500).json({ message: "Error fetching classes" }); }
});

app.post('/api/classes', async (req, res) => {
  try {
    const { className } = req.body;
    const nameRegex = new RegExp(`^${escapeRegex(className.trim())}$`, 'i');
    if (await Class.findOne({ className: { $regex: nameRegex } })) {
      return res.status(400).json({ message: `Class "${className}" already exists.` });
    }
    const newClass = new Class(req.body);
    await newClass.save();
    res.json(newClass);
  } catch (err) { res.status(500).json({ message: "Error creating class" }); }
});

app.put('/api/classes/:id', async (req, res) => {
  try {
    const updatedClass = await Class.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('teacher');
    res.json(updatedClass);
  } catch (err) { res.status(500).json({ message: "Error updating class" }); }
});

app.post('/api/classes/:id/assign', async (req, res) => {
  try {
    const { studentIds } = req.body; 
    const classDoc = await Class.findById(req.params.id);
    await User.updateMany({ _id: { $in: studentIds } }, { $set: { assignedClass: req.params.id } });
    classDoc.students = studentIds;
    await classDoc.save();
    res.json({ message: "Students assigned" });
  } catch (err) { res.status(500).json({ message: "Error assigning students" }); }
});

app.delete('/api/classes/:id', async (req, res) => {
  try {
    await Class.findByIdAndDelete(req.params.id);
    await User.updateMany({ assignedClass: req.params.id }, { $set: { assignedClass: null } });
    res.json({ message: "Class deleted" });
  } catch (err) { res.status(500).json({ message: "Error deleting class" }); }
});

// ===========================
//      FEE & FEEDBACK
// ===========================

app.post('/api/fees/update', async (req, res) => {
  try {
    const { userId, month, status, amount } = req.body; 
    const user = await User.findById(userId);
    const idx = user.payments.findIndex(p => p.month === month);
    if (idx > -1) {
      if (status === 'Pending') user.payments.splice(idx, 1);
      else { user.payments[idx].status = status; user.payments[idx].amount = amount; }
    } else if (status === 'Paid') {
      user.payments.push({ month, status: 'Paid', amount, paidDate: new Date() });
    }
    await user.save();
    res.json({ success: true, payments: user.payments });
  } catch (err) { res.status(500).json({ message: "Error updating fees" }); }
});

app.post('/api/feedback', async (req, res) => {
  try {
    await new Feedback(req.body).save();
    res.json({ success: true, message: "Feedback submitted!" });
  } catch (err) { res.status(500).json({ message: "Error submitting feedback" }); }
});

app.get('/api/teacher/:id/classes', async (req, res) => {
  try {
    const classes = await Class.find({ teacher: req.params.id }).populate('students');
    res.json(classes);
  } catch (err) { res.status(500).json({ message: "Error fetching classes" }); }
});

// ===========================
//      ATTENDANCE (FIXED)
// ===========================

// 1. GET DAILY (For specific date & classes)
app.get('/api/attendance/daily', async (req, res) => {
  try {
    const { classes, date } = req.query;
    if (!classes || !date) return res.json({ statusMap: {}, isScheduled: false });

    const classIds = classes.split(',');

    // Fetch Records
    const records = await Attendance.find({ date: date, classId: { $in: classIds } });

    // Map: { studentId: 'Present' }
    const statusMap = {};
    records.forEach(r => {
      if (r.studentId) statusMap[r.studentId.toString()] = r.status;
    });

    // Check Schedule
    const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
    const isScheduled = await Class.exists({ _id: { $in: classIds }, 'schedule.day': dayName });

    res.json({ statusMap, isScheduled: !!isScheduled });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 2. GET MONTHLY (For specific month regex)
app.get('/api/attendance/monthly', async (req, res) => {
  try {
    const { classes, month } = req.query; // "2026-01"
    if (!classes || !month) return res.json([]);

    const classIds = classes.split(',');
    const records = await Attendance.find({ 
      date: { $regex: `^${month}` }, 
      classId: { $in: classIds } 
    });
    
    res.json(records);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. SAVE ATTENDANCE (Bulk Write)
app.post('/api/attendance', async (req, res) => {
  try {
    const { date, records } = req.body;
    // records: [{ studentId, classId, status }]

    console.log(`📝 Saving ${records?.length} attendance records for ${date}`);

    if (!records || records.length === 0) {
      return res.json({ success: true, message: "No records provided" });
    }

    // Convert to Bulk Operations
    const operations = records.map(rec => {
      if(!rec.studentId || !rec.classId) return null;
      return {
        updateOne: {
          filter: { date: date, studentId: rec.studentId, classId: rec.classId },
          update: { $set: { status: rec.status } },
          upsert: true
        }
      };
    }).filter(op => op !== null);

    if (operations.length > 0) {
      await Attendance.bulkWrite(operations);
    }

    res.json({ success: true, message: "Attendance Saved Successfully" });
  } catch (err) {
    console.error("Attendance Save Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));