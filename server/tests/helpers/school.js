// A small made-up academy for tests: one admin, one teacher, one class with
// three active students and one inactive student, dated relative to today.
const t = require("./memdb");

const { User, Class, Attendance, ResetRequest } = t.models;

const school = ({ classTimes = [] } = {}) => {
  t.reset();
  const thisMonth = t.monthKey(0);
  const lastMonth = t.monthKey(-1);

  const teacher = t.add(User, { username: "teach", password: "x", role: "teacher", fullName: "Venky", pushSubscription: { who: "Teacher" } });
  const admin = t.add(User, { username: "admin", password: "x", role: "admin", fullName: "Admin", pushSubscription: { who: "Admin" } });
  const parent = (o) => t.add(User, { password: "x", role: "parent", monthlyFee: 1500, registeredDate: `${lastMonth}-01`, ...o });

  const aarav = parent({
    username: "ravi", fullName: "Ravi Kumar", childName: "Aarav", phone: "9963613404",
    pushSubscription: { who: "Ravi" },
    payments: [{ month: thisMonth, status: "Paid", amount: 1500 }],
    paymentProofs: [{ months: [lastMonth], amount: 1500, url: "x", status: "pending" }],
    absenceNotices: [{ date: t.dayKey(0), time: "10:00", reason: "Unwell" }],
  });
  const diya = parent({
    username: "meena", fullName: "Meena", childName: "Diya", phone: "9876500002",
    pushSubscription: { who: "Meena" },
    payments: [{ month: lastMonth, status: "Paid", amount: 1500 }],
  });
  const kiran = parent({
    username: "suresh", fullName: "Suresh", childName: "Kiran", phone: "9876500003",
    passes: [{ month: lastMonth }], notifyPrefs: { classNotes: false }, pushSubscription: { who: "Suresh" },
  });
  const gone = parent({ username: "old", childName: "Old", isActive: false });

  const cls = t.add(Class, {
    className: "Sketching",
    teacher: teacher._id,
    students: [aarav._id, diya._id, kiran._id],
    schedule: classTimes.map((min) => ({ day: t.istDayName(0), time: t.istTime(min), link: "https://meet.example/abc" })),
  });
  [aarav, diya, kiran].forEach((u) => { u.assignedClass = cls._id; });

  const mark = (student, daysAgo, status) =>
    t.add(Attendance, { studentId: student._id, classId: cls._id, date: t.dayKey(-daysAgo), status });

  return { teacher, admin, aarav, diya, kiran, gone, cls, mark, thisMonth, lastMonth, ResetRequest };
};

module.exports = school;
