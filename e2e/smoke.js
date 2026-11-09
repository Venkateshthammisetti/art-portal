// Browser smoke test: opens the built app as each role (admin, teacher, parent,
// CRM), clicks through every menu item and fails on any JavaScript crash.
// The real server is never called: every API request gets a canned reply.
//
//   cd client && npm run build      (once)
//   cd e2e && npm install && npm test
//
// Env: BUILD_DIR (default ../client/build), CHROMIUM_PATH (optional).
const http = require("http");
const fs = require("fs");
const path = require("path");

const loadPlaywright = () => {
  for (const p of ["playwright", "/opt/node-tools/node_modules/playwright"]) {
    try { return require(p); } catch { /* try next */ }
  }
  throw new Error("Playwright not found: run `npm install` in e2e/");
};
const { chromium } = loadPlaywright();

const BUILD = path.resolve(__dirname, process.env.BUILD_DIR || "../client/build");
const CHROMIUM = process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);

// ---------- static server for the built app (SPA fallback to index.html) ----------
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };
const serveBuild = () => new Promise((resolve) => {
  const srv = http.createServer((req, res) => {
    const clean = decodeURIComponent(req.url.split("?")[0]);
    let file = path.join(BUILD, clean);
    if (!file.startsWith(BUILD) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(BUILD, "index.html");
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  srv.listen(0, "127.0.0.1", () => resolve(srv));
});

// ---------- made-up data ----------
const id = (n) => n.repeat(24).slice(0, 24);
const ADMIN = id("a"), TEACHER = id("b"), CRM = id("d"), CLASS = id("c");
const today = new Date().toISOString().slice(0, 10);
const month = today.slice(0, 7);
const kids = ["Aarav", "Diya", "Kiran"].map((name, i) => ({
  _id: `${i + 1}`.repeat(24), role: "parent", username: name.toLowerCase(), fullName: `Parent of ${name}`, childName: name,
  phone: `98765000${i}${i}`, monthlyFee: 1500, registeredDate: "2026-01-05", isActive: true, classMode: "online",
  assignedClass: CLASS, payments: [{ month, status: "Paid", amount: 1500 }], passes: [], absenceNotices: [], paymentProofs: [],
  createdAt: "2026-01-05T00:00:00Z",
}));
const teacher = { _id: TEACHER, role: "teacher", username: "venky", fullName: "Venky Sir" };
const cls = { _id: CLASS, className: "Sketching Juniors", level: "Basic", teacher, students: kids, schedule: [{ day: "Saturday", time: "10:00", link: "https://meet.example/abc" }] };
const users = [...kids, teacher, { _id: ADMIN, role: "admin", username: "admin", fullName: "Admin" }];

const reply = (url, method) => {
  if (method !== "GET") return { ok: true, success: true };
  const p = url.replace(/^.*?\/api/, "");
  if (/^\/users(\?|$)/.test(p)) {
    const role = (p.match(/role=(\w+)/) || [])[1];
    return role ? users.filter((u) => u.role === role) : users;
  }
  if (/^\/users\/[a-f0-9]{24}$/.test(p)) return users.find((u) => p.endsWith(u._id)) || kids[0];
  if (/^\/classes(\?|$)/.test(p) || /^\/teacher\/[^/]+\/classes/.test(p)) return [cls];
  if (/^\/dashboard\/stats/.test(p)) return { totalStudents: 3, activeStudents: 3, totalTeachers: 1, totalClasses: 1 };
  if (/^\/admin\/attention/.test(p)) return { today, total: 0, overdueAmount: 0, counts: { proofs: 0, resets: 0, overdue: 0, missing: 0, unmarked: 0, notices: 0 }, items: { proofs: [], resets: [], overdue: [], missing: [], missingKnown: [], unmarked: [], notices: [] } };
  if (/^\/leads\/stats/.test(p)) return { total: 0, byStage: {}, bySource: [], conversion: 0, today: [], overdue: [], upcomingDemos: [], funnel: [], monthly: [] };
  if (/^\/admin\/insights/.test(p)) {
    const row = (m, i) => ({ month: m, active: 10 + i, joined: i % 3, left: i % 2, returned: 0, net: (i % 3) - (i % 2), passes: 1, expected: 15000, collected: 12000 + i * 300, paidCount: 8, dueCount: 10, collectionRate: 80 + i * 2, attendanceRate: 70 + i * 3 });
    const trend = [5, 4, 3, 2, 1, 0].map((n, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - n); return row(d.toISOString().slice(0, 7), i); });
    return { month, months: trend.map((r) => r.month), trend, summary: trend[5], previous: trend[4], unassigned: 0,
      classes: [{ classId: CLASS, className: cls.className, teacher: teacher.fullName, students: 3, sessions: 4, marked: 12, present: 9, absent: 3, attendanceRate: 75 }],
      teachers: [{ teacherId: TEACHER, teacher: teacher.fullName, classes: 1, students: 3, sessions: 4, attendanceRate: 75, reportsWritten: 1, reportsDue: 3 }] };
  }
  if (/^\/student\/[^/]+\/profile/.test(p)) return { student: kids[0], attendance: [], feedback: [] };
  if (/^\/parent\/[^/]+\/referrals/.test(p)) return { count: 0, families: [], enquiries: 0 };
  if (/^\/parent\/[^/]+\/family/.test(p)) return { children: [kids[0]] };
  if (/^\/student-pass\//.test(p)) return { passes: [] };
  return [];
};

const ROLES = [
  { role: "admin", user: users.find((u) => u.role === "admin"), nav: ".sidebar-nav button" },
  { role: "teacher", user: teacher, nav: ".t-nav button", extra: { teacherTutorialSeen: "true" } },
  { role: "parent", user: kids[0], nav: ".p-nav button", extra: { [`parent_tutorial_seen_${kids[0]._id}`]: "1" } },
  { role: "crm", user: { _id: CRM, role: "crm", username: "crm", fullName: "Admissions" }, nav: "nav button:not(.crm-bottom-nav button)" },
];
const SKIP = /log ?out|sign out|theme|dark|light/i;

const run = async () => {
  if (!fs.existsSync(path.join(BUILD, "index.html"))) throw new Error(`No build at ${BUILD}: run \`npm run build\` in client/ first`);
  const srv = await serveBuild();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
  let failed = 0;
  const check = (label, ok, detail = "") => {
    console.log(`${ok ? "✓" : "✗ FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failed++;
  };

  // Login screen, then a successful login, as a parent
  {
    const ctx = await browser.newContext({ serviceWorkers: "block", reducedMotion: "reduce" });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route(/onrender\.com/, (r) => r.fulfill({ json: r.request().url().includes("/api/login") ? kids[0] : reply(r.request().url(), r.request().method()) }));
    await page.goto(base);
    await page.locator("input[type=password]").waitFor({ timeout: 15000 });
    await page.locator("input:not([type=password])").first().fill("aarav");
    await page.locator("input[type=password]").fill("secret");
    await page.locator("input[type=password]").press("Enter");
    await page.waitForFunction(() => !!localStorage.getItem("user"), null, { timeout: 10000 }).catch(() => {});
    check("login stores the user", await page.evaluate(() => !!localStorage.getItem("user")));
    check("login screen: no crashes", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  for (const { role, user, nav, extra = {} } of ROLES) {
    const ctx = await browser.newContext({ serviceWorkers: "block", reducedMotion: "reduce", viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript(([u, more]) => {
      localStorage.setItem("user", JSON.stringify(u));
      Object.entries(more).forEach(([k, v]) => localStorage.setItem(k, v));
    }, [user, extra]);
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.dismiss());
    await page.route(/onrender\.com/, (r) => r.fulfill({ json: reply(r.request().url(), r.request().method()) }));
    await page.route(/^(?!http:\/\/127\.0\.0\.1)/, (r) => (/onrender\.com/.test(r.request().url()) ? r.fallback() : r.abort()));
    await page.goto(base);

    const items = page.locator(nav);
    await items.first().waitFor({ timeout: 20000 }).catch(() => {});
    const seen = new Set();
    for (let round = 0; round < 40; round++) {
      const labels = (await items.allInnerTexts()).map((t) => t.trim().split("\n")[0]);
      const next = labels.findIndex((l, i) => l && !SKIP.test(l) && !seen.has(`${i}:${l}`));
      if (next < 0) break;
      seen.add(`${next}:${labels[next]}`);
      await items.nth(next).click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(400);
      await page.keyboard.press("Escape");
    }
    check(`${role}: opened ${seen.size} menu items`, seen.size >= 3, [...seen].map((s) => s.split(":")[1]).join(", "));
    check(`${role}: no crashes`, errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }

  await browser.close();
  srv.close();
  console.log(failed ? `\n${failed} check(s) failed` : "\nAll smoke checks passed");
  process.exit(failed ? 1 : 0);
};

run().catch((e) => { console.error(e); process.exit(1); });
