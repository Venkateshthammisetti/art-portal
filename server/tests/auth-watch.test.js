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
  // Every router mounted in index.js, found automatically so new ones can't be missed
  const fakeUpload = { single: () => (req, res, next) => next() };
  const mounts = [...src.matchAll(/app\.use\(\s*["'`](\/api[^"'`]*)["'`]\s*,\s*require\(\s*["'`]\.\/([\w-]+)["'`]\s*\)(\.router)?(\(\s*upload\s*\))?/g)];
  assert.ok(mounts.length >= 6, `found ${mounts.length} mounted routers`);
  for (const [, base, file] of mounts) {
    let mod = require(path.join("..", file));
    if (typeof mod === "function" && !mod.stack) mod = mod(fakeUpload); // parentSelf(upload)
    const router = mod.stack ? mod : mod.router;
    assert.ok(router && router.stack, `${file} exports a router`);
    for (const layer of router.stack) {
      if (!layer.route) continue;
      for (const method of Object.keys(layer.route.methods)) routes.push(`${method.toUpperCase()} ${base}${layer.route.path}`);
    }
  }
  // routers mounted through a variable
  for (const [base, router] of [["/api", watch.router], ["/api/chatbot", require("../chatbot").router]]) {
    for (const layer of router.stack) {
      if (!layer.route) continue;
      for (const method of Object.keys(layer.route.methods)) routes.push(`${method.toUpperCase()} ${base}${layer.route.path}`);
    }
  }
  assert.ok(routes.some((r) => r.startsWith("GET /api/resources")), "Academic Resources routes are checked");
  assert.ok(routes.length > 90, `found ${routes.length} routes`);
  const missing = [...new Set(routes)].filter((r) => !(r in watch.RULES));
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

test("passes are renewed while people use the app; expired and forged ones are told apart", async () => {
  await watch.flush(); // drop counts left over from the test before
  const s = school();
  const api = await t.serve((app) => {
    app.use(watch.middleware);
    app.use("/api", watch.router);
    app.get("/api/users/:id/credentials", (req, res) => res.json({ ok: true }));
    app.get("/ping", (req, res) => res.send("pong"));
  });
  const DAY = 86400000;
  const crypto = require("crypto");
  const tokenFor = (data, secret = process.env.AUTH_SECRET) => {
    const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
    return `${payload}.${crypto.createHmac("sha256", secret).update(payload).digest("base64url")}`;
  };
  const admin = String(s.admin._id);
  const hit = (token, method = "GET") => api(method, `/api/users/${s.aarav._id}/credentials`, undefined, token ? { Authorization: `Bearer ${token}` } : {});
  const renewed = (r) => r.headers.get("x-auth-token");

  // Fresh pass: nothing to renew
  let r = await hit(watch.signAuthToken({ _id: admin, role: "admin" }));
  assert.equal(r.status, 200);
  assert.equal(renewed(r), null, "a pass with 30 days left isn't renewed");

  // 10 days left: renewed, and the new one is genuine, for the same person, with the role
  r = await hit(tokenFor({ uid: admin, role: "admin", exp: Date.now() + 10 * DAY }));
  const fresh = watch.verifyToken(renewed(r));
  assert.ok(fresh, "renewed pass is genuine");
  assert.equal(fresh.uid, admin);
  assert.equal(fresh.role, "admin");
  assert.ok(fresh.exp - Date.now() > 29 * DAY, "good for another 30 days");

  // Chatbot pass (no role, other key): renewed into a login pass with the role from the database
  r = await hit(tokenFor({ uid: admin, exp: Date.now() + 3 * DAY }, process.env.CHATBOT_SECRET));
  assert.equal(watch.verifyToken(renewed(r)).role, "admin");

  // Ran out 20 days ago: still genuine, so renewed and treated as signed in
  r = await hit(tokenFor({ uid: admin, exp: Date.now() - 20 * DAY }, process.env.CHATBOT_SECRET));
  assert.ok(watch.verifyToken(renewed(r)), "recently expired pass is renewed");

  // Ran out 90 days ago: not renewed, counted as expired
  r = await hit(tokenFor({ uid: admin, role: "admin", exp: Date.now() - 90 * DAY }));
  assert.equal(r.status, 200, "never blocked");
  assert.equal(renewed(r), null);

  // Signed with an unknown key: not genuine
  r = await hit(tokenFor({ uid: admin, role: "admin", exp: Date.now() + 10 * DAY }, "some-other-key"));
  assert.equal(renewed(r), null);

  // Pass for an account that no longer exists: not renewed
  r = await hit(tokenFor({ uid: "f".repeat(24), role: "admin", exp: Date.now() + 5 * DAY }));
  assert.equal(renewed(r), null);

  // Keep-awake pings are never counted
  await api("HEAD", "/ping"); await api("GET", "/ping");
  await t.wait(50);

  r = await api("GET", "/api/admin/auth-watch", undefined, { Authorization: `Bearer ${watch.signAuthToken({ _id: admin, role: "admin" })}` });
  const rows = r.json.rows;
  const reasons = Object.fromEntries(Object.entries(r.json.byReason));
  assert.equal(reasons["expired-token"], 1, "the 90-day-old pass");
  assert.equal(reasons["bad-token"], 2, "unknown key + deleted account");
  assert.ok(!rows.some((x) => x.route === "/ping"), "ping not listed");
  assert.ok(!rows.some((x) => x.reason === "wrong-role"), "renewed admin passes count as admin");
  assert.equal(r.json.checked, 7, "seven credential calls checked, pings left out");
});
