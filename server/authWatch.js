// Watch-only access check (step 1 of protecting the API).
//
// Login now hands out a signed "login pass" (authToken) and the app sends it on
// every API call. This module works out who is calling each route and whether
// the planned rule for that route would allow it. NOTHING IS BLOCKED: requests
// the rules would refuse are only counted (per day, per route, per reason) so
// Admin can review them in "Security check" before the rules are switched on.
//
// Secret: AUTH_SECRET, falling back to CHATBOT_SECRET (so the chatbot pass that
// logged-in users already hold is also recognised).
const crypto = require("crypto");
const mongoose = require("mongoose");
const User = require("./models/User");

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const secrets = () => [process.env.AUTH_SECRET, process.env.CHATBOT_SECRET].filter(Boolean);
const sign = (payload, secret) => crypto.createHmac("sha256", secret).update(payload).digest("base64url");

// ---------- login pass ----------
const signAuthToken = (user) => {
  const [secret] = secrets();
  if (!secret || !user?._id) return null;
  const payload = Buffer.from(JSON.stringify({ uid: String(user._id), role: user.role, exp: Date.now() + TOKEN_TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
};

// { uid, role? } when valid, otherwise null. Accepts the chatbot pass too.
const verifyToken = (token) => {
  if (typeof token !== "string") return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const given = Buffer.from(sig);
  const ok = secrets().some((s) => {
    const expected = Buffer.from(sign(payload, s));
    return expected.length === given.length && crypto.timingSafeEqual(expected, given);
  });
  if (!ok) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.uid || !data.exp || Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
};

// ---------- planned rules ----------
// "public"          anyone, signed in or not
// "any"             any signed-in user
// [roles]           only these roles
// { roles, self }   these roles, or the user named by :self in the URL
//                   (a parent may also open a sibling's data: same phone number)
const A = "admin", T = "teacher", C = "crm";
const RULES = {
  "POST /ping": "public",
  "GET /ping": "public",
  "POST /api/login": "public",
  "POST /api/parent/forgot-password": "public",

  "POST /api/register": [A],
  "GET /api/users/parent/:phone": [A, C],
  "GET /api/users": [A, C],
  "PUT /api/users/:id": [A],
  "PUT /api/users/:id/status": [A],
  "DELETE /api/users/:id": [A],
  "GET /api/users/:id/credentials": [A],
  "PUT /api/users/:id/notify-prefs": { roles: [A], self: "id" },
  "GET /api/dashboard/stats": [A],

  "GET /api/classes": [A, T, C],
  "POST /api/classes": [A],
  "PUT /api/classes/:id": [A, T],
  "POST /api/classes/:id/assign": [A],
  "DELETE /api/classes/:id": [A],
  "GET /api/teacher/:id/classes": { roles: [A], self: "id" },
  "GET /api/teacher/:id/at-risk": { roles: [A], self: "id" },

  "POST /api/feedback": [A, T],
  "POST /api/feedback/comment": "any",
  "PUT /api/feedback/:id": [A, T],
  "DELETE /api/feedback/:id": [A, T],
  "GET /api/feedback/teacher/:teacherId": { roles: [A], self: "teacherId" },
  "GET /api/feedback/student/:studentId": { roles: [A, T], self: "studentId" },
  "POST /api/feedback/:id/messages": "any", // the route checks the sender is this report's parent or teacher
  "PUT /api/feedback/:id/read": "any", // same
  "GET /api/feedback/teacher/:teacherId/threads": { roles: [A], self: "teacherId" },

  "POST /api/fees/update": [A],
  "POST /api/fees/override": [A],
  "POST /api/student-pass/mark": [A],
  "POST /api/student-pass/remove": [A],
  "GET /api/student-pass/:userId": { roles: [A, C], self: "userId" },

  "GET /api/attendance/daily": [A, T],
  "GET /api/attendance/monthly": [A, T],
  "POST /api/attendance": [A, T],
  "GET /api/attendance/student/:studentId": { roles: [A, T], self: "studentId" },
  "GET /api/attendance/class/:classId": [A, T],
  "GET /api/student/:id/profile": { roles: [A, T, C], self: "id" },

  "POST /api/gallery/upload": [A, T],
  "GET /api/gallery": "any",
  "GET /api/gallery/student/:studentId": { roles: [A, T], self: "studentId" },
  "DELETE /api/gallery/:id": [A, T],
  "POST /api/gallery/bulk-delete": [A, T],
  "PUT /api/gallery/:id/date": [A, T],
  "POST /api/gallery/bulk-update-date": [A, T],

  "POST /api/certifications/upload": [A, T],
  "GET /api/certifications": [A],
  "GET /api/certifications/student/:studentId": { roles: [A, T], self: "studentId" },
  "GET /api/certifications/teacher/:teacherId": { roles: [A], self: "teacherId" },
  "DELETE /api/certifications/:id": [A, T],

  "POST /api/notifications/batch-alert": [A, T],
  "POST /api/notifications/subscribe": "any",

  "GET /api/spotlights": "any",
  "POST /api/spotlights": [A],
  "POST /api/spotlights/:id/react": "any",
  "DELETE /api/spotlights/:id": [A],

  "GET /api/expenses": [A],
  "POST /api/expenses": [A],
  "PUT /api/expenses/:id": [A],
  "DELETE /api/expenses/:id": [A],

  "GET /api/admin/attention": [A],
  "GET /api/admin/auth-watch": [A],
  "GET /api/admin/reset-requests": [A],
  "PUT /api/admin/reset-requests/:id/resolve": [A],
  "GET /api/admin/payment-proofs": [A],
  "PUT /api/admin/payment-proofs/:userId/:proofId": [A],

  "GET /api/parent/:id/referrals": { roles: [A, C], self: "id" },
  "PUT /api/parent/:id/contact": { roles: [A], self: "id" },
  "POST /api/parent/:id/absence": { roles: [A], self: "id" },
  "DELETE /api/parent/:id/absence/:noticeId": { roles: [A], self: "id" },
  "POST /api/parent/:id/payment-proof": { roles: [A], self: "id" },
  "GET /api/parent/:id/family": { roles: [A], self: "id" },

  "POST /api/class-notes": [A, T],
  "GET /api/class-notes/class/:classId": [A, T],
  "GET /api/class-notes/teacher/:teacherId": { roles: [A], self: "teacherId" },
  "GET /api/class-notes/student/:studentId": { roles: [A, T], self: "studentId" },
  "DELETE /api/class-notes/:id": [A, T],

  "POST /api/checkins/:studentId": [A, T],
  "DELETE /api/checkins/:studentId": [A, T],

  "POST /api/chatbot/": "any",

  "GET /api/leads/": [A, C],
  "GET /api/leads/stats": [A, C],
  "POST /api/leads/": [A, C],
  "GET /api/leads/:id": [A, C],
  "PUT /api/leads/:id": [A, C],
  "DELETE /api/leads/:id": [A, C],
  "POST /api/leads/:id/stage": [A, C],
  "POST /api/leads/:id/activity": [A, C],
  "POST /api/leads/:id/followups": [A, C],
  "PATCH /api/leads/:id/followups/:fid": [A, C],
  "POST /api/leads/:id/demo": [A, C],
  "POST /api/leads/:id/demo/outcome": [A, C],
  "POST /api/leads/:id/convert": [A, C],
  "POST /api/leads/clients/:id/contact": [A, C],
};

// ---------- who is calling (cached briefly) ----------
const people = new Map(); // uid -> { at, role, phone10, name }
const PEOPLE_TTL = 10 * 60 * 1000;
const person = async (uid) => {
  const hit = people.get(uid);
  if (hit && Date.now() - hit.at < PEOPLE_TTL) return hit;
  let info = { at: Date.now(), role: null, phone10: "", name: "" };
  if (mongoose.Types.ObjectId.isValid(uid)) {
    const u = await User.findById(uid).select("role phone fullName childName username").lean();
    if (u) info = { at: Date.now(), role: u.role, phone10: String(u.phone || "").replace(/\D/g, "").slice(-10), name: u.childName || u.fullName || u.username || "" };
  }
  people.set(uid, info);
  if (people.size > 2000) people.delete(people.keys().next().value);
  return info;
};

// Why the planned rule would refuse this request, or null if it would allow it
const verdict = async (rule, auth, params) => {
  if (rule === undefined) return "no-rule";
  if (rule === "public") return null;
  if (!auth) return "no-token";
  if (auth.bad) return "bad-token";
  if (rule === "any") return null;
  const roles = Array.isArray(rule) ? rule : rule.roles;
  if (roles.includes(auth.role)) return null;
  if (!Array.isArray(rule) && rule.self) {
    const target = String(params?.[rule.self] || "");
    if (target === auth.uid) return null;
    if (auth.role === "parent" && target) {
      const [me, them] = await Promise.all([person(auth.uid), person(target)]);
      if (me.phone10.length === 10 && me.phone10 === them.phone10 && them.role === "parent") return null; // sibling
    }
    return auth.role === "parent" || auth.role === "teacher" ? "not-own" : "wrong-role";
  }
  return "wrong-role";
};

// ---------- counting (flushed to the database once a minute) ----------
const istDay = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const pending = new Map(); // key -> { day, method, route, reason, role, count, lastAt, lastUser }
const bump = (row) => {
  const key = [row.day, row.method, row.route, row.reason, row.role].join("|");
  const cur = pending.get(key) || { ...row, count: 0 };
  cur.count += 1;
  cur.lastAt = new Date();
  if (row.lastUser) cur.lastUser = row.lastUser;
  pending.set(key, cur);
};

let AuthWatch = null;
const model = () => (AuthWatch ||= require("./models/AuthWatch"));
const flush = async () => {
  if (!pending.size) return;
  const rows = [...pending.values()];
  pending.clear();
  try {
    await model().bulkWrite(rows.map((r) => ({
      updateOne: {
        filter: { day: r.day, method: r.method, route: r.route, reason: r.reason, role: r.role },
        update: { $inc: { count: r.count }, $set: { lastAt: r.lastAt, ...(r.lastUser ? { lastUser: r.lastUser } : {}) } },
        upsert: true,
      },
    })));
  } catch (err) {
    console.error("Auth watch save error:", err.message);
  }
};
let timer = null;
const startFlushing = () => {
  if (timer) return;
  timer = setInterval(flush, 60 * 1000);
  timer.unref?.();
};

// Express middleware: reads the pass, then judges the request once it's done
const middleware = (req, res, next) => {
  const header = req.headers.authorization || "";
  const raw = header.startsWith("Bearer ") ? header.slice(7) : "";
  const data = raw ? verifyToken(raw) : null;
  req.auth = raw ? (data ? { uid: String(data.uid), role: data.role || null } : { bad: true }) : null;
  if (req.method === "OPTIONS") return next();
  res.on("finish", () => {
    if (!req.route) return; // unknown URL (404)
    const route = `${req.baseUrl || ""}${req.route.path}`;
    const method = req.method;
    const params = { ...req.params };
    const auth = req.auth;
    Promise.resolve()
      .then(async () => {
        if (auth && !auth.bad && !auth.role) auth.role = (await person(auth.uid)).role; // chatbot pass: look the role up
        const reason = await verdict(RULES[`${method} ${route}`], auth, params);
        const day = istDay();
        bump({ day, method: "*", route: "*", reason: "checked", role: "*" });
        if (reason) bump({ day, method, route, reason, role: auth && !auth.bad ? auth.role || "unknown" : "-", lastUser: auth && !auth.bad ? auth.uid : "" });
      })
      .catch((err) => console.error("Auth watch error:", err.message));
  });
  startFlushing();
  next();
};

// ---------- Admin: what the rules would have refused ----------
const REASONS = {
  "no-token": "Not signed in with the new login pass (an older session, or a call from outside the app)",
  "bad-token": "Login pass expired or not genuine",
  "wrong-role": "This role isn't allowed by the planned rule",
  "not-own": "Opening someone else's data",
  "no-rule": "No rule written for this route yet",
};
const report = async (days = 7) => {
  await flush();
  const since = new Date(Date.now() + 330 * 60000 - (days - 1) * 86400000).toISOString().slice(0, 10);
  const docs = await model().find({ day: { $gte: since } }).lean();
  let checked = 0;
  const grouped = new Map();
  for (const d of docs) {
    if (d.reason === "checked") { checked += d.count; continue; }
    const key = [d.method, d.route, d.reason, d.role].join("|");
    const g = grouped.get(key) || { method: d.method, route: d.route, reason: d.reason, role: d.role, count: 0, lastAt: null, lastUser: "" };
    g.count += d.count;
    if (!g.lastAt || d.lastAt > g.lastAt) { g.lastAt = d.lastAt; g.lastUser = d.lastUser || g.lastUser; }
    grouped.set(key, g);
  }
  const rows = [...grouped.values()].sort((a, b) => b.count - a.count).slice(0, 200);
  await Promise.all(rows.map(async (r) => { r.lastUserName = r.lastUser ? (await person(r.lastUser)).name : ""; r.reasonText = REASONS[r.reason] || r.reason; }));
  const byReason = {};
  rows.forEach((r) => { byReason[r.reason] = (byReason[r.reason] || 0) + r.count; });
  return {
    configured: secrets().length > 0,
    ownSecret: !!process.env.AUTH_SECRET,
    since,
    days,
    checked,
    wouldBlock: rows.reduce((s, r) => s + r.count, 0),
    byReason,
    rows,
  };
};

const router = require("express").Router();
router.get("/admin/auth-watch", async (req, res) => {
  try {
    const days = Math.min(30, Math.max(1, Number(req.query.days) || 7));
    res.json(await report(days));
  } catch (err) {
    console.error("Auth watch report error:", err);
    res.status(500).json({ message: "Couldn't load the security check" });
  }
});

module.exports = { middleware, router, signAuthToken, verifyToken, verdict, RULES, flush, report };
