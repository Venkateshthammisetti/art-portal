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

// ===========================
//         ROUTES
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

// 2. REGISTER NEW USER (Create)
app.post('/api/register', async (req, res) => {
  try {
    const { username } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    // Create User
    const newUser = new User(req.body); 
    await newUser.save();

    res.json({ message: 'User registered successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// 3. GET ALL USERS (Read)
app.get('/api/users', async (req, res) => {
  try {
    // Find all users, exclude passwords for security
    const users = await User.find({}).select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// 4. ✨ NEW: UPDATE USER DETAILS (Edit)
app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Find user by ID and update with new data
    // { new: true } returns the updated document instead of the old one
    const updatedUser = await User.findByIdAndUpdate(id, updates, { new: true });

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(updatedUser);
  } catch (err) {
    console.error("Update Error:", err);
    res.status(500).json({ message: "Server error updating user" });
  }
});

// 5. UPDATE STATUS (Toggle Active/Inactive)
app.put('/api/users/:id/status', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        user.isActive = !user.isActive; // Toggle status
        await user.save();
        
        res.json({ message: "Status updated", isActive: user.isActive });
    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
});

// 6. DELETE USER
app.delete('/api/users/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// 7. DASHBOARD STATS (Consolidated)
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: 'parent' });
    const totalTeachers = await User.countDocuments({ role: 'teacher' });
    
    // Sum of 'monthlyFee' for parents (Revenue)
    const revenueResult = await User.aggregate([
      { $match: { role: 'parent' } }, 
      { $group: { _id: null, totalRevenue: { $sum: "$monthlyFee" } } }
    ]);
    
    const calculatedRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

    res.json({
      students: totalStudents,
      teachers: totalTeachers,
      revenue: calculatedRevenue
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching stats' });
  }
});

// 8. UPDATE PROGRESS (For Teachers)
app.post('/api/update-progress', async (req, res) => {
    const { username, progress, feedback } = req.body;
    await User.findOneAndUpdate(
        { username: username }, 
        { progress: progress, feedback: feedback }
    );
    res.json({ success: true, message: "Progress updated!" });
});



// 9.  NEW: GET USER CREDENTIALS (For Admin "Eye" Button)
app.get('/api/users/:id/credentials', async (req, res) => {
  try {
    // Specifically select ONLY username and password
    const user = await User.findById(req.params.id).select('username password');
    if (!user) return res.status(404).json({ message: "User not found" });
    
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

// ===========================
//      CLASS MANAGEMENT ROUTES
// ===========================

// 1. GET ALL CLASSES (With Teacher & Student details populated)
app.get('/api/classes', async (req, res) => {
  try {
    const classes = await Class.find()
      .populate('teacher', 'fullName username') // Get teacher name
      .populate('students', 'childName fullName username childAge joiningDate'); // Get student names
    res.json(classes);
  } catch (err) {
    res.status(500).json({ message: "Error fetching classes" });
  }
});

// --- HELPER: Escape special characters for Regex ---
function escapeRegex(text) {
    if (!text) return "";
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

// 2. CREATE A CLASS (Strict Duplicate Prevention)
app.post('/api/classes', async (req, res) => {
  try {
    const { className, level, subLevel, teacherId } = req.body;

    // ✨ ROBUST DUPLICATE CHECK
    // 1. Create Case-Insensitive Regex for Name & Level
    const nameRegex = new RegExp(`^${escapeRegex(className.trim())}$`, 'i');
    const levelRegex = new RegExp(`^${escapeRegex(level.trim())}$`, 'i');

    // 2. Build Query
    const query = {
        className: { $regex: nameRegex },
        level: { $regex: levelRegex }
    };

    // 3. Handle Sub-Level (Check for exact match OR empty/missing if none provided)
    if (subLevel && subLevel.trim() !== "") {
        query.subLevel = { $regex: new RegExp(`^${escapeRegex(subLevel.trim())}$`, 'i') };
    } else {
        // If user didn't select a sub-level, ensure we check for classes that ALSO have no sub-level
        query.$or = [{ subLevel: { $exists: false } }, { subLevel: "" }, { subLevel: null }];
    }

    const existingClass = await Class.findOne(query);

    if (existingClass) {
        return res.status(400).json({ 
            message: `DUPLICATE: Class "${existingClass.className}" (${existingClass.level} ${existingClass.subLevel ? "- " + existingClass.subLevel : ""}) already exists!` 
        });
    }

    // 3. Create if unique
    const newClass = new Class({
      className: className.trim(),
      level: level,
      subLevel: subLevel,
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

// 3. ASSIGN STUDENTS TO CLASS
app.post('/api/classes/:id/assign', async (req, res) => {
  try {
    const classId = req.params.id;
    const { studentIds } = req.body; // Array of User ObjectIds

    // 1. Find the Class
    const classDoc = await Class.findById(classId);
    if (!classDoc) return res.status(404).json({ message: "Class not found" });

    // 2. Update Students: Set their assignedClass to this classId
    // We update ALL selected students to point to this class
    await User.updateMany(
      { _id: { $in: studentIds } },
      { $set: { assignedClass: classId } }
    );

    // 3. Update Class: Replace student list with new selection
    classDoc.students = studentIds;
    await classDoc.save();

    res.json({ message: "Students assigned successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error assigning students" });
  }
});



// 4. UPDATE CLASS DETAILS (Strict Duplicate Prevention)
app.put('/api/classes/:id', async (req, res) => {
  try {
    const { className, level, subLevel, teacherId } = req.body;

    // ✨ ROBUST CHECK (Excluding current ID)
    const nameRegex = new RegExp(`^${escapeRegex(className.trim())}$`, 'i');
    const levelRegex = new RegExp(`^${escapeRegex(level.trim())}$`, 'i');

    const query = {
        _id: { $ne: req.params.id }, // Ignore self
        className: { $regex: nameRegex },
        level: { $regex: levelRegex }
    };

    if (subLevel && subLevel.trim() !== "") {
        query.subLevel = { $regex: new RegExp(`^${escapeRegex(subLevel.trim())}$`, 'i') };
    } else {
        query.$or = [{ subLevel: { $exists: false } }, { subLevel: "" }, { subLevel: null }];
    }

    const duplicateCheck = await Class.findOne(query);

    if (duplicateCheck) {
        return res.status(400).json({ 
             message: `DUPLICATE: Class "${duplicateCheck.className}" (${duplicateCheck.level} ${duplicateCheck.subLevel ? "- " + duplicateCheck.subLevel : ""}) already exists!` 
        });
    }

    const updatedClass = await Class.findByIdAndUpdate(
      req.params.id, 
      { className, level, subLevel, teacher: teacherId },
      { new: true }
    ).populate('teacher', 'fullName username');
    
    res.json(updatedClass);
  } catch (err) {
    res.status(500).json({ message: "Error updating class" });
  }
});

// 5. ✨ DELETE CLASS (And Unassign Students)
app.delete('/api/classes/:id', async (req, res) => {
  try {
    const classId = req.params.id;

    // 1. Delete the Class
    await Class.findByIdAndDelete(classId);

    // 2. Find all students in this class and set their assignedClass to NULL
    await User.updateMany(
      { assignedClass: classId },
      { $set: { assignedClass: null } }
    );

    res.json({ message: "Class deleted and students unassigned" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting class" });
  }
});



// Start Server
app.listen(5000, () => console.log("✅ Server running on port 5000"));