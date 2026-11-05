// Parent self-service: referrals, contact details, forgot password, absence
// notices, report conversations, payment proof and sibling switching.
// Mounted in index.js with the shared Cloudinary upload middleware.
const express = require("express");
const mongoose = require("mongoose");
const User = require("./models/User");
const Class = require("./models/Class");
const Feedback = require("./models/Feedback");
const Lead = require("./models/Lead");
const ResetRequest = require("./models/ResetRequest");
const parentPush = require("./parentPush");
const { signChatToken } = require("./chatbot");

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const last10 = (p) => String(p || "").replace(/\D/g, "").slice(-10);
const familyKey = (u) => last10(u.phone) || `id:${u._id}`;
// Phone numbers are stored in any format ("+91 99636 13404", "9963613404"):
// match the last 10 digits, allowing spaces/dashes between them
const phoneRegex = (digits10) => `${digits10.split("").join("\\D*")}\\D*$`;
const validId = (id) => mongoose.Types.ObjectId.isValid(id);
const istToday = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const prettyDate = (ymd) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const SAFE_FIELDS = "-password -pushSubscription";

const loadParent = async (id, res) => {
  if (!validId(id)) { res.status(404).json({ message: "Not found" }); return null; }
  const u = await User.findById(id);
  if (!u || u.role !== "parent") { res.status(404).json({ message: "Not found" }); return null; }
  return u;
};
const admins = () => User.find({ role: "admin", pushSubscription: { $ne: null } }).select("pushSubscription notifyPrefs");

module.exports = (upload) => {
  const router = express.Router();

  // ---------- referrals made (same matching as the CRM Clients page) ----------
  router.get("/parent/:id/referrals", async (req, res) => {
    try {
      const me = await loadParent(req.params.id, res);
      if (!me) return;
      const parents = await User.find({ role: "parent" }).select("username admissionId fullName childName phone referredBy createdAt").lean();
      const myFam = familyKey(me);
      const family = parents.filter((p) => familyKey(p) === myFam);
      const strong = new Set(family.flatMap((p) => [norm(p.username), norm(p.admissionId)]).filter(Boolean));
      // a parent/child name counts only when it belongs to exactly one family
      const nameFamilies = new Map();
      parents.forEach((p) => [p.fullName, p.childName].forEach((n) => {
        const k = norm(n);
        if (!k) return;
        if (!nameFamilies.has(k)) nameFamilies.set(k, new Set());
        nameFamilies.get(k).add(familyKey(p));
      }));
      const names = new Set([...nameFamilies.entries()].filter(([, fams]) => fams.size === 1 && fams.has(myFam)).map(([k]) => k));
      const referred = new Map();
      parents.forEach((p) => {
        const r = norm(p.referredBy);
        if (!r || familyKey(p) === myFam || !(strong.has(r) || names.has(r))) return;
        const fk = familyKey(p);
        if (!referred.has(fk)) referred.set(fk, { children: [], since: p.createdAt });
        if (p.childName) referred.get(fk).children.push(String(p.childName).trim().split(/\s+/)[0]);
      });
      let enquiries = 0;
      try {
        const leads = await Lead.find({ stage: { $nin: ["converted", "lost"] }, referredBy: { $ne: "" } }).select("referredBy").lean();
        enquiries = leads.filter((l) => strong.has(norm(l.referredBy)) || names.has(norm(l.referredBy))).length;
      } catch { /* CRM optional */ }
      res.json({ count: referred.size, families: [...referred.values()], enquiries });
    } catch (err) {
      console.error("Referral count error:", err);
      res.status(500).json({ message: "Error loading referrals" });
    }
  });

  // ---------- contact details the parent may change ----------
  router.put("/parent/:id/contact", async (req, res) => {
    try {
      const me = await loadParent(req.params.id, res);
      if (!me) return;
      const { phone, email, location } = req.body || {};
      if (phone !== undefined) {
        const digits = String(phone).replace(/\D/g, "");
        if (digits.length < 10 || digits.length > 15) return res.status(400).json({ message: "Please enter a valid phone number" });
        me.phone = String(phone).trim();
      }
      if (email !== undefined) {
        const e = String(email).trim();
        if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return res.status(400).json({ message: "Please enter a valid email" });
        me.email = e;
        if (me.parentEmail !== undefined) me.parentEmail = e;
      }
      if (location !== undefined) me.location = String(location).trim().slice(0, 80);
      await me.save();
      res.json({ phone: me.phone, email: me.email, location: me.location });
    } catch (err) {
      console.error("Contact update error:", err);
      res.status(500).json({ message: "Couldn't save your details" });
    }
  });

  // ---------- forgot password: tells the academy (never reveals accounts) ----------
  router.post("/parent/forgot-password", async (req, res) => {
    try {
      const raw = String(req.body?.identifier || "").trim();
      if (!raw) return res.status(400).json({ message: "Enter your username or phone number" });
      const identifier = raw.slice(0, 80);
      const digits = last10(raw);
      const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const exact = new RegExp("^" + escaped + "$", "i");
      const match = await User.findOne(digits.length === 10 && !/[a-z]/i.test(raw)
        ? { role: "parent", phone: { $regex: phoneRegex(digits) } }
        : { role: "parent", $or: [{ username: exact }, { admissionId: exact }] }).select("username childName fullName phone");

      // Keep one open request per account (or per typed text when nothing matched)
      const key = match ? { userId: match._id, resolved: false } : { userId: null, identifier, resolved: false };
      await ResetRequest.findOneAndUpdate(key, {
        $set: {
          identifier,
          at: new Date(),
          fullName: match?.fullName || "",
          childName: match?.childName || "",
          username: match?.username || "",
          phone: match?.phone || "",
        },
      }, { upsert: true, setDefaultsOnInsert: true });
      res.json({ ok: true });

      // Every request reaches the admins, even when no account matched what was typed
      const who = match
        ? `${match.fullName || "A parent"} (${match.childName || match.username})`
        : `Someone typing "${identifier}" (no matching account)`;
      parentPush.later("Password reset request", async () => parentPush.pushToUsers(await admins(), {
        title: "🔑 Password reset request",
        body: `${who} can't log in and asked for a new password.`,
        tag: `reset-${match?._id || identifier}`,
        url: `${parentPush.APP_URL}/`,
        requireInteraction: true,
      }, { urgency: "high" }));
    } catch (err) {
      console.error("Forgot password error:", err);
      if (!res.headersSent) res.status(500).json({ message: "Please try again" });
    }
  });

  // ---------- admin: open password reset requests (notification bell) ----------
  router.get("/admin/reset-requests", async (req, res) => {
    try {
      res.json(await ResetRequest.find({ resolved: false }).sort({ at: -1 }).limit(50).lean());
    } catch (err) {
      res.status(500).json({ message: "Error loading reset requests" });
    }
  });

  router.put("/admin/reset-requests/:id/resolve", async (req, res) => {
    try {
      if (!validId(req.params.id)) return res.status(404).json({ message: "Not found" });
      await ResetRequest.findByIdAndUpdate(req.params.id, { resolved: true, resolvedAt: new Date() });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ message: "Couldn't update the request" });
    }
  });

  // ---------- absence notice: "my child can't attend this class" ----------
  router.post("/parent/:id/absence", async (req, res) => {
    try {
      const me = await loadParent(req.params.id, res);
      if (!me) return;
      const { date, time = "", reason = "" } = req.body || {};
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return res.status(400).json({ message: "Pick a class date" });
      if (date < istToday()) return res.status(400).json({ message: "That class has already happened" });
      me.absenceNotices = (me.absenceNotices || []).filter((n) => n.date >= istToday() && !(n.date === date && n.time === time));
      me.absenceNotices.push({ date, time, reason: String(reason).trim().slice(0, 200), classId: me.assignedClass || null, at: new Date() });
      await me.save();
      res.json({ absenceNotices: me.absenceNotices });

      if (me.assignedClass) {
        parentPush.later("Absence notice", async () => {
          const cls = await Class.findById(me.assignedClass).populate("teacher", "pushSubscription notifyPrefs");
          if (!cls?.teacher) return 0;
          return parentPush.pushToUsers([cls.teacher], {
            title: `🙋 ${me.childName || "A student"} can't attend`,
            body: `${me.childName || "A student"} will miss ${cls.className} on ${prettyDate(date)}${reason ? ` — ${String(reason).trim().slice(0, 80)}` : ""}.`,
            tag: `absence-${me._id}-${date}`,
            url: `${parentPush.APP_URL}/`,
          });
        });
      }
    } catch (err) {
      console.error("Absence notice error:", err);
      res.status(500).json({ message: "Couldn't send that. Please try again." });
    }
  });

  router.delete("/parent/:id/absence/:noticeId", async (req, res) => {
    try {
      const me = await loadParent(req.params.id, res);
      if (!me) return;
      me.absenceNotices = (me.absenceNotices || []).filter((n) => String(n._id) !== req.params.noticeId);
      await me.save();
      res.json({ absenceNotices: me.absenceNotices });
    } catch (err) {
      res.status(500).json({ message: "Couldn't cancel that" });
    }
  });

  // ---------- report conversation (parent ↔ teacher) ----------
  router.post("/feedback/:id/messages", async (req, res) => {
    try {
      if (!validId(req.params.id)) return res.status(404).json({ message: "Report not found" });
      const { from, userId, text } = req.body || {};
      const body = String(text || "").trim().slice(0, 1000);
      if (!body) return res.status(400).json({ message: "Write a message first" });
      if (!["parent", "teacher"].includes(from)) return res.status(400).json({ message: "Unknown sender" });
      const report = await Feedback.findById(req.params.id);
      if (!report) return res.status(404).json({ message: "Report not found" });
      // the sender must be this report's parent or teacher
      const expected = from === "parent" ? report.studentId : report.teacherId;
      if (!userId || String(expected) !== String(userId)) return res.status(403).json({ message: "Not allowed" });
      const sender = await User.findById(userId).select("fullName childName");
      report.messages.push({ from, name: sender?.fullName || "", text: body, at: new Date() });
      if (from === "parent" && !report.parentComment) report.parentComment = body; // older screens still show it
      await report.save();
      res.json({ messages: report.messages });

      parentPush.later("Report message", async () => {
        const otherId = from === "parent" ? report.teacherId : report.studentId;
        const other = await User.findById(otherId).select("pushSubscription notifyPrefs childName");
        const student = from === "parent" ? sender : other;
        const month = parentPush.monthLabel(report.month);
        return parentPush.pushToUsers([other], from === "parent"
          ? { title: `💬 Reply from ${student?.childName ? `${student.childName}'s parent` : "a parent"}`, body: `On the ${month} report: "${body.slice(0, 90)}"`, tag: `msg-${report._id}`, url: `${parentPush.APP_URL}/` }
          : { title: "💬 The teacher replied", body: `On ${other?.childName ? `${other.childName}'s` : "the"} ${month} report: "${body.slice(0, 90)}"`, tag: `msg-${report._id}`, url: `${parentPush.APP_URL}/#reports` },
        { pref: from === "teacher" ? "reports" : undefined });
      });
    } catch (err) {
      console.error("Report message error:", err);
      res.status(500).json({ message: "Couldn't send. Please try again." });
    }
  });

  // ---------- payment proof (screenshot of the UPI / bank payment) ----------
  router.post("/parent/:id/payment-proof", upload.single("proof"), async (req, res) => {
    try {
      const me = await loadParent(req.params.id, res);
      if (!me) return;
      if (!req.file) return res.status(400).json({ message: "Attach the payment screenshot" });
      let months = req.body.months;
      if (typeof months === "string") months = months.split(",");
      months = (months || []).map((m) => String(m).trim()).filter((m) => /^\d{4}-\d{2}$/.test(m));
      if (!months.length) return res.status(400).json({ message: "Choose the month(s) you paid for" });
      const amount = Number(req.body.amount) || 0;
      me.paymentProofs.push({ months, amount, url: req.file.path, note: String(req.body.note || "").trim().slice(0, 200), at: new Date() });
      if (me.paymentProofs.length > 50) me.paymentProofs = me.paymentProofs.slice(-50);
      await me.save();
      res.json({ paymentProofs: me.paymentProofs });

      parentPush.later("Payment proof", async () => parentPush.pushToUsers(await admins(), {
        title: `🧾 Payment proof from ${me.childName || me.username}`,
        body: `${amount ? `₹${amount} for ` : ""}${months.map((m) => parentPush.monthLabel(m)).join(", ")}. Check it in Fee Tracker.`,
        tag: `proof-${me._id}`,
        image: req.file.path,
        url: `${parentPush.APP_URL}/`,
      }));
    } catch (err) {
      console.error("Payment proof error:", err);
      res.status(500).json({ message: "Upload failed. Please try again." });
    }
  });

  // ---------- siblings: children sharing the parent's phone number ----------
  router.get("/parent/:id/family", async (req, res) => {
    try {
      const me = await loadParent(req.params.id, res);
      if (!me) return;
      const digits = last10(me.phone);
      if (digits.length !== 10) return res.json({ children: [] });
      const kids = await User.find({ role: "parent", isActive: { $ne: false }, phone: { $regex: phoneRegex(digits) } }).select(SAFE_FIELDS).sort({ createdAt: 1 });
      res.json({
        children: kids.filter((k) => last10(k.phone) === digits).map((k) => {
          const obj = k.toObject();
          delete obj.password; // never send these, even if a select changes
          delete obj.pushSubscription;
          const chatToken = signChatToken(k);
          return chatToken ? { ...obj, chatToken } : obj;
        }),
      });
    } catch (err) {
      console.error("Family error:", err);
      res.status(500).json({ message: "Error loading family" });
    }
  });

  return router;
};
