require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

// Import Models
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const User = require("./models/User");
const Class = require("./models/Class");
const Attendance = require("./models/Attendance");
const Feedback = require("./models/Feedback");
const Artwork = require("./models/Artwork");
const Expense = require("./models/Expense");
const nodemailer = require("nodemailer");
const webpush = require("web-push");

const startScheduler = require("./scheduler");

// ⚡️ KEEP ALIVE SCRIPT ⚡️
// This forces the server to ping itself every 10 minutes to stay awake.
const https = require("https");

const app = express();
app.use(cors());
app.use(express.json());

// 2. Configure Cloudinary (Replace with your actual keys from Step 1)
cloudinary.config({
  cloud_name: "dvb9pv3td",
  api_key: "455651346973742",
  api_secret: "mu0GQEANFqZSDzgwwFZJCPc3ilY",
});

// 3. Configure Storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "art-academy-reports", // Folder name in Cloudinary
    allowed_formats: ["pdf", "jpg", "png"],
    resource_type: "auto", // Important for detecting PDFs vs Images
  },
});

// Configure VAPID Keys
webpush.setVapidDetails(
  "mailto:thevenkyart@gmail.com", // Your admin email
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

const upload = multer({ storage: storage });

// Serve "uploads" folder publicly so PDFs can be viewed
//app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure Multer Storage
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, 'uploads/');
//   },
//   filename: (req, file, cb) => {
//     cb(null, Date.now() + '-' + file.originalname);
//   }
// });
//const upload = multer({ storage: storage });

// --- CONNECT TO DATABASE ---
mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/art_academy")
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ DB Error:", err));

// --- HELPER FUNCTIONS ---
function escapeRegex(text) {
  if (!text) return "";
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

// Configure your Gmail "Postman"
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    // 🔒 Use environment variables for security
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

// ===========================
//        AUTH & USERS
// ===========================

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, password });
  if (user) res.json(user);
  else res.status(401).json({ success: false, message: "Wrong credentials" });
});

app.post("/api/register", async (req, res) => {
  try {
    const { username } = req.body;
    if (await User.findOne({ username }))
      return res.status(400).json({ message: "Username taken" });
    const newUser = new User(req.body);
    await newUser.save();
    res.json({ message: "User registered successfully!" });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

app.get("/api/users/parent/:phone", async (req, res) => {
  try {
    const parent = await User.findOne({
      phone: req.params.phone,
      role: "parent",
    });
    if (parent) res.json(parent);
    else res.status(404).json({ message: "Parent not found" });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find({}).select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

app.put("/api/users/:id", async (req, res) => {
  try {
    const existing = await User.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "User not found" });

    const newFee = req.body.monthlyFee !== undefined ? Number(req.body.monthlyFee) : null;
    const feeChanged = newFee !== null && newFee !== Number(existing.monthlyFee);

    if (feeChanged) {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const existingHistory = existing.feeChangeHistory || [];

      // Remove any existing entry for currentMonth to avoid duplicates, then rebuild
      let updatedHistory = existingHistory.filter(h => h.effectiveFrom !== currentMonth);

      if (existingHistory.length === 0) {
        const rawStart = existing.registeredDate || existing.joiningDate || existing.createdAt;
        const startMonth = rawStart
          ? (typeof rawStart === "string" ? rawStart : new Date(rawStart).toISOString()).slice(0, 7)
          : currentMonth;
        // Only seed the old-fee entry if startMonth differs from currentMonth
        if (startMonth !== currentMonth) {
          updatedHistory.push({ effectiveFrom: startMonth, fee: Number(existing.monthlyFee) || 0 });
        }
      }
      updatedHistory.push({ effectiveFrom: currentMonth, fee: newFee });

      const { feeChangeHistory: _drop, ...bodyFields } = req.body;
      const updatedUser = await User.findByIdAndUpdate(
        req.params.id,
        { $set: { ...bodyFields, feeChangeHistory: updatedHistory } },
        { new: true }
      );
      return res.json(updatedUser);
    }

    const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ message: "Error updating user" });
  }
});

app.put("/api/users/:id/status", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    user.isActive = !user.isActive;
    await user.save();
    res.json({ message: "Status updated", isActive: user.isActive });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

app.delete("/api/users/:id", async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

app.get("/api/dashboard/stats", async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: "parent" });
    const totalTeachers = await User.countDocuments({ role: "teacher" });
    const offlineStudents = await User.countDocuments({ role: "parent", classMode: "offline" });
    const onlineStudents = totalStudents - offlineStudents;
    const revenueResult = await User.aggregate([
      { $match: { role: "parent" } },
      { $group: { _id: null, totalRevenue: { $sum: "$monthlyFee" } } },
    ]);
    res.json({
      students: totalStudents,
      teachers: totalTeachers,
      onlineStudents,
      offlineStudents,
      revenue: revenueResult[0]?.totalRevenue || 0,
    });
  } catch (err) {
    res.status(500).json({ message: "Error fetching stats" });
  }
});

app.get("/api/users/:id/credentials", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("username password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

// ===========================
//      CLASS MANAGEMENT
// ===========================

app.get("/api/classes", async (req, res) => {
  try {
    const classes = await Class.find()
      .populate("teacher", "fullName username")
      .populate("students", "childName fullName username childAge joiningDate");
    res.json(classes);
  } catch (err) {
    res.status(500).json({ message: "Error fetching classes" });
  }
});

app.post("/api/classes", async (req, res) => {
  try {
    const { className } = req.body;
    const nameRegex = new RegExp(`^${escapeRegex(className.trim())}$`, "i");
    if (await Class.findOne({ className: { $regex: nameRegex } })) {
      return res
        .status(400)
        .json({ message: `Class "${className}" already exists.` });
    }
    const newClass = new Class(req.body);
    // Explicitly set classMode so strict mode doesn't silently drop it
    if (req.body.classMode) newClass.set("classMode", req.body.classMode, { strict: false });
    await newClass.save();
    res.json(newClass);
  } catch (err) {
    res.status(500).json({ message: "Error creating class" });
  }
});

app.put("/api/classes/:id", async (req, res) => {
  try {
    // Use $set with strict:false so classMode is saved even if schema cache is stale
    const updatedClass = await Class.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, strict: false },
    ).populate("teacher");
    res.json(updatedClass);
  } catch (err) {
    res.status(500).json({ message: "Error updating class" });
  }
});

app.post("/api/classes/:id/assign", async (req, res) => {
  try {
    const { studentIds } = req.body;
    const classId = req.params.id;

    // Use User collection as source of truth — find every student currently
    // pointing at this class, regardless of whether Class.students is in sync.
    const currentlyAssigned = await User.find({ assignedClass: classId }).select("_id");
    const currentIds = currentlyAssigned.map((s) => s._id.toString());

    // Students being removed = currently assigned but not in the new selection
    const removedStudentIds = currentIds.filter((id) => !studentIds.includes(id));
    if (removedStudentIds.length > 0) {
      await User.updateMany(
        { _id: { $in: removedStudentIds } },
        { $set: { assignedClass: null } },
      );
    }

    // For students being moved FROM another class, pull them out of that class's students array
    const studentsBeingMoved = await User.find({
      _id: { $in: studentIds },
      assignedClass: { $nin: [null, classId] },
    });
    for (const student of studentsBeingMoved) {
      await Class.findByIdAndUpdate(student.assignedClass, {
        $pull: { students: student._id },
      });
    }

    // Point all selected students at this class
    await User.updateMany(
      { _id: { $in: studentIds } },
      { $set: { assignedClass: classId } },
    );

    // Keep Class.students in sync
    const classDoc = await Class.findById(classId);
    classDoc.students = studentIds;
    await classDoc.save();

    res.json({ message: "Students assigned" });
  } catch (err) {
    console.error("Error assigning students:", err);
    res.status(500).json({ message: "Error assigning students" });
  }
});

app.delete("/api/classes/:id", async (req, res) => {
  try {
    await Class.findByIdAndDelete(req.params.id);
    await User.updateMany(
      { assignedClass: req.params.id },
      { $set: { assignedClass: null } },
    );
    res.json({ message: "Class deleted" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting class" });
  }
});

// ===========================
//      FEEDBACK (WITH PDF)
// ===========================

// 1. SUBMIT FEEDBACK (Teacher)
app.post("/api/feedback", upload.single("report"), async (req, res) => {
  try {
    const { studentId, teacherId, month, feedbackText, rating } = req.body;
    const reportFile = req.file ? req.file.path : null;

    const newFeedback = new Feedback({
      studentId,
      teacherId,
      month,
      feedbackText,
      rating,
      reportFile,
    });

    await newFeedback.save();
    res.json({ success: true, message: "Feedback submitted successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error submitting feedback" });
  }
});

// ✨ 2. SUBMIT PARENT COMMENT (New Route)
app.post("/api/feedback/comment", async (req, res) => {
  try {
    const { reportId, comment } = req.body;

    // Update the specific report with the parent's comment
    const updatedFeedback = await Feedback.findByIdAndUpdate(
      reportId,
      { $set: { parentComment: comment } },
      { new: true },
    );

    if (!updatedFeedback) {
      return res.status(404).json({ message: "Report not found" });
    }

    res.json({
      success: true,
      message: "Comment saved",
      feedback: updatedFeedback,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error saving comment" });
  }
});

// 3. GET HISTORY (Teacher)
app.get("/api/feedback/teacher/:teacherId", async (req, res) => {
  try {
    const { month } = req.query;
    const query = { teacherId: req.params.teacherId };

    if (month) {
      query.month = month;
    }

    // Fetches feedbacks (including parentComment if it exists)
    const feedback = await Feedback.find(query)
      .populate("studentId", "childName")
      .sort({ createdAt: -1 });

    res.json(feedback);
  } catch (err) {
    res.status(500).json({ message: "Error fetching feedback history" });
  }
});

// ===========================
//      ATTENDANCE & FEES
// ===========================

app.post("/api/fees/update", async (req, res) => {
  try {
    const { userId, month, status, amount } = req.body;
    const user = await User.findById(userId);
    const idx = user.payments.findIndex((p) => p.month === month);
    if (idx > -1) {
      if (status === "Pending") user.payments.splice(idx, 1);
      else {
        user.payments[idx].status = status;
        user.payments[idx].amount = amount;
      }
    } else if (status === "Paid") {
      user.payments.push({
        month,
        status: "Paid",
        amount,
        paidDate: new Date(),
      });
    }
    await user.save();
    res.json({ success: true, payments: user.payments });
  } catch (err) {
    res.status(500).json({ message: "Error updating fees" });
  }
});

// ===========================
//      STUDENT PASS
// ===========================

// Mark a student as Pass for a specific month
app.post("/api/student-pass/mark", async (req, res) => {
  try {
    const { userId, month, reason, markedBy } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "Student not found" });

    // Check if already passed for this month
    const existing = (user.passes || []).find((p) => p.month === month);
    if (existing) {
      return res.status(400).json({ message: "Student already has a pass for this month" });
    }

    user.passes = user.passes || [];
    user.passes.push({ month, reason: reason || "", markedAt: new Date(), markedBy: markedBy || "" });

    // Remove any payment record for this month (set fee to ₹0 effectively)
    user.payments = (user.payments || []).filter((p) => p.month !== month);

    await user.save();
    res.json({ success: true, passes: user.passes, payments: user.payments });
  } catch (err) {
    res.status(500).json({ message: "Error marking student pass" });
  }
});

// Remove a pass for a specific month
app.post("/api/student-pass/remove", async (req, res) => {
  try {
    const { userId, month } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "Student not found" });

    user.passes = (user.passes || []).filter((p) => p.month !== month);
    await user.save();
    res.json({ success: true, passes: user.passes });
  } catch (err) {
    res.status(500).json({ message: "Error removing student pass" });
  }
});

// Get pass history for a student
app.get("/api/student-pass/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "Student not found" });
    res.json(user.passes || []);
  } catch (err) {
    res.status(500).json({ message: "Error fetching pass history" });
  }
});

app.get("/api/teacher/:id/classes", async (req, res) => {
  try {
    const classes = await Class.find({ teacher: req.params.id }).populate(
      "students",
    );
    res.json(classes);
  } catch (err) {
    res.status(500).json({ message: "Error fetching classes" });
  }
});

app.get("/api/attendance/daily", async (req, res) => {
  try {
    const { classes, date, students } = req.query;
    if (!classes || !date)
      return res.json({ statusMap: {}, isScheduled: false });
    const classIds = classes.split(",");
    let attendanceQuery;
    if (students) {
      const studentIds = students.split(",");
      attendanceQuery = { date, $or: [{ classId: { $in: classIds } }, { studentId: { $in: studentIds } }] };
    } else {
      attendanceQuery = { date, classId: { $in: classIds } };
    }
    const records = await Attendance.find(attendanceQuery);
    const statusMap = {};
    records.forEach((r) => {
      if (r.studentId) statusMap[r.studentId.toString()] = r.status;
    });
    const dayName = new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
    });
    const isScheduled = await Class.exists({
      _id: { $in: classIds },
      "schedule.day": dayName,
    });
    res.json({ statusMap, isScheduled: !!isScheduled });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/attendance/monthly", async (req, res) => {
  try {
    const { classes, month, students } = req.query;
    if (!classes || !month) return res.json([]);
    const classIds = classes.split(",");
    const dateFilter = { date: { $regex: `^${month}` } };
    let query;
    if (students) {
      const studentIds = students.split(",");
      query = { ...dateFilter, $or: [{ classId: { $in: classIds } }, { studentId: { $in: studentIds } }] };
    } else {
      query = { ...dateFilter, classId: { $in: classIds } };
    }
    const records = await Attendance.find(query);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/attendance", async (req, res) => {
  try {
    const { date, records } = req.body;
    if (!records || records.length === 0) return res.json({ success: true });
    const operations = records
      .map((rec) => {
        if (!rec.studentId || !rec.classId) return null;
        return {
          updateOne: {
            filter: {
              date: date,
              studentId: rec.studentId,
              classId: rec.classId,
            },
            update: { $set: { status: rec.status } },
            upsert: true,
          },
        };
      })
      .filter((op) => op !== null);
    if (operations.length > 0) await Attendance.bulkWrite(operations);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===========================
//      PARENT / STUDENT ROUTES
// ===========================

// 1. GET STUDENT DETAILS
app.get("/api/student/:id/profile", async (req, res) => {
  try {
    const student = await User.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    let classDetails = null;
    if (student.assignedClass) {
      classDetails = await Class.findById(student.assignedClass).populate(
        "teacher",
        "fullName",
      );
    }

    res.json({ student, classDetails });
  } catch (err) {
    res.status(500).json({ message: "Error fetching profile" });
  }
});

// 2. GET STUDENT FEEDBACK (Reports)
app.get("/api/feedback/student/:studentId", async (req, res) => {
  try {
    // This will now include the parentComment field if it was saved via the new POST route
    const feedback = await Feedback.find({ studentId: req.params.studentId })
      .populate("teacherId", "fullName")
      .sort({ createdAt: -1 });
    res.json(feedback);
  } catch (err) {
    res.status(500).json({ message: "Error fetching reports" });
  }
});

// 3. GET STUDENT ATTENDANCE (History)
app.get("/api/attendance/student/:studentId", async (req, res) => {
  try {
    const records = await Attendance.find({ studentId: req.params.studentId });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: "Error fetching attendance" });
  }
});

// ✨ 4. EDIT FEEDBACK (Update PDF or Text)
app.put("/api/feedback/:id", upload.single("report"), async (req, res) => {
  try {
    const { feedbackText, rating, month } = req.body;

    // Find the existing feedback
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback)
      return res.status(404).json({ message: "Feedback not found" });

    // Update text fields
    if (feedbackText) feedback.feedbackText = feedbackText;
    if (rating) feedback.rating = rating;
    // ✨ Update month so the report moves to the correct month bucket
    if (month) feedback.month = month;

    // ✨ If a new file is uploaded, replace the old path
    if (req.file) {
      feedback.reportFile = req.file.path;
    }

    await feedback.save();
    res.json({ success: true, message: "Report updated successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating feedback" });
  }
});

// ===========================
//       ART GALLERY ROUTES 🎨
// ===========================

// 1. UPLOAD ARTWORK (Teacher/Admin)
app.post("/api/gallery/upload", upload.single("image"), async (req, res) => {
  try {
    const { studentId, teacherId, title, medium, dateCreated } = req.body;

    // Check if file was uploaded to Cloudinary
    if (!req.file) {
      return res.status(400).json({ message: "No image file uploaded" });
    }

    const newArtwork = new Artwork({
      studentId,
      teacherId,
      imageUrl: req.file.path, // Cloudinary URL
      title,
      medium,
      dateCreated,
    });

    await newArtwork.save();
    res.json({
      success: true,
      message: "Artwork uploaded successfully!",
      artwork: newArtwork,
    });
  } catch (err) {
    console.error("Gallery Upload Error:", err);
    res.status(500).json({ message: "Error uploading artwork" });
  }
});

// 1. GET ALL ARTWORK (For Admin Gallery "All" View)
app.get("/api/gallery", async (req, res) => {
  try {
    // .populate() grabs the 'childName' from the User table using the studentId
    const artwork = await Artwork.find()
      .populate("studentId", "childName fullName")
      .sort({ dateCreated: -1 }); // Newest first
    res.json(artwork);
  } catch (err) {
    res.status(500).json({ message: "Error fetching all gallery items" });
  }
});

// 2. GET ARTWORK FOR A SPECIFIC STUDENT (For Parents/Profile)
app.get("/api/gallery/student/:studentId", async (req, res) => {
  try {
    const artwork = await Artwork.find({
      studentId: req.params.studentId,
    }).sort({ dateCreated: -1 }); // Newest first
    res.json(artwork);
  } catch (err) {
    res.status(500).json({ message: "Error fetching gallery" });
  }
});

// 3. DELETE ARTWORK (Admin/Teacher)
app.delete("/api/gallery/:id", async (req, res) => {
  try {
    await Artwork.findByIdAndDelete(req.params.id);
    // Note: This deletes from DB. To delete from Cloudinary (Free Tier),
    // we usually just leave it or handle it separately to avoid complexity.
    res.json({ success: true, message: "Artwork deleted" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting artwork" });
  }
});

// 4. BULK DELETE ARTWORKS (Admin/Teacher)
app.post("/api/gallery/bulk-delete", async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No artwork IDs provided" });
    }
    const result = await Artwork.deleteMany({ _id: { $in: ids } });
    res.json({ success: true, message: `${result.deletedCount} artworks deleted` });
  } catch (err) {
    res.status(500).json({ message: "Error deleting artworks" });
  }
});

// ✨ BATCH NOTIFICATION (EMAIL + PUSH)
app.post("/api/notifications/batch-alert", async (req, res) => {
  const { studentId, count } = req.body;

  try {
    const student = await User.findById(studentId);

    // 1. Send Email (Your existing logic)
    const recipientEmail = student.parentEmail || student.email;
    if (recipientEmail) {
      // ... (Keep your existing transporter.sendMail logic here) ...
      // I'm skipping the full email code to save space, but KEEP IT!
      const mailOptions = {
        from: `"Venky Art Academy" <${process.env.GMAIL_USER}>`,
        to: recipientEmail,
        subject: `🎨 Monthly Art Update: ${count} New Artworks!`,
        html: `<p>Check out the ${count} new artworks in the gallery!</p>`,
      };
      transporter
        .sendMail(mailOptions)
        .catch((err) => console.log("Email failed:", err));
    }

    // 2. ✨ SEND PUSH NOTIFICATION (New Logic)
    if (student.pushSubscription) {
      const payload = JSON.stringify({
        title: `🎨 New Artworks Added!`,
        body: `${student.childName} just has ${count} new photos in the gallery. Tap to view!`,
        url: "https://art-portal.netlify.app/#gallery", // Link to open
      });

      try {
        await webpush.sendNotification(student.pushSubscription, payload);
        console.log("✅ Push Notification Sent!");
      } catch (error) {
        console.error("❌ Push Failed:", error);
      }
    }

    res.json({ message: "Notifications sent!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

// ✨ SAVE SUBSCRIPTION
app.post("/api/notifications/subscribe", async (req, res) => {
  const { userId, subscription } = req.body;
  try {
    await User.findByIdAndUpdate(userId, { pushSubscription: subscription });
    res.status(201).json({});
  } catch (err) {
    res.status(500).json({ error: "Could not save subscription" });
  }
});

// ===========================
//        EXPENSES
// ===========================

app.get("/api/expenses", async (req, res) => {
  try {
    const expenses = await Expense.find().sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/expenses", async (req, res) => {
  try {
    const expense = new Expense(req.body);
    await expense.save();
    res.json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/expenses/:id", async (req, res) => {
  try {
    await Expense.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/ping", (req, res) => {
  res.status(200).send("Pong! Server is awake 🤖");
});

// Start the Cron Job
startScheduler();

// 2️⃣ SELF-PING (The "Caffeine")
// Keeps the server busy so Render thinks it's active.
// We ping the /ping route, NOT the home page, to save resources.
const PING_URL = "https://art-portal-7n6r.onrender.com/ping";

function keepAlive() {
  const https = require("https");
  https
    .get(PING_URL, (res) => {
      console.log(`⚡️ Keep-Alive Ping: Status ${res.statusCode}`);
    })
    .on("error", (e) => {
      console.error(`⚡️ Keep-Alive Error: ${e.message}`);
    });
}

// Ping every 10 minutes
setInterval(keepAlive, 600000);

// Run once immediately on start
keepAlive();

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
