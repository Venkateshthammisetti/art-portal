// Admin "Needs attention today", the 9:05 AM summary push, and "I'm aware" check-ins.
const test = require("node:test");
const assert = require("node:assert/strict");
const t = require("./helpers/memdb");
const school = require("./helpers/school");
const { computeAttention, summaryLine, absenceStreaks, ackFor } = require("../attention");
const scheduler = require("../scheduler");

test.after(() => t.closeAll());

const mountAll = (app) => {
  app.use("/api", require("../checkins"));
  app.get("/api/admin/attention", async (req, res) => res.json(await computeAttention()));
};

test("attention list", { skip: t.crossesMidnight(-95, 20) && "class times would cross midnight" }, async () => {
  const s = school({ classTimes: [-90, 15] });
  s.mark(s.diya, 1, "Absent"); s.mark(s.diya, 3, "Missed"); s.mark(s.diya, 5, "Absent"); s.mark(s.diya, 8, "Present");
  s.mark(s.aarav, 1, "Present"); s.mark(s.aarav, 3, "Absent");
  t.add(s.ResetRequest, { identifier: "ravi", userId: s.aarav._id, fullName: "Ravi Kumar", childName: "Aarav", username: "ravi" });

  const a = await computeAttention();
  assert.equal(a.counts.proofs, 1);
  assert.equal(a.items.proofs[0].child, "Aarav");
  assert.equal(a.counts.resets, 1);
  // Overdue: Aarav (last month unpaid). Diya paid, Kiran had a pass, inactive ignored.
  assert.deepEqual(a.items.overdue.map((o) => [o.child, o.amount]), [["Aarav", 1500]]);
  assert.equal(a.counts.missing, 1);
  assert.equal(a.items.missing[0].child, "Diya");
  assert.equal(a.items.missing[0].misses, 3);
  assert.ok(a.items.missing[0].phone, "phone included for WhatsApp");
  // Only the class that already ended counts as unmarked, not the one later today
  assert.deepEqual(a.items.unmarked.map((u) => u.time), [t.istTime(-90)]);
  assert.equal(a.counts.notices, 1);
  assert.equal(a.items.notices[0].reason, "Unwell");

  const line = summaryLine(a);
  assert.match(line, /1 payment proof to check/);
  assert.match(line, /1 overdue fee/);
  assert.equal(summaryLine({ counts: { proofs: 0, resets: 0, overdue: 0, missing: 0, unmarked: 0, notices: 0 }, overdueAmount: 0 }), null);

  s.mark(s.aarav, 0, "Present");
  assert.equal((await computeAttention()).counts.unmarked, 0, "marking today clears the unmarked class");

  t.pushes();
  await scheduler.sendAdminSummary();
  const sent = t.pushes();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "Admin");
});

test("absence streaks", async () => {
  const s = school();
  s.mark(s.diya, 1, "Absent"); s.mark(s.diya, 3, "Missed"); s.mark(s.diya, 5, "Absent");
  s.mark(s.aarav, 1, "Present"); s.mark(s.aarav, 3, "Absent");
  const st = await absenceStreaks([s.aarav._id, s.diya._id, s.kiran._id]);
  assert.deepEqual([...st.keys()], [String(s.diya._id)]);
  assert.equal(st.get(String(s.diya._id)).streakStart, t.dayKey(-5));
});

test("I'm aware: hides one absence run only", async () => {
  const s = school();
  s.mark(s.diya, 1, "Absent"); s.mark(s.diya, 3, "Missed"); s.mark(s.diya, 5, "Absent"); s.mark(s.diya, 8, "Present");
  const api = await t.serve(mountAll);

  let r = await api("GET", "/api/admin/attention");
  assert.equal(r.json.counts.missing, 1);

  r = await api("POST", `/api/checkins/${s.diya._id}`, { by: s.teacher._id, note: "Travelling till 20th" });
  assert.equal(r.json.ok, true);
  assert.equal(r.json.streakStart, t.dayKey(-5));
  r = await api("GET", "/api/admin/attention");
  assert.equal(r.json.counts.missing, 1, "a teacher's mark does not hide it from admin");
  assert.match(r.json.items.missing[0].teacherNote, /Travelling/);

  await api("POST", `/api/checkins/${s.diya._id}`, { by: s.admin._id });
  r = await api("GET", "/api/admin/attention");
  assert.equal(r.json.counts.missing, 0);
  assert.equal(r.json.items.missingKnown.length, 1);
  assert.doesNotMatch(summaryLine(r.json) || "", /missing classes/);

  s.mark(s.diya, 0, "Absent");
  r = await api("GET", "/api/admin/attention");
  assert.equal(r.json.counts.missing, 0, "another miss in the same run stays hidden");

  // Attends, then misses 3 in a row again: a new run shows again
  await t.models.Attendance.deleteMany({ studentId: s.diya._id });
  s.mark(s.diya, 12, "Absent"); s.mark(s.diya, 10, "Present"); s.mark(s.diya, 6, "Absent"); s.mark(s.diya, 4, "Missed"); s.mark(s.diya, 1, "Absent");
  r = await api("GET", "/api/admin/attention");
  assert.equal(r.json.counts.missing, 1);
  assert.equal(r.json.items.missingKnown.length, 0);

  await api("POST", `/api/checkins/${s.diya._id}`, { by: s.admin._id });
  await api("DELETE", `/api/checkins/${s.diya._id}?by=${s.admin._id}`);
  r = await api("GET", "/api/admin/attention");
  assert.equal(r.json.counts.missing, 1, "undo brings it back");

  r = await api("POST", `/api/checkins/${s.aarav._id}`, { by: s.teacher._id });
  assert.equal(r.status, 409, "student not on a run");
  r = await api("POST", `/api/checkins/${s.diya._id}`, { by: s.aarav._id });
  assert.equal(r.status, 403, "a parent cannot mark");

  await api("POST", `/api/checkins/${s.diya._id}`, { by: s.teacher._id });
  const run = (await absenceStreaks([s.diya._id])).get(String(s.diya._id));
  assert.ok(ackFor(s.diya, run, (a) => String(a.by) === String(s.teacher._id)));
  assert.equal(ackFor(s.diya, run, (a) => String(a.by) === String(s.admin._id)), null);
});
