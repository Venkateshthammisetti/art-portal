const cron = require('node-cron');
const webpush = require('web-push');
const User = require('./models/User'); // ✅ Correct path

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
// START SCHEDULERS
// ==========================================
const startScheduler = () => {
  // Fee reminders: daily at 10:00 AM
  cron.schedule('0 10 * * *', checkFeeReminders);

  // Teacher month-end reminders: daily at 9:00 AM (only fires on reminder days)
  cron.schedule('0 9 * * *', checkTeacherReminders);

  console.log('⏰ Fee Scheduler started (Checks daily at 10:00 AM)');
  console.log('⏰ Teacher Reminder Scheduler started (Checks daily at 9:00 AM)');
};

module.exports = startScheduler;
