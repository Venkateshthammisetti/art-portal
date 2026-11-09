// Watch-only access check: login pass, rule coverage, and that nothing is blocked.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

process.env.AUTH_SECRET = "test-auth-secret";
process.env.CHATBOT_SECRET = "test-chat-secret";
const t = require("./helpers/memdb");
const school = require("./helpers/school");
const watch = require("../authWatch");

test.after(() => t.closeAll());

test("login pass: signed, tamper-proof, expires; the chatbot pass also counts", () => {
  const user = { _id: "a".repeat(24), role: "teacher" };
  const token = watch.signAuthToken(user);
  assert.deepEqual({ ...watch.verifyToken(token), exp: 0 }, { uid: user._id, role: "teacher", exp: 0 });

  const [payload, sig] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ uid: user._id, role: "admin", exp: Date.now() + 1e6 })).toString("base64url");
  assert.equal(watch.verifyToken(`${forged}.${sig}`), null, "changing the role breaks the signature");
  assert.equal(watch.verifyToken(`${payload}.x${sig}`), null);
  assert.equal(watch.verifyToken("nonsense"), null);

  const realNow = Date.now;
  Date.now = () => realNow() + 31 * 86400000;
  try { assert.equal(watch.verifyToken(token), null, "expires after 30 days"); } finally { Date.now = realNow; }

  const { signChatToken } = require("../chatbot");
  assert.equal(watch.verifyToken(signChatToken(user)).uid, user._id);
});

test("every API route has a planned rule", () => {
  const routes = [];
  const src = fs.readFileSync(path.join(__dirname, "..", "index.js"), "utf8");
  for (const m of src.matchAll(/app\.(get|post|put|delete|patch)\(\s*["'`]([^"'`]+)["'`]/g)) routes.push(`${m[1].toUpperCase()} ${m[2]}`);
  const fakeUpload = { single: () => (req, res, next) => next() };
  const mounted = [
    ["/api", require("../parentSelf")(fakeUpload)],
    ["/api", require("../classNotes")],
    ["/api", require("../checkins")],
    ["/api", watch.router],
    ["/api/leads", require("../leads").router],
    ["/api/chatbot", require("../chatbot").router],
  ];
  for (const [base, router] of mounted) {
    for (const layer of router.stack) {
      if (!layer.route) continue;
      for (const method of Object.keys(layer.route.methods)) routes.push(`${method.toUpperCase()} ${base}${layer.route.path}`);
    }
  }
  assert.ok(routes.length > 80, `found ${routes.length} routes`);
  const missing = routes.filter((r) => !(r in watch.RULES));
  assert.deepEqual(missing, [], "add these to RULES in server/authWatch.js");
});

test("planned rules", async () => {
  const s = school();
  const sibling = t.add(t.models.User, { username: "ravi2", password: "x", role: "parent", childName: "Anya", phone: "+91 99636-13404" });
  const as = (u) => ({ uid: String(u._id), role: u.role });
  const R = watch.RULES;
  assert.equal(await watch.verdict(R["POST /api/login"], null, {}), null);
  assert.equal(await watch.verdict(R["GET /api/users/:id/credentials"], null, {}), "no-token");
  assert.equal(await watch.verdict(R["GET /api/users/:id/credentials"], { bad: true }, {}), "bad-token");
  assert.equal(await watch.verdict(R["GET /api/users/:id/credentials"], as(s.aarav), {}), "wrong-role");
  assert.equal(await watch.verdict(R["GET /api/users/:id/credentials"], as(s.admin), {}), null);
  const family = R["GET /api/parent/:id/family"];
  assert.equal(await watch.verdict(family, as(s.aarav), { id: String(s.aarav._id) }), null, "own data");
  assert.equal(await watch.verdict(family, as(s.aarav), { id: String(sibling._id) }), null, "sibling (same phone)");
  assert.equal(await watch.verdict(family, as(s.aarav), { id: String(s.diya._id) }), "not-own", "another family");
  assert.equal(await watch.verdict(R["GET /api/teacher/:id/classes"], as(s.teacher), { id: String(s.teacher._id) }), null);
  assert.equal(await watch.verdict(undefined, as(s.admin), {}), "no-rule");
});

test("watch mode never blocks, and the report lists what would be refused", async () => {
  const s = school();
  const api = await t.serve((app) => {
    app.use(watch.middleware);
    app.use("/api", watch.router);
    app.use("/api", require("../parentSelf")({ single: () => (req, res, next) => next() }));
    app.get("/api/users/:id/credentials", (req, res) => res.json({ ok: true }));
  });
  const pass = (u) => ({ Authorization: `Bearer ${watch.signAuthToken(u)}` });

  // No pass, a parent opening admin data, a parent opening another family: all still answered
  let r = await api("GET", `/api/users/${s.aarav._id}/credentials`);
  assert.equal(r.status, 200, "no pass: still allowed (watch only)");
  r = await api("GET", `/api/users/${s.aarav._id}/credentials`, undefined, pass(s.aarav));
  assert.equal(r.status, 200);
  r = await api("GET", `/api/parent/${s.diya._id}/family`, undefined, pass(s.aarav));
  assert.equal(r.status, 200);
  r = await api("GET", `/api/parent/${s.aarav._id}/family`, undefined, pass(s.aarav));
  assert.equal(r.status, 200);
  assert.ok(r.json.children[0].authToken, "siblings come with their own login pass");
  r = await api("GET", "/api/users/zzz/credentials", undefined, { Authorization: "Bearer forged.sig" });
  assert.equal(r.status, 200);
  await t.wait(50);

  r = await api("GET", "/api/admin/auth-watch", undefined, pass(s.admin));
  const rep = r.json;
  assert.equal(rep.configured, true);
  assert.equal(rep.checked, 5, "five requests checked before the report");
  const find = (reason) => rep.rows.find((x) => x.reason === reason);
  assert.equal(find("no-token").route, "/api/users/:id/credentials");
  assert.equal(find("wrong-role").role, "parent");
  assert.equal(find("wrong-role").lastUserName, "Aarav");
  assert.equal(find("not-own").route, "/api/parent/:id/family");
  assert.equal(find("bad-token").count, 1);
  assert.equal(rep.wouldBlock, 4, "own family lookup is fine");
  assert.ok(find("not-own").reasonText.length > 10, "plain-language reason for Admin");
});
