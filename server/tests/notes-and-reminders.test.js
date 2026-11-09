// Class notes (teacher -> parents) and the scheduled reminder pushes.
const test = require("node:test");
const assert = require("node:assert/strict");
const t = require("./helpers/memdb");
const school = require("./helpers/school");
const scheduler = require("../scheduler");

test.after(() => t.closeAll());

test("class notes", async () => {
  const s = school();
  const api = await t.serve((app) => app.use("/api", require("../classNotes")));
  t.pushes();

  let r = await api("POST", "/api/class-notes", { classId: s.cls._id, teacherId: s.admin._id, text: "x" });
  assert.equal(r.status, 403, "only the class teacher can post");
  r = await api("POST", "/api/class-notes", { classId: s.cls._id, teacherId: s.teacher._id });
  assert.equal(r.status, 400, "empty note refused");
  r = await api("POST", "/api/class-notes", { classId: s.cls._id, teacherId: s.teacher._id, text: "x", date: t.dayKey(3) });
  assert.equal(r.status, 400, "future date refused");

  r = await api("POST", "/api/class-notes", { classId: s.cls._id, teacherId: s.teacher._id, text: "Shading on a sphere", homework: "Draw 3 fruits" });
  assert.equal(r.json.created, true);
  await t.wait(100);
  const sent = t.pushes();
  assert.deepEqual(sent.map((p) => p.to).sort(), ["Meena", "Ravi"], "Kiran turned class notes off");
  assert.match(sent[0].title, /Homework/);

  r = await api("POST", "/api/class-notes", { classId: s.cls._id, teacherId: s.teacher._id, text: "Shading (edited)", homework: "Draw 3 fruits" });
  await t.wait(100);
  assert.equal(r.json.created, false, "same day again edits the note");
  assert.equal(t.pushes().length, 0, "no second push");
  assert.equal(t.all(t.models.ClassNote).length, 1);

  r = await api("GET", `/api/class-notes/student/${s.aarav._id}`);
  assert.equal(r.json.length, 1);
  assert.equal(r.json[0].teacherId.fullName, "Venky");
  r = await api("GET", `/api/class-notes/student/${s.gone._id}`);
  assert.deepEqual(r.json, [], "student without a class");
  r = await api("GET", `/api/class-notes/teacher/${s.teacher._id}?since=${t.dayKey(0)}`);
  assert.equal(r.json.length, 1);

  const noteId = t.all(t.models.ClassNote)[0]._id;
  r = await api("DELETE", `/api/class-notes/${noteId}?teacherId=${s.admin._id}`);
  assert.equal(r.status, 403, "someone else cannot delete");
});

test("teacher is reminded 15 minutes before class, once", { skip: t.crossesMidnight(20) && "class time would cross midnight" }, async () => {
  school({ classTimes: [15] });
  t.pushes();
  await scheduler.checkTeacherClassReminders();
  const sent = t.pushes();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "Teacher");
  assert.match(sent[0].title, /15 minutes/);
  await scheduler.checkTeacherClassReminders();
  assert.equal(t.pushes().length, 0, "not repeated");
});

test("parents are reminded 30 minutes before class", { skip: t.crossesMidnight(35) && "class time would cross midnight" }, async () => {
  const s = school({ classTimes: [30] });
  s.kiran.notifyPrefs = { classReminders: false };
  t.pushes();
  await scheduler.checkClassReminders();
  const sent = t.pushes();
  assert.deepEqual(sent.map((p) => p.to).sort(), ["Meena", "Ravi"], "Kiran turned class reminders off");
  assert.match(sent.find((p) => p.to === "Ravi").body, /Aarav's Sketching class/);
});

test("report reminders are for last month and stop when all are sent", async () => {
  const s = school();
  const { Feedback } = t.models;
  t.add(Feedback, { studentId: s.aarav._id, teacherId: s.teacher._id, month: s.lastMonth, feedbackText: "x", rating: 4 });
  t.pushes();
  await scheduler.checkTeacherReportReminders(true);
  await t.wait(50);
  const sent = t.pushes();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "Teacher");
  assert.match(sent[0].title, /2 to send/);
  assert.match(sent[0].url, /#feedback/);

  t.add(Feedback, { studentId: s.diya._id, teacherId: s.teacher._id, month: s.lastMonth, feedbackText: "x", rating: 4 });
  t.add(Feedback, { studentId: s.kiran._id, teacherId: s.teacher._id, month: s.lastMonth, feedbackText: "x", rating: 4 });
  await scheduler.checkTeacherReportReminders(true);
  assert.equal(t.pushes().length, 0);
});
