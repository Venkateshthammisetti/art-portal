// Push notifications to parents, honouring each parent's notification settings
// (User.notifyPrefs). VAPID details are set once in index.js (and again by the
// scheduler); web-push keeps them module-wide.
const webpush = require("web-push");
const User = require("./models/User");

const APP_URL = "https://art-portal.netlify.app";

// Types a parent can switch off in the dashboard. Fee reminders and birthday
// wishes are always sent.
const PREF_KEYS = ["reports", "certificates", "attendance", "classChanges", "classReminders", "artwork", "posters"];

// Missing settings mean "on" (accounts created before settings existed).
const wants = (user, pref) => !pref || !user?.notifyPrefs || user.notifyPrefs[pref] !== false;

const monthLabel = (ym) => {
  const [y, m] = String(ym || "").split("-").map(Number);
  if (!y || !m) return ym || "";
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
};

// Send one payload to many users; drops subscriptions the push service says
// are gone (404/410). Returns how many were delivered.
const pushToUsers = async (users, payload, { pref, urgency = "normal", TTL = 86400 } = {}) => {
  const targets = (users || []).filter((u) => u?.pushSubscription && wants(u, pref));
  if (targets.length === 0) return 0;
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  const results = await Promise.allSettled(
    targets.map((u) => webpush.sendNotification(u.pushSubscription, typeof payload === "function" ? JSON.stringify(payload(u)) : body, { urgency, TTL })),
  );
  let sent = 0;
  const expired = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") sent++;
    else if (r.reason?.statusCode === 404 || r.reason?.statusCode === 410) expired.push(targets[i]._id);
    else console.error("Parent push failed:", r.reason?.statusCode, r.reason?.body || r.reason?.message);
  });
  if (expired.length) await User.updateMany({ _id: { $in: expired } }, { $set: { pushSubscription: null } });
  return sent;
};

// Parents of a class who can receive pushes
const classParents = (classId) =>
  User.find({ assignedClass: classId, role: "parent", isActive: { $ne: false }, pushSubscription: { $ne: null } })
    .select("childName pushSubscription notifyPrefs inactiveHistory");

// Fire-and-forget wrapper so an endpoint's response never waits on push
const later = (label, fn) => {
  Promise.resolve()
    .then(fn)
    .then((n) => { if (n) console.log(`🔔 ${label}: sent ${n}`); })
    .catch((err) => console.error(`${label} push error:`, err.message));
};

module.exports = { APP_URL, PREF_KEYS, wants, monthLabel, pushToUsers, classParents, later };
