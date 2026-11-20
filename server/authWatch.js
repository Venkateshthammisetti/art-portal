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

// Looks at a pass: { ok: true, data } when genuine and in date;
// { ok: false, expired: true, data } when genuine but past its date;
// { ok: false } when it isn't genuine. Accepts the chatbot pass too.
const inspectToken = (token) => {
  if (typeof token !== "string") return { ok: false };
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return { ok: false };
  const given = Buffer.from(sig);
  const genuine = secrets().some((s) => {
    const expected = Buffer.from(sign(payload, s));
    return expected.length === given.length && crypto.timingSafeEqual(expected, given);
  });
  if (!genuine) return { ok: false };
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.uid || !data.exp) return { ok: false };
    if (Date.now() > data.exp) return { ok: false, expired: true, data };
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
};
// { uid, role? } when genuine and in date, otherwise null
const verifyToken = (token) => {
  const r = inspectToken(token);
  return r.ok ? r.data : null;
};

// Passes are renewed while people use the app, so a family that stays logged
// in for weeks never ends up with an expired pass. A genuine pass that ran out
// less than RENEW_GRACE ago is renewed too (people who were away for a while).
const RENEW_BEFORE_MS = 15 * 24 * 60 * 60 * 1000; // renew when under 15 days are left
const RENEW_GRACE_MS = 60 * 24 * 60 * 60 * 1000;

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
  "GET /api/admin/insights": [A],
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

  "GET /api/resources/": [A],
  "POST /api/resources/": [A],
  "PUT /api/resources/:id": [A],
  "DELETE /api/resources/:id": [A],
  "POST /api/resources/:id/items": [A],
  "POST /api/resources/:id/upload": [A],
  "PUT /api/resources/:id/items/:itemId": [A],
  "DELETE /api/resources/:id/items/:itemId": [A],

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
  if (auth.expired) return "expired-token";
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

// Express middleware: reads the pass (renewing it when due), then judges the
// request once it's done
const middleware = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const raw = header.startsWith("Bearer ") ? header.slice(7) : "";
  const pass = raw ? inspectToken(raw) : null;
  const now = Date.now();
  const renewable = pass && pass.data && (pass.ok || (pass.expired && now - pass.data.exp < RENEW_GRACE_MS));
  if (!raw) req.auth = null;
  else if (renewable) req.auth = { uid: String(pass.data.uid), role: pass.data.role || null };
  else if (pass.expired) req.auth = { expired: true, uid: String(pass.data.uid) };
  else req.auth = { bad: true };

  // A fresh pass goes back in the X-Auth-Token header (the app saves it) when
  // the old one is a chatbot pass, has under 15 days left, or has just run out
  if (renewable && secrets().length && (!pass.data.role || !pass.ok || pass.data.exp - now < RENEW_BEFORE_MS)) {
    try {
      const who = await person(String(pass.data.uid));
      if (who.role) {
        req.auth.role = who.role;
        res.setHeader("X-Auth-Token", signAuthToken({ _id: pass.data.uid, role: who.role }));
      } else {
        req.auth = { bad: true }; // the account no longer exists
      }
    } catch (err) {
      console.error("Pass renewal error:", err.message);
    }
  }

  if (req.method === "OPTIONS" || req.path === "/ping") return next(); // keep-awake pings aren't counted
  res.on("finish", () => {
    if (!req.route) return; // unknown URL (404)
    const route = `${req.baseUrl || ""}${req.route.path}`;
    const method = req.method === "HEAD" ? "GET" : req.method; // HEAD is answered by the GET route
    const params = { ...req.params };
    const auth = req.auth;
    Promise.resolve()
      .then(async () => {
        if (auth && !auth.bad && !auth.expired && !auth.role) auth.role = (await person(auth.uid)).role; // chatbot pass: look the role up
        const reason = await verdict(RULES[`${method} ${route}`], auth, params);
        const day = istDay();
        bump({ day, method: "*", route: "*", reason: "checked", role: "*" });
        const known = auth && !auth.bad;
        if (reason) bump({ day, method, route, reason, role: known && !auth.expired ? auth.role || "unknown" : "-", lastUser: known ? auth.uid : "" });
      })
      .catch((err) => console.error("Auth watch error:", err.message));
  });
  startFlushing();
  next();
};

// ---------- Admin: what the rules would have refused ----------
const REASONS = {
  "no-token": "Not signed in with the new login pass (an older session, or a call from outside the app)",
  "bad-token": "Login pass not genuine (altered, or signed with a different key)",
  "expired-token": "Login pass expired long ago: they need to log in again",
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

module.exports = { middleware, router, signAuthToken, verifyToken, inspectToken, verdict, RULES, flush, report, RENEW_BEFORE_MS, RENEW_GRACE_MS };
