// "Needs attention": what an admin should look at today, computed on the server
// so the Admin home screen and the 9 AM push use the same numbers.
const User = require("./models/User");
const Class = require("./models/Class");
const Attendance = require("./models/Attendance");
const ResetRequest = require("./models/ResetRequest");
const { unpaidMonths } = require("./fees");

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const CLASS_MIN = 60;
const istNow = () => new Date(Date.now() + 330 * 60000);
const istDateKey = (offsetDays = 0) => new Date(istNow().getTime() + offsetDays * 86400000).toISOString().slice(0, 10);
const prevMonth = (ym) => { const [y, m] = ym.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; };
const first = (s) => String(s || "").trim().split(/\s+/)[0];

// Students whose last `n` recorded classes were all missed (Absent or Missed).
// Returns Map studentId -> { misses, lastPresent, streakStart }
const absenceStreaks = async (studentIds = null, n = 3) => {
  const since = istDateKey(-75);
  const q = { date: { $gte: since } };
  if (studentIds) q.studentId = { $in: studentIds };
  const recs = await Attendance.find(q).select("studentId date status").lean();
  const by = new Map();
  recs.forEach((r) => {
    const k = String(r.studentId);
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(r);
  });
  const out = new Map();
  by.forEach((list, k) => {
    list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    let misses = 0;
    for (const r of list) { if (r.status === "Present") break; misses++; }
    if (misses >= n) {
      const lastPresent = list.find((r) => r.status === "Present");
      // first missed class of this run: a "known" mark is tied to it, so it
      // lapses on its own once the student attends and later misses again
      out.set(k, { misses, lastPresent: lastPresent ? lastPresent.date : null, streakStart: list[misses - 1].date });
    }
  });
  return out;
};

// The "I'm aware" mark that covers this run of absences, if any
const ackFor = (student, streak, test) =>
  (student.checkInAcks || []).find((a) => a.streakStart === streak.streakStart && test(a)) || null;

const computeAttention = async () => {
  const today = istDateKey();
  const thisMonth = today.slice(0, 7);
  const parents = await User.find({ role: "parent" })
    .select("username fullName childName phone isActive assignedClass registeredDate joiningDate createdAt monthlyFee payments passes inactiveHistory feeChangeHistory feeOverrides paymentProofs absenceNotices checkInAcks")
    .lean();
  const active = parents.filter((p) => p.isActive !== false);
  const name = (p) => p.childName || p.fullName || p.username;

  // 1. payment proofs waiting
  const proofs = [];
  parents.forEach((p) => (p.paymentProofs || []).forEach((x) => {
    if ((x.status || "pending") === "pending") proofs.push({ userId: p._id, child: name(p), months: x.months || [], amount: x.amount || 0, at: x.at });
  }));
  proofs.sort((a, b) => new Date(b.at) - new Date(a.at));

  // 2. password reset requests
  const resets = (await ResetRequest.find({ resolved: false }).sort({ at: -1 }).limit(20).lean())
    .map((r) => ({ id: r._id, userId: r.userId, who: r.userId ? `${r.fullName || r.username}${r.childName ? ` (${r.childName})` : ""}` : `"${r.identifier}" (no matching account)`, at: r.at }));

  // 3. fees overdue: an unpaid month before this one (so 30+ days old)
  const overdue = [];
  active.forEach((p) => {
    const months = unpaidMonths(p, prevMonth(thisMonth));
    if (months.length) overdue.push({ userId: p._id, child: name(p), months: months.length, amount: months.reduce((s, m) => s + (m.amount || 0), 0), oldest: months[0].month });
  });
  overdue.sort((a, b) => b.amount - a.amount);

  // 4. students who missed their last 3 classes
  const streaks = await absenceStreaks(active.map((p) => p._id));
  const missingAll = active.filter((p) => streaks.has(String(p._id)))
    .map((p) => {
      const st = streaks.get(String(p._id));
      const adminAck = ackFor(p, st, (a) => a.role === "admin");
      const teacherAck = ackFor(p, st, (a) => a.role === "teacher");
      return { userId: p._id, child: name(p), parent: p.fullName || "", phone: p.phone || "", ...st,
        known: !!adminAck, knownNote: adminAck?.note || "", teacherNote: teacherAck ? (teacherAck.note || "Teacher is aware") : "" };
    })
    .sort((a, b) => b.misses - a.misses);
  const missing = missingAll.filter((m) => !m.known);
  const missingKnown = missingAll.filter((m) => m.known);

  // 5. classes that ended today without attendance
  const now = istNow();
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const todayName = DAYS[now.getUTCDay()];
  const utcToday = new Date().toISOString().slice(0, 10);
  const classes = await Class.find({ "schedule.day": todayName }).populate("teacher", "fullName").lean();
  const unmarked = [];
  for (const c of classes) {
    for (const s of (c.schedule || []).filter((x) => x.day === todayName && x.time)) {
      const [h, m] = String(s.time).split(":").map(Number);
      if (Number.isNaN(h) || h * 60 + (m || 0) + CLASS_MIN > nowMin) continue; // not over yet
      const marked = await Attendance.exists({ classId: c._id, date: { $in: [today, utcToday] } });
      if (!marked) unmarked.push({ classId: c._id, className: c.className, time: s.time, teacher: c.teacher?.fullName || "No teacher" });
    }
  }

  // 6. parents who said their child can't attend today
  const notices = [];
  active.forEach((p) => (p.absenceNotices || []).forEach((n) => {
    if (n.date === today) notices.push({ userId: p._id, child: name(p), time: n.time || "", reason: n.reason || "" });
  }));

  const counts = { proofs: proofs.length, resets: resets.length, overdue: overdue.length, missing: missing.length, unmarked: unmarked.length, notices: notices.length };
  return {
    today,
    counts,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    overdueAmount: overdue.reduce((s, o) => s + o.amount, 0),
    items: { proofs: proofs.slice(0, 20), resets, overdue: overdue.slice(0, 30), missing: missing.slice(0, 30), missingKnown: missingKnown.slice(0, 30), unmarked, notices },
  };
};

// One line for the 9 AM push, or null when nothing needs attention
const summaryLine = (a) => {
  const c = a.counts;
  const bits = [
    c.proofs && `${c.proofs} payment proof${c.proofs > 1 ? "s" : ""} to check`,
    c.resets && `${c.resets} password reset${c.resets > 1 ? "s" : ""}`,
    c.overdue && `${c.overdue} overdue fee${c.overdue > 1 ? "s" : ""} (₹${a.overdueAmount.toLocaleString("en-IN")})`,
    c.missing && `${c.missing} student${c.missing > 1 ? "s" : ""} missing classes`,
    c.notices && `${c.notices} away today`,
  ].filter(Boolean);
  return bits.length ? bits.join(" · ") : null;
};

module.exports = { computeAttention, absenceStreaks, ackFor, summaryLine, istDateKey, first };
