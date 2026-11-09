// Admissions CRM: enquiry -> demo -> enrolled parent, with automatic follow-ups.
const test = require("node:test");
const assert = require("node:assert/strict");
const t = require("./helpers/memdb");
const school = require("./helpers/school");

test.after(() => t.closeAll());

test("lead journey from enquiry to enrolled parent", async () => {
  const s = school();
  const api = await t.serve((app) => app.use("/api/leads", require("../leads").router));
  t.pushes();

  let r = await api("POST", "/api/leads", { parentName: "", phone: "" });
  assert.equal(r.status, 400, "name and phone required");

  r = await api("POST", "/api/leads", { parentName: "Lakshmi", phone: "+91 90000 11111", childName: "Tara", source: "Instagram", by: "crm1" });
  const lead = r.json.lead;
  assert.equal(lead.stage, "new");
  assert.equal(lead.followUps.length, 1, "first call is scheduled automatically");
  assert.equal(lead.followUps[0].type, "first_contact");

  r = await api("POST", "/api/leads", { parentName: "Lakshmi again", phone: "9000011111" });
  assert.equal(String(r.json.duplicateOf._id), String(lead._id), "same number is flagged as a duplicate");

  const demoAt = new Date(Date.now() + 3 * 86400000).toISOString();
  r = await api("POST", `/api/leads/${lead._id}/demo`, { date: demoAt, mode: "online", teacherId: s.teacher._id, by: "crm1" });
  assert.equal(r.json.stage, "demo_scheduled");
  assert.ok(r.json.followUps.some((f) => f.type === "first_contact" && f.done), "first call closed once a demo is booked");
  assert.ok(r.json.followUps.some((f) => f.type === "pre_demo" && !f.done), "confirmation the day before");
  await t.wait(30);
  assert.equal(t.pushes()[0]?.to, "Teacher", "teacher told about the demo");

  r = await api("POST", `/api/leads/${lead._id}/demo/outcome`, { status: "no_show", by: "crm1" });
  assert.equal(r.json.stage, "contacted");
  assert.ok(r.json.followUps.some((f) => f.type === "reschedule" && !f.done));

  await api("POST", `/api/leads/${lead._id}/demo`, { date: demoAt, mode: "online", by: "crm1" });
  r = await api("POST", `/api/leads/${lead._id}/demo/outcome`, { status: "attended", rating: 5, by: "crm1" });
  assert.equal(r.json.stage, "demo_done");
  assert.equal(r.json.followUps.filter((f) => f.type === "post_demo" && !f.done).length, 2, "two post-demo follow-ups");

  r = await api("POST", `/api/leads/${lead._id}/stage`, { stage: "converted" });
  assert.equal(r.status, 400, "converting goes through Convert");

  s.aarav.admissionId = "TVA7";
  r = await api("POST", `/api/leads/${lead._id}/convert`, { username: "ravi", password: "p" });
  assert.equal(r.status, 400, "username taken");
  r = await api("POST", `/api/leads/${lead._id}/convert`, { username: "lakshmi", password: "p", monthlyFee: 1500, classId: s.cls._id, by: "crm1" });
  assert.equal(r.json.lead.stage, "converted");
  assert.equal(r.json.parent.admissionId, "TVA8", "next admission number");
  assert.ok(r.json.lead.followUps.every((f) => f.done), "open follow-ups closed");
  const parent = t.all(t.models.User).find((u) => u.username === "lakshmi");
  assert.equal(String(parent.assignedClass), String(s.cls._id));
  assert.ok(s.cls.students.some((id) => String(id) === String(parent._id)), "Class.students kept in sync");
  assert.ok(r.json.lead.activities.length >= 5, "every step is in the activity log");
});
