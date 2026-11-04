const cron = require('node-cron');
const webpush = require('web-push');
const User = require('./models/User');
const Class = require('./models/Class');
const Attendance = require('./models/Attendance');

const setupVapid = () => {
  try {
    webpush.setVapidDetails(
      'mailto:thevenkyart@gmail.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    return true;
  } catch (err) {
    console.error("⚠️ VAPID Key Error:", err.message);
    return false;
  }
};

// ==========================================
// 1. FEE REMINDERS (Parents)
// ==========================================
const checkFeeReminders = async () => {
  if (!setupVapid()) return;

  const today = new Date();
  const day = today.getDate();

  // Run only on 1st, 5th, 10th, 15th, 20th, 25th, 30th
  if (day !== 1 && day % 5 !== 0) return;

  console.log(`⏳ Running Fee Reminder Check for Day ${day}...`);

  try {
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const students = await User.find({});

    let count = 0;
    for (const student of students) {
      if (!student.pushSubscription) continue;

      // Skip students who have a pass for this month
      const hasPass = student.passes && student.passes.some(
        p => p.month === currentMonthStr
      );
      if (hasPass) continue;

      const hasPaid = student.payments && student.payments.some(
        p => p.month === currentMonthStr && p.status === 'Paid'
      );

      if (!hasPaid) {
        const payload = JSON.stringify({
          title: `📅 Fee Reminder: ${currentMonthStr}`,
          body: `Gentle reminder: Fees for your child  ${student.childName} are due.Please pay the fees before 5th of every month.`,
          url: "https://art-portal.netlify.app/#fees"
        });

        try {
          await webpush.sendNotification(student.pushSubscription, payload);
          count++;
          console.log(`   -> 🔔 Sent reminder to ${student.childName}`);
        } catch (error) {
          if (error.statusCode === 410 || error.statusCode === 404) {
             student.pushSubscription = null;
             await student.save();
          } else {
            console.error(`   ❌ Push Error for ${student.childName}:`, error.message);
          }
        }
      }
    }
    console.log(`✅ Fee Check Complete. Sent ${count} reminders.`);

  } catch (err) {
    console.error("❌ Scheduler Error:", err);
  }
};

// ==========================================
// 2. MONTH-END REMINDERS (Teachers)
// ==========================================
const checkTeacherReminders = async () => {
  if (!setupVapid()) return;

  const today = new Date();
  const day = today.getDate();

  // Get the last day of the current month
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  // Send reminders on: 3 days before month end, 1 day before, and last day
  const reminderDays = [lastDay - 3, lastDay - 1, lastDay];
  if (!reminderDays.includes(day)) return;

  console.log(`⏳ Running Teacher Month-End Reminder for Day ${day}...`);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const currentMonth = monthNames[today.getMonth()];
  const daysLeft = lastDay - day;

  try {
    const teachers = await User.find({ role: 'teacher' });

    let count = 0;
    for (const teacher of teachers) {
      if (!teacher.pushSubscription) continue;

      const urgency = daysLeft === 0
        ? `Today is the last day of ${currentMonth}!`
        : `Only ${daysLeft} day${daysLeft > 1 ? 's' : ''} left in ${currentMonth}.`;

      const payload = JSON.stringify({
        title: `📝 Month-End Reminder`,
        body: `${urgency} Please upload pending artworks and submit student reports before the month ends.`,
        url: "https://art-portal.netlify.app/#gallery"
      });

      try {
        await webpush.sendNotification(teacher.pushSubscription, payload);
        count++;
        console.log(`   -> 🔔 Sent teacher reminder to ${teacher.fullName || teacher.username}`);
      } catch (error) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          teacher.pushSubscription = null;
          await teacher.save();
        } else {
          console.error(`   ❌ Push Error for ${teacher.username}:`, error.message);
        }
      }
    }
    console.log(`✅ Teacher Reminder Complete. Sent ${count} reminders.`);

  } catch (err) {
    console.error("❌ Teacher Scheduler Error:", err);
  }
};

// ==========================================
// 3. BIRTHDAY REMINDERS (Admins & Teachers) + BIRTHDAY WISH (Parents)
// ==========================================
const BDAY_REMINDER_OFFSETS = [0, 3, 7]; // days before birthday (0 = today)
const BDAY_MS_PER_DAY = 24 * 60 * 60 * 1000;

// Mirrors the UTC day math in client/src/components/BirthdayNotifications.js —
// childDob is a plain "YYYY-MM-DD" string (parsed as UTC midnight), so we stay
// in UTC throughout to avoid the server's local timezone shifting the day-of-month.
const daysUntilNextBirthday = (dobStr, today) => {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return null;

  const month = dob.getUTCMonth();
  const day = dob.getUTCDate();
  const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

  let next = Date.UTC(today.getFullYear(), month, day);
  if (next < todayUTC) {
    next = Date.UTC(today.getFullYear() + 1, month, day);
  }
  return Math.round((next - todayUTC) / BDAY_MS_PER_DAY);
};

const bdayLabel = (daysUntil) => {
  if (daysUntil === 0) return "is today";
  if (daysUntil === 3) return "is in 3 days";
  return "is in 1 week";
};

// Sends one push and self-heals a dead subscription (410/404) — same pattern as
// the other reminder jobs above.
const sendPushTo = async (user, payload) => {
  if (!user || !user.pushSubscription) return;
  try {
    await webpush.sendNotification(user.pushSubscription, JSON.stringify(payload));
  } catch (error) {
    if (error.statusCode === 410 || error.statusCode === 404) {
      user.pushSubscription = null;
      await user.save();
    } else {
      console.error(`   ❌ Push Error for ${user.username}:`, error.message);
    }
  }
};

const checkBirthdayReminders = async () => {
  if (!setupVapid()) return;

  const today = new Date();
  console.log(`⏳ Running Birthday Reminder Check for ${today.toDateString()}...`);

  try {
    const students = await User.find({
      role: "parent",
      isActive: { $ne: false },
      childDob: { $exists: true, $ne: "" },
    }).populate({
      path: "assignedClass",
      select: "className teacher",
      populate: { path: "teacher", select: "pushSubscription fullName username" },
    });

    const adminNotifs = [];
    const teacherNotifs = new Map(); // teacherId -> { teacher, items: [] }

    for (const student of students) {
      const daysUntil = daysUntilNextBirthday(student.childDob, today);
      if (daysUntil === null || !BDAY_REMINDER_OFFSETS.includes(daysUntil)) continue;

      const entry = {
        name: student.childName || student.fullName || "A student",
        className: student.assignedClass?.className || "",
        daysUntil,
      };
      adminNotifs.push(entry);

      const teacher = student.assignedClass?.teacher;
      if (teacher) {
        const key = String(teacher._id);
        if (!teacherNotifs.has(key)) teacherNotifs.set(key, { teacher, items: [] });
        teacherNotifs.get(key).items.push(entry);
      }

      // Birthday wish — straight to the parent/student, only on the day itself
      if (daysUntil === 0) {
        await sendPushTo(student, {
          title: `🎉 Happy Birthday, ${student.childName || "Champ"}!`,
          body: `Wishing ${student.childName || "your little artist"} a wonderful birthday from all of us at Art Portal! 🎂🎨`,
          url: "https://art-portal.netlify.app",
        });
      }
    }

    // Admins get one summary push covering every student due today/soon
    if (adminNotifs.length > 0) {
      const admins = await User.find({ role: "admin" });
      const body = adminNotifs
        .map((n) => `${n.name}${n.className ? ` (${n.className})` : ""} — birthday ${bdayLabel(n.daysUntil)}`)
        .join("\n");
      const title = adminNotifs.length === 1 ? "🎂 Birthday Reminder" : `🎂 ${adminNotifs.length} Birthday Reminders`;
      for (const admin of admins) {
        await sendPushTo(admin, { title, body, url: "https://art-portal.netlify.app" });
      }
    }

    // Teachers only get reminders for their own assigned-class students
    for (const { teacher, items } of teacherNotifs.values()) {
      const body = items.map((n) => `${n.name} — birthday ${bdayLabel(n.daysUntil)}`).join("\n");
      const title = items.length === 1 ? "🎂 Birthday Reminder" : `🎂 ${items.length} Birthday Reminders`;
      await sendPushTo(teacher, { title, body, url: "https://art-portal.netlify.app" });
    }

    console.log(`✅ Birthday Check Complete. ${adminNotifs.length} student(s) flagged.`);
  } catch (err) {
    console.error("❌ Birthday Scheduler Error:", err);
  }
};

// ==========================================
// 4. ATTENDANCE REMINDERS (Teachers — every minute)
// ==========================================

// In-memory dedup: prevents re-sending the same notification within the same
// trigger window even if the cron fires twice (key includes date so it auto-
// expires across days without needing an explicit clear).
const sentAttendanceNotifs = new Set();

// Wipe the set at midnight so it never grows beyond one day's worth of keys
const clearSentSet = () => sentAttendanceNotifs.clear();

const checkAttendanceReminders = async () => {
  if (!setupVapid()) return;

  const DAYS_OF_WEEK = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const CLASS_DURATION_MIN = 60;
  const TRIGGER_OFFSETS_MIN = [0, 30]; // fire at class end, then again 30 min later

  // ── Timezone-safe "now" in IST (UTC+5:30) ──────────────────────────────────
  // Render servers run in UTC.  Class times ("6:00", "14:30") are stored in IST
  // because teachers enter them in their local timezone.  We must compare against
  // IST wall-clock time — never against raw UTC hours.
  const IST_OFFSET_MIN = 5 * 60 + 30; // 330 minutes east of UTC
  const nowUTC  = new Date();
  const nowIST  = new Date(nowUTC.getTime() + IST_OFFSET_MIN * 60 * 1000);

  // Minutes elapsed since IST midnight (0 – 1439)
  const nowTotalMin = nowIST.getUTCHours() * 60 + nowIST.getUTCMinutes();

  const todayDay = DAYS_OF_WEEK[nowIST.getUTCDay()];
  const yyyy = nowIST.getUTCFullYear();
  const mm   = String(nowIST.getUTCMonth() + 1).padStart(2, '0');
  const dd   = String(nowIST.getUTCDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;
  // ────────────────────────────────────────────────────────────────────────────

  try {
    const classes = await Class.find({ 'schedule.day': todayDay })
      .populate('teacher', 'pushSubscription fullName username');

    for (const cls of classes) {
      if (!cls.teacher || !cls.teacher.pushSubscription) continue;

      const todaySlots = cls.schedule.filter(s => s.day === todayDay);

      for (const slot of todaySlots) {
        const [sh, sm] = slot.time.split(':').map(Number);
        const classEndTotalMin = sh * 60 + (sm || 0) + CLASS_DURATION_MIN;
        const endH = Math.floor(classEndTotalMin / 60);
        const endM = classEndTotalMin % 60;
        if (endH >= 24) continue; // class runs past midnight — skip

        for (const offsetMin of TRIGGER_OFFSETS_MIN) {
          const triggerTotalMin = classEndTotalMin + offsetMin;

          // Fire only when current IST minute matches the trigger minute (±1 min
          // tolerance covers cron jitter — dedup Set prevents double-send)
          if (Math.abs(nowTotalMin - triggerTotalMin) > 1) continue;

          const notifKey = `${cls._id}_${slot.time}_${todayStr}_${offsetMin}`;
          if (sentAttendanceNotifs.has(notifKey)) continue;
          sentAttendanceNotifs.add(notifKey); // claim this slot immediately (prevents race)

          // Check if attendance was already submitted for this class today
          const hasAttendance = await Attendance.exists({ classId: cls._id, date: todayStr });
          if (hasAttendance) continue;

          // Build human-readable times for the notification body
          const fmtTime = (h, m) => {
            const ap   = h >= 12 ? 'PM' : 'AM';
            const hour = h % 12 || 12;
            return `${hour}:${String(m).padStart(2,'0')} ${ap}`;
          };
          const startTime = fmtTime(sh, sm || 0);
          const endTime   = fmtTime(endH, endM);

          const title = offsetMin === 0
            ? '📝 Mark Attendance Now'
            : '⏰ Attendance Still Pending';
          const body = offsetMin === 0
            ? `${cls.className} (${startTime}–${endTime}) just ended. Please mark today's attendance.`
            : `${cls.className} ended ${offsetMin} min ago and attendance hasn't been marked yet.`;

          const payload = JSON.stringify({
            title,
            body,
            tag: `attendance-${cls._id}-${todayStr}`, // replaces previous notif for same class
            requireInteraction: true,
            url: 'https://art-portal.netlify.app'
          });

          try {
            await webpush.sendNotification(cls.teacher.pushSubscription, payload);
            console.log(`   -> 🔔 [Attendance] ${cls.teacher.fullName || cls.teacher.username} | ${cls.className} | +${offsetMin}min`);
          } catch (err) {
            if (err.statusCode === 410 || err.statusCode === 404) {
              await User.findByIdAndUpdate(cls.teacher._id, { pushSubscription: null });
            } else {
              console.error(`   ❌ Push Error (${cls.teacher.username}):`, err.message);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('❌ Attendance Reminder Error:', err);
  }
};

// ==========================================
// START SCHEDULERS
// ==========================================
const startScheduler = () => {
  // Fee reminders: daily at 10:00 AM
  cron.schedule('0 10 * * *', checkFeeReminders);

  // Teacher month-end reminders: daily at 9:00 AM (only fires on reminder days)
  cron.schedule('0 9 * * *', checkTeacherReminders);

  // Birthday reminders (admins/teachers) + birthday wish (parents): daily at 8:00 AM
  cron.schedule('0 8 * * *', checkBirthdayReminders);

  // Attendance reminders: every minute — sends push when class ends without attendance
  cron.schedule('* * * * *', checkAttendanceReminders);

  // Clear in-memory dedup set at midnight
  cron.schedule('0 0 * * *', clearSentSet);

  console.log('⏰ Fee Scheduler started (Checks daily at 10:00 AM)');
  console.log('⏰ Teacher Reminder Scheduler started (Checks daily at 9:00 AM)');
  console.log('⏰ Birthday Reminder Scheduler started (Checks daily at 8:00 AM)');
  console.log('⏰ Attendance Reminder Scheduler started (Checks every minute)');
};

module.exports = startScheduler;
