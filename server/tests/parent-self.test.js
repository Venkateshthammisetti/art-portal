// Parent self-service: forgot password, contact edits, absence notices,
// report conversations, payment proofs (and Admin's review), siblings, referrals.
const test = require("node:test");
const assert = require("node:assert/strict");
const t = require("./helpers/memdb");
const school = require("./helpers/school");

test.after(() => t.closeAll());

// Stand-in for the Cloudinary upload middleware: pretends a file was uploaded
const fakeUpload = { single: () => (req, res, next) => { req.file = { path: "https://img.example/proof.jpg" }; next(); } };
const mount = (app) => app.use("/api", require("../parentSelf")(fakeUpload));

test("forgot password tells the admins and never reveals the account", async () => {
  const s = school();
  const api = await t.serve(mount);
  t.pushes();

  let r = await api("POST", "/api/parent/forgot-password", { identifier: "" });
  assert.equal(r.status, 400);

  r = await api("POST", "/api/parent/forgot-password", { identifier: "+91 99636 13404" });
  assert.deepEqual(r.json, { ok: true });
  assert.equal(JSON.stringify(r.json).includes("Ravi"), false, "the reply doesn't say whose account it is");
  await t.wait(50);
  let sent = t.pushes();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "Admin");
  assert.match(sent[0].body, /Ravi Kumar \(Aarav\)/);

  await api("POST", "/api/parent/forgot-password", { identifier: "RAVI" });
  await t.wait(50);
  t.pushes();
  const open = t.all(t.models.ResetRequest).filter((x) => !x.resolved);
  assert.equal(open.length, 1, "one open request per account");

  r = await api("POST", "/api/parent/forgot-password", { identifier: "nobody" });
  assert.equal(r.json.ok, true, "same answer when nothing matches");
  await t.wait(50);
  sent = t.pushes();
  assert.match(sent[0].body, /no matching account/);

  r = await api("GET", "/api/admin/reset-requests");
  assert.equal(r.json.length, 2);
  await api("PUT", `/api/admin/reset-requests/${r.json[0]._id}/resolve`);
  r = await api("GET", "/api/admin/reset-requests");
  assert.equal(r.json.length, 1);
  assert.equal(s.aarav.password, "x", "passwords are never changed or sent");
});

test("contact details", async () => {
  const s = school();
  const api = await t.serve(mount);
  let r = await api("PUT", `/api/parent/${s.aarav._id}/contact`, { phone: "123" });
  assert.equal(r.status, 400);
  r = await api("PUT", `/api/parent/${s.aarav._id}/contact`, { email: "not-an-email" });
  assert.equal(r.status, 400);
  r = await api("PUT", `/api/parent/${s.aarav._id}/contact`, { phone: "98765 43210", email: "ravi@example.com", location: "Kukatpally", role: "admin" });
  assert.deepEqual(r.json, { phone: "98765 43210", email: "ravi@example.com", location: "Kukatpally" });
  assert.equal(s.aarav.role, "parent", "other fields are ignored");
  r = await api("PUT", `/api/parent/${s.teacher._id}/contact`, { location: "x" });
  assert.equal(r.status, 404, "only parent accounts");
});

test("absence notice reaches the teacher", async () => {
  const s = school();
  const api = await t.serve(mount);
  t.pushes();
  let r = await api("POST", `/api/parent/${s.diya._id}/absence`, { date: t.dayKey(-1) });
  assert.equal(r.status, 400, "past class");
  r = await api("POST", `/api/parent/${s.diya._id}/absence`, { date: t.dayKey(2), time: "17:00", reason: "Family function" });
  assert.equal(r.json.absenceNotices.length, 1);
  await t.wait(50);
  const sent = t.pushes();
  assert.equal(sent[0].to, "Teacher");
  assert.match(sent[0].title, /Diya can't attend/);
  r = await api("POST", `/api/parent/${s.diya._id}/absence`, { date: t.dayKey(2), time: "17:00", reason: "Changed" });
  assert.equal(r.json.absenceNotices.length, 1, "same class replaces the notice");
  r = await api("DELETE", `/api/parent/${s.diya._id}/absence/${r.json.absenceNotices[0]._id}`);
  assert.equal(r.json.absenceNotices.length, 0);
});

test("report conversation", async () => {
  const s = school();
  const report = t.add(t.models.Feedback, { studentId: s.aarav._id, teacherId: s.teacher._id, month: s.lastMonth, feedbackText: "Great work", rating: 5 });
  const api = await t.serve(mount);
  t.pushes();

  let r = await api("POST", `/api/feedback/${report._id}/messages`, { from: "parent", userId: s.diya._id, text: "Hi" });
  assert.equal(r.status, 403, "another parent can't write on this report");
  r = await api("POST", `/api/feedback/${report._id}/messages`, { from: "parent", userId: s.aarav._id, text: "Thank you!" });
  assert.equal(r.json.messages.length, 1);
  await t.wait(50);
  assert.equal(t.pushes()[0].to, "Teacher");

  r = await api("GET", `/api/feedback/teacher/${s.teacher._id}/threads`);
  assert.equal(r.json.length, 1);
  assert.equal(r.json[0].unread, true);
  await api("PUT", `/api/feedback/${report._id}/read`, { as: "teacher", userId: s.teacher._id });
  r = await api("GET", `/api/feedback/teacher/${s.teacher._id}/threads`);
  assert.equal(r.json[0].unread, false);

  await api("POST", `/api/feedback/${report._id}/messages`, { from: "teacher", userId: s.teacher._id, text: "Keep it up" });
  await t.wait(50);
  const sent = t.pushes();
  assert.equal(sent[0].to, "Ravi");
  assert.match(sent[0].title, /teacher replied/);
});

test("payment proof: parent sends, admin approves or rejects", async () => {
  const s = school();
  const api = await t.serve(mount);
  t.pushes();

  let r = await api("POST", `/api/parent/${s.diya._id}/payment-proof`, { months: "", amount: 1500 });
  assert.equal(r.status, 400, "months required");
  r = await api("POST", `/api/parent/${s.diya._id}/payment-proof`, { months: `${s.thisMonth}`, amount: 1500, note: "UPI" });
  assert.equal(r.json.paymentProofs.length, 1);
  await t.wait(50);
  assert.equal(t.pushes()[0].to, "Admin");

  r = await api("GET", "/api/admin/payment-proofs");
  assert.equal(r.json.length, 2, "Aarav's earlier proof and Diya's new one");
  const diyaProof = r.json.find((p) => p.childName === "Diya");

  r = await api("PUT", `/api/admin/payment-proofs/${s.diya._id}/${diyaProof.proofId}`, { action: "reject" });
  assert.equal(r.status, 400, "rejecting needs a reason");
  r = await api("PUT", `/api/admin/payment-proofs/${s.diya._id}/${diyaProof.proofId}`, { action: "approve", amounts: { [s.thisMonth]: 1400 } });
  assert.deepEqual(r.json.recorded, [s.thisMonth]);
  assert.equal(s.diya.payments.find((p) => p.month === s.thisMonth).amount, 1400);
  await t.wait(50);
  assert.match(t.pushes()[0].title, /Payment received/);
  r = await api("PUT", `/api/admin/payment-proofs/${s.diya._id}/${diyaProof.proofId}`, { action: "approve" });
  assert.equal(r.status, 409, "can't review twice");

  const aaravProof = s.aarav.paymentProofs[0];
  r = await api("PUT", `/api/admin/payment-proofs/${s.aarav._id}/${aaravProof._id}`, { action: "reject", note: "Screenshot is blurry" });
  assert.equal(r.json.status, "rejected");
  await t.wait(50);
  assert.match(t.pushes()[0].body, /blurry/);
  r = await api("GET", "/api/admin/payment-proofs");
  assert.equal(r.json.length, 0);
});

test("siblings share a phone number; passwords never sent", async () => {
  const s = school();
  t.add(t.models.User, { username: "ravi2", password: "secret", role: "parent", childName: "Anya", phone: "99636-13404", pushSubscription: { who: "x" } });
  const api = await t.serve(mount);
  const r = await api("GET", `/api/parent/${s.aarav._id}/family`);
  assert.deepEqual(r.json.children.map((c) => c.childName).sort(), ["Aarav", "Anya"]);
  assert.ok(r.json.children.every((c) => !("password" in c) && !("pushSubscription" in c)));
});

test("referrals count families, not siblings", async () => {
  const s = school();
  const P = (o) => t.add(t.models.User, { password: "x", role: "parent", ...o });
  P({ username: "a1", childName: "Ira", phone: "9000000001", referredBy: "ravi" });
  P({ username: "a2", childName: "Ishaan", phone: "9000000001", referredBy: "Ravi" }); // same family
  P({ username: "b1", childName: "Zoya", phone: "9000000002", referredBy: "Ravi Kumar" }); // by name
  P({ username: "c1", childName: "Om", phone: "9000000003", referredBy: "someone else" });
  const api = await t.serve(mount);
  const r = await api("GET", `/api/parent/${s.aarav._id}/referrals`);
  assert.equal(r.json.count, 2);
});
