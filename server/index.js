// server/index.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const User = require('./models/User');

const app = express();
app.use(cors());
app.use(express.json());

// Connect to Database
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch(err => console.error("❌ DB Error:", err));

// --- ROUTES ---

// 1. LOGIN ROUTE (FIXED)
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    
    if (user) {
        // ✅ CHANGE THIS LINE: Send the whole user (including progress & childName)
        res.json(user); 
    } else {
        res.status(401).json({ success: false, message: "Wrong credentials" });
    }
});

// 2. SEED ROUTE (Run once to create initial users)
app.post('/api/seed', async (req, res) => {
    // Create one of each user
    const users = [
        { username: "admin", password: "123", role: "admin" },
        { username: "teacher1", password: "123", role: "teacher", specialization: "Oil Painting" },
        { username: "parent1", password: "123", role: "parent", childName: "Rohan" }
    ];
    
    await User.insertMany(users);
    res.send("Database populated with Admin, Teacher, and Parent!");
});

// 3. REGISTER NEW USER ROUTE (For Admin to use)
app.post('/api/register', async (req, res) => {
  try {
    const { username } = req.body;

    // 1. Check if user exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    // 2. Create User using req.body (This saves everything: email, phone, childName, etc.)
    const newUser = new User(req.body); 
    await newUser.save();

    res.json({ message: 'User registered successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});


// 4. GET ALL STUDENTS (For Teachers to see)
app.get('/api/students', async (req, res) => {
    // Find all users who are 'parents' (students)
    const students = await User.find({ role: 'parent' });
    res.json(students);
});

// 5. UPDATE PROGRESS (For Teachers to mark grades)
app.post('/api/update-progress', async (req, res) => {
    const { username, progress, feedback } = req.body;
    
    // Find the student and update their data
    await User.findOneAndUpdate(
        { username: username }, 
        { progress: progress, feedback: feedback }
    );
    
    res.json({ success: true, message: "Progress updated!" });
});

// ✨ NEW: Get All Users Route
app.get('/api/users', async (req, res) => {
  try {
    // Find all users but DON'T send back their passwords! (select('-password'))
    const users = await User.find({}).select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});


// ✨ NEW: Delete User Route
app.delete('/api/users/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// ✨ NEW: Simple Stats Route
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    // 1. Count Users
    const studentCount = await User.countDocuments({ role: 'parent' });
    const teacherCount = await User.countDocuments({ role: 'teacher' });

    // 2. ✨ REAL MATH: Sum of 'monthlyFee' from database
    const revenueResult = await User.aggregate([
      { $match: { role: 'parent' } },  // Find only parents
      { $group: { _id: null, totalRevenue: { $sum: "$monthlyFee" } } } // Add up their fees
    ]);

    // If result is empty (no students), default to 0
    const realRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

    // 3. Send the numbers back
    res.json({ 
      students: studentCount, 
      teachers: teacherCount, 
      revenue: realRevenue // <--- Now sends the SUM (e.g., 6000)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching stats' });
  }
});



// 6. DASHBOARD STATS (Calculates Total Revenue)
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: 'parent' });
    const totalTeachers = await User.countDocuments({ role: 'teacher' });
    
    // ✨ LOGIC: Sum of all 'monthlyFee' fields for parents
    const revenueResult = await User.aggregate([
      { $match: { role: 'parent' } }, // 1. Find all parents
      { $group: { _id: null, totalRevenue: { $sum: "$monthlyFee" } } } // 2. Add up their fees
    ]);
    
    // If we have users, get the total. If not, it's 0.
    const calculatedRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

    res.json({
      students: totalStudents,
      teachers: totalTeachers,
      revenue: calculatedRevenue // Send the real sum
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching stats' });
  }
});


app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: 'parent' });
    const totalTeachers = await User.countDocuments({ role: 'teacher' });
    
    // ✨ CALCULATE REVENUE: Sum of 'monthlyFee' for all PARENTS
    const revenueResult = await User.aggregate([
      { $match: { role: 'parent' } }, 
      { $group: { _id: null, totalRevenue: { $sum: "$monthlyFee" } } }
    ]);
    
    const calculatedRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

    res.json({
      students: totalStudents,
      teachers: totalTeachers,
      revenue: calculatedRevenue // This sends the 6000 (or total) to the frontend
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching stats' });
  }
});




app.listen(5000, () => console.log("Server running on port 5000"));