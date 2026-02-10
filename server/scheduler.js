const cron = require('node-cron');
const webpush = require('web-push');
const User = require('./models/User'); // ✅ Correct path

const checkFeeReminders = async () => {
  // 🔑 SETUP KEYS (Inside function to avoid crash on startup)
  try {
    webpush.setVapidDetails(
      'mailto:thevenkyart@gmail.com', 
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  } catch (err) {
    console.error("⚠️ VAPID Key Error:", err.message);
    return;
  }

  const today = new Date();
  const day = today.getDate();

  // 🗓️ RULE: Run only on 1st, 5th, 10th, 15th, 20th, 25th, 30th
  // If today is NOT one of these days, stop here.
  if (day !== 1 && day % 5 !== 0) {
    // console.log(`📅 Today is day ${day}, skipping fee check.`);
    return; 
  }

  console.log(`⏳ Running Fee Reminder Check for Day ${day}...`);

  try {
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    
    // Find all users
    const students = await User.find({});
    
    let count = 0;
    for (const student of students) {
      if (!student.pushSubscription) continue;

      // Check if they have PAID for the CURRENT MONTH
      const hasPaid = student.payments && student.payments.some(
        p => p.month === currentMonthStr && p.status === 'Paid'
      );

      // 🚀 If NOT paid, send REAL reminder
      if (!hasPaid) {
        const payload = JSON.stringify({
          title: `📅 Fee Reminder: ${currentMonthStr}`,
          body: `Gentle reminder: Fees for your child  ${student.childName} are due.Please pay the fees before 5th of every month.`,
          url: "https://art-portal.netlify.app/#fees" // ✨ Deep link to Fee Tab
        });

        try {
          await webpush.sendNotification(student.pushSubscription, payload);
          count++;
          console.log(`   -> 🔔 Sent reminder to ${student.childName}`);
        } catch (error) {
          if (error.statusCode === 410 || error.statusCode === 404) {
             // Subscription expired
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

const startFeeScheduler = () => {
  // ⏰ PRODUCTION SCHEDULE: Run every day at 10:00 AM
  cron.schedule('0 10 * * *', checkFeeReminders);
  
  console.log('⏰ Fee Scheduler started (Checks daily at 10:00 AM)');
};

module.exports = startFeeScheduler;