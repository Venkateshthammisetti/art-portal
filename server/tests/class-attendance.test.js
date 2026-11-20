// Attendance progress per class (Teacher home + Admin overview)
const test = require("node:test");
const assert = require("node:assert/strict");
const t = require("./helpers/memdb");
const { classSummary } = require("../classAttendance");

test.after(() => t.closeAll());
const { User, Class, Attendance } = t.models;
const M = t.monthKey(0);

const build = () => {
  t.reset();
  const venky = t.add(User, { username: "venky", password: "x", role: "teacher", fullName: "Venky" });
  const priya = t.add(User, { username: "priya", password: "x", role: "teacher", fullName: "Priya" });
  const sketch = t.add(Class, { className: "Sketching", teacher: venky._id });
  const paint = t.add(Class, { className: "Painting", teacher: priya._id });
  const empty = t.add(Class, { className: "Clay", teacher: venky._id });
  const kid = (name, cls, o = {}) => t.add(User, { username: name, password: "x", role: "parent", childName: name, assignedClass: cls._id, ...o });
  const a = kid("a", sketch, { monthlyClassesTarget: 8 }), b = kid("b", sketch, { monthlyClassesTarget: 8 }); kid("gone", sketch, { isActive: false, monthlyClassesTarget: 12 });
  const c = kid("c", paint, { monthlyClassesTarget: 4 });
  const mark = (u, cls, d, status) => t.add(Attendance, { studentId: u._id, classId: cls._id, date: `${M}-${d}`, status });
  mark(a, sketch, "02", "Present"); mark(b, sketch, "02", "Present"); mark(a, sketch, "04", "Present"); mark(b, sketch, "04", "Missed");
  mark(c, paint, "03", "Absent"); mark(c, paint, "05", "Present");
  t.add(Attendance, { studentId: a._id, classId: sketch._id, date: `${t.monthKey(-1)}-10`, status: "Absent" }); // other month
  return { venky, priya, empty };
};

test("classes held, target and balance for each class, most left to do first", async () => {
  build();
  const r = await classSummary({ month: M });
  assert.deepEqual(r.classes.map((c) => [c.className, c.held, c.target, c.balance, c.students]), [
    ["Clay", 0, 8, 8, 0],
    ["Sketching", 2, 8, 6, 2],
    ["Painting", 2, 4, 2, 1],
  ], "target from the students' Classes / Month (8 when none); inactive student not counted");
  assert.deepEqual(r.totals, { held: 4, target: 20, balance: 16 });
  assert.equal(r.overall, 66.7, "4 of 6 present");
  assert.deepEqual(r.teachers.map((x) => x.name), ["Priya", "Venky"]);
  assert.equal(r.classes.find((c) => c.className === "Sketching").missed, 1);
});

test("one teacher's classes, and the endpoint", async () => {
  const { venky } = build();
  const r = await classSummary({ month: M, teacherId: String(venky._id) });
  assert.deepEqual(r.classes.map((c) => c.className), ["Clay", "Sketching"]);
  const api = await t.serve((app) => app.use("/api", require("../classAttendance").router));
  const res = await api("GET", `/api/attendance/class-summary?month=${M}&teacherId=${venky._id}`);
  assert.equal(res.status, 200);
  assert.equal(res.json.classes.length, 2);
  const bad = await api("GET", "/api/attendance/class-summary?month=nope");
  assert.equal(bad.json.month, M, "bad month falls back to this month");
});
