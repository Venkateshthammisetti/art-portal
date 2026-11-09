// Admin Insights: students in/out, collection rate, attendance by class and teacher.
const test = require("node:test");
const assert = require("node:assert/strict");
const t = require("./helpers/memdb");
const { computeInsights } = require("../insights");

test.after(() => t.closeAll());

const { User, Class, Attendance, Feedback } = t.models;
const M = (n) => t.monthKey(n); // months from now

const build = () => {
  t.reset();
  const venky = t.add(User, { username: "venky", password: "x", role: "teacher", fullName: "Venky" });
  const priya = t.add(User, { username: "priya", password: "x", role: "teacher", fullName: "Priya" });
  const P = (o) => t.add(User, { password: "x", role: "parent", monthlyFee: 1000, ...o });
  // Started 3 months ago, paid every month
  const a = P({ username: "a", childName: "Aarav", registeredDate: `${M(-3)}-01`, joiningDate: `${M(-3)}-01`,
    payments: [M(-3), M(-2), M(-1), M(0)].map((m) => ({ month: m, status: "Paid", amount: 1000 })) });
  // Joined last month, pays 1500, unpaid this month
  const b = P({ username: "b", childName: "Bela", monthlyFee: 1500, registeredDate: `${M(-1)}-10`, joiningDate: `${M(-1)}-10`,
    payments: [{ month: M(-1), status: "Paid", amount: 1500 }] });
  // Went inactive this month
  const c = P({ username: "c", childName: "Chirag", registeredDate: `${M(-3)}-01`, isActive: false,
    payments: [{ month: M(-1), status: "Paid", amount: 1000 }], inactiveHistory: [{ inactiveFrom: M(0) }] });
  // Pass this month
  const d = P({ username: "d", childName: "Dev", registeredDate: `${M(-3)}-01`, passes: [{ month: M(0) }] });
  // Away last month, back this month
  const e = P({ username: "e", childName: "Esha", registeredDate: `${M(-3)}-01`, inactiveHistory: [{ inactiveFrom: M(-1), inactiveTo: M(-1) }],
    payments: [{ month: M(0), status: "Paid", amount: 800 }] });
  const sketch = t.add(Class, { className: "Sketching", teacher: venky._id, students: [a._id, b._id, c._id] });
  const paint = t.add(Class, { className: "Painting", teacher: priya._id, students: [d._id, e._id] });
  [a, b, c].forEach((u) => { u.assignedClass = sketch._id; });
  [d, e].forEach((u) => { u.assignedClass = paint._id; });

  const mark = (u, cls, date, status) => t.add(Attendance, { studentId: u._id, classId: cls._id, date, status });
  // This month: Sketching 2 sessions, 3/4 present; Painting 1 session, 1/2 present
  mark(a, sketch, `${M(0)}-02`, "Present"); mark(b, sketch, `${M(0)}-02`, "Present");
  mark(a, sketch, `${M(0)}-04`, "Present"); mark(b, sketch, `${M(0)}-04`, "Absent");
  mark(d, paint, `${M(0)}-03`, "Present"); mark(e, paint, `${M(0)}-03`, "Missed");
  // Last month: all present
  mark(a, sketch, `${M(-1)}-05`, "Present");
  t.add(Feedback, { studentId: a._id, teacherId: venky._id, month: M(0), feedbackText: "x", rating: 4 });
  return { venky, priya };
};

test("this month at a glance", async () => {
  build();
  const r = await computeInsights({ month: M(0), months: 4 });
  assert.deepEqual(r.months, [M(-3), M(-2), M(-1), M(0)]);
  const s = r.summary;
  assert.equal(s.active, 4, "Chirag left this month");
  assert.equal(s.left, 1);
  assert.equal(s.returned, 1, "Esha came back");
  assert.equal(s.joined, 0);
  assert.equal(s.passes, 1);
  // Due: Aarav 1000 (paid), Bela 1500 (unpaid), Esha 1000 (paid 800). Dev has a pass.
  assert.equal(s.expected, 3500);
  assert.equal(s.collected, 1800);
  assert.equal(s.collectionRate, 51.4);
  assert.equal(s.attendanceRate, 66.7, "4 of 6 present");

  const last = r.previous;
  assert.equal(last.joined, 1, "Bela joined last month");
  assert.equal(last.left, 1, "Esha was away last month");
  assert.equal(last.active, 4, "Aarav, Bela, Chirag, Dev");
  assert.equal(last.collectionRate, 77.8, "3500 of 4500: Dev unpaid");
  assert.equal(last.attendanceRate, 100);
});

test("attendance by class and teacher workload", async () => {
  const { venky } = build();
  const r = await computeInsights({ month: M(0) });
  assert.deepEqual(r.classes.map((c) => [c.className, c.attendanceRate, c.sessions, c.students]), [
    ["Painting", 50, 1, 2],
    ["Sketching", 75, 2, 2],
  ], "lowest attendance first; Chirag (inactive) not counted");
  const v = r.teachers.find((x) => String(x.teacherId) === String(venky._id));
  assert.equal(v.classes, 1);
  assert.equal(v.students, 2);
  assert.equal(v.reportsWritten, 1);
  assert.equal(v.reportsDue, 2);
  assert.equal(v.attendanceRate, 75);
  assert.equal(r.unassigned, 0);
});

test("endpoint", async () => {
  build();
  const api = await t.serve((app) => app.use("/api", require("../insights").router));
  const r = await api("GET", `/api/admin/insights?month=${M(-1)}&months=2`);
  assert.equal(r.status, 200);
  assert.equal(r.json.month, M(-1));
  assert.equal(r.json.trend.length, 2);
  const bad = await api("GET", "/api/admin/insights?month=nonsense");
  assert.equal(bad.json.month, M(0), "bad month falls back to this month");
});
