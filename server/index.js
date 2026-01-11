require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const User = require('./models/User');
const Class = require('./models/Class');

const app = express();
app.use(cors());
app.use(express.json());

// --- CONNECT TO DATABASE ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch(err => console.error("❌ DB Error:", err));

// --- HELPER FUNCTIONS ---
function escapeRegex(text) {
    if (!text) return "";
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}
const normalize = (str) => (str || "").toString().trim().toLowerCase();

// ===========================
//         AUTH & USERS
// ===========================

// 1. LOGIN
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    if (user) {
        res.json(user); 
    } else {
        res.status(401).json({ success: false, message: "Wrong credentials" });
    }
});

// 2. REGISTER NEW USER
app.post('/api/register', async (req, res) => {
  try {
    const { username } = req.body;
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already taken' });
    }
    const newUser = new User(req.body); 
    await newUser.save();
    res.json({ message: 'User registered successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// 3. ✨ NEW: GET PARENT BY PHONE (For Auto-fill)
app.get('/api/users/parent/:phone', async (req, res) => {
  try {
    const parent = await User.findOne({ phone: req.params.phone, role: 'parent' })
                             .select('fullName email location zoomId referredBy');
    if (parent) {
      res.json(parent);
    } else {
      res.status(404).json({ message: "Parent not found" });
    }
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

// 4. GET ALL USERS
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// 5. UPDATE USER DETAILS
app.put('/api/users/:id', async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedUser) return res.status(404).json({ message: "User not found" });
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ message: "Server error updating user" });
  }
});

// 6. UPDATE STATUS
app.put('/api/users/:id/status', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });
        user.isActive = !user.isActive; 
        await user.save();
        res.json({ message: "Status updated", isActive: user.isActive });
    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
});

// 7. DELETE USER
app.delete('/api/users/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// 8. DASHBOARD STATS
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: 'parent' });
    const totalTeachers = await User.countDocuments({ role: 'teacher' });
    const revenueResult = await User.aggregate([
      { $match: { role: 'parent' } }, 
      { $group: { _id: null, totalRevenue: { $sum: "$monthlyFee" } } }
    ]);
    const calculatedRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;
    res.json({ students: totalStudents, teachers: totalTeachers, revenue: calculatedRevenue });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching stats' });
  }
});

// 9. GET USER CREDENTIALS
app.get('/api/users/:id/credentials', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('username password');
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

// ===========================
//      CLASS MANAGEMENT
// ===========================

// 1. GET ALL CLASSES
app.get('/api/classes', async (req, res) => {
  try {
    const classes = await Class.find()
      .populate('teacher', 'fullName username')
      .populate('students', 'childName fullName username childAge joiningDate');
    res.json(classes);
  } catch (err) {
    res.status(500).json({ message: "Error fetching classes" });
  }
});

// 2. CREATE A CLASS (Strict Name Uniqueness)
app.post('/api/classes', async (req, res) => {
  try {
    const { className, level, subLevel, teacherId, schedule, meetingLink, maxCapacity } = req.body;

    // ✨ CHECK 1: GLOBAL NAME CHECK
    // Search for any class with this exact name (case-insensitive)
    const nameRegex = new RegExp(`^${escapeRegex(className.trim())}$`, 'i');
    const existingName = await Class.findOne({ className: { $regex: nameRegex } });

    if (existingName) {
      return res.status(400).json({ 
        message: `DUPLICATE NAME: A class named "${existingName.className}" already exists. Please choose a unique name.` 
      });
    }

    // Create
    const newClass = new Class({
      className: className.trim(),
      level, subLevel, schedule, meetingLink,
      maxCapacity: maxCapacity || 10,
      teacher: teacherId,
      students: []
    });
    await newClass.save();
    res.json(newClass);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error creating class" });
  }
});

// 3. UPDATE CLASS (Strict Name Uniqueness)
app.put('/api/classes/:id', async (req, res) => {
  try {
    const { className, level, subLevel, teacherId, schedule, meetingLink, maxCapacity } = req.body;

    // ✨ CHECK: Name unique (excluding current class)
    const nameRegex = new RegExp(`^${escapeRegex(className.trim())}$`, 'i');
    const duplicate = await Class.findOne({ 
      _id: { $ne: req.params.id }, // Ignore self
      className: { $regex: nameRegex } 
    });

    if (duplicate) {
      return res.status(400).json({ 
        message: `DUPLICATE NAME: A class named "${duplicate.className}" already exists.` 
      });
    }

    const updatedClass = await Class.findByIdAndUpdate(
      req.params.id, 
      { className, level, subLevel, teacher: teacherId, schedule, meetingLink, maxCapacity },
      { new: true }
    ).populate('teacher', 'fullName username');
    
    res.json(updatedClass);
  } catch (err) {
    res.status(500).json({ message: "Error updating class" });
  }
});

// 4. ASSIGN STUDENTS
app.post('/api/classes/:id/assign', async (req, res) => {
  try {
    const classId = req.params.id;
    const { studentIds } = req.body; 

    if (!studentIds || !Array.isArray(studentIds)) {
        return res.status(400).json({ message: "Invalid student IDs" });
    }

    const classDoc = await Class.findById(classId);
    if (!classDoc) return res.status(404).json({ message: "Class not found" });

    await User.updateMany(
      { _id: { $in: studentIds } },
      { $set: { assignedClass: classId } }
    );

    classDoc.students = studentIds;
    await classDoc.save();

    res.json({ message: "Students assigned successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error assigning students" });
  }
});

// 5. DELETE CLASS
app.delete('/api/classes/:id', async (req, res) => {
  try {
    const classId = req.params.id;
    await Class.findByIdAndDelete(classId);
    await User.updateMany(
      { assignedClass: classId },
      { $set: { assignedClass: null } }
    );
    res.json({ message: "Class deleted and students unassigned" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting class" });
  }
});

// ===========================
//       FEE MANAGEMENT
// ===========================

// 1. MARK FEE STATUS
app.post('/api/fees/update', async (req, res) => {
  try {
    const { userId, month, status, amount } = req.body; 
    
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "Student not found" });

    const existingPaymentIndex = user.payments.findIndex(p => p.month === month);

    if (existingPaymentIndex > -1) {
      if (status === 'Pending') {
         user.payments.splice(existingPaymentIndex, 1);
      } else {
         user.payments[existingPaymentIndex].status = status;
         user.payments[existingPaymentIndex].amount = amount;
         user.payments[existingPaymentIndex].paidDate = new Date();
      }
    } else {
      if (status === 'Paid') {
        user.payments.push({
          month,
          status: 'Paid',
          amount: amount,
          paidDate: new Date()
        });
      }
    }

    await user.save();
    res.json({ success: true, payments: user.payments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating fee status" });
  }
});

// Start Server
app.listen(5000, () => console.log("✅ Server running on port 5000"));