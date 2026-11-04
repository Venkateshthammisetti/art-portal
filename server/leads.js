// Admissions CRM API — leads from first enquiry to demo class to enrolled parent.
// Mounted at /api/leads. Every change is written to the lead's timeline, and the
// follow-up tasks admissions staff need are created automatically:
//   • new lead          → "First call" due within the hour (speed-to-lead)
//   • demo scheduled    → "Confirm demo" the day before (or 2 h before if sooner)
//   • demo attended     → "Share feedback & fees" next day, "Decision call" in 3 days
//   • demo no-show      → "Reschedule demo" call the next day
// Open follow-ups are closed automatically when a lead is converted or lost.
const express = require("express");
const mongoose = require("mongoose");
const webpush = require("web-push");
const Lead = require("./models/Lead");
const User = require("./models/User");
const Class = require("./models/Class");

const router = express.Router();

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const STAGE_LABELS = {
  new: "New enquiry",
  contacted: "Contacted",
  demo_scheduled: "Demo scheduled",
  demo_done: "Demo done",
  converted: "Converted",
  lost: "Lost",
};

const fmtWhen = (d) =>
  new Date(d).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

const log = (lead, by, type, text) => lead.activities.push({ at: new Date(), by: by || "", type, text });

const setStage = (lead, stage, by, note) => {
  if (!Lead.STAGES.includes(stage) || lead.stage === stage) return;
  const from = STAGE_LABELS[lead.stage];
  lead.stage = stage;
  lead.stageChangedAt = new Date();
  log(lead, by, "stage", `${from} → ${STAGE_LABELS[stage]}${note ? ` (${note})` : ""}`);
};

const closeOpenFollowUps = (lead, outcome) => {
  lead.followUps.forEach((f) => {
    if (!f.done) {
      f.done = true;
      f.doneAt = new Date();
      f.outcome = outcome;
    }
  });
};

// Remove automatic pre-demo reminders (when a demo is rescheduled or cancelled)
const dropAutoFollowUps = (lead, type) => {
  lead.followUps = lead.followUps.filter((f) => !(f.auto && !f.done && f.type === type));
};

const pushTo = async (user, payload) => {
  if (!user?.pushSubscription) return;
  try {
    await webpush.sendNotification(user.pushSubscription, JSON.stringify(payload), { urgency: "high", TTL: 86400 });
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      await User.findByIdAndUpdate(user._id, { pushSubscription: null });
    }
  }
};

const findLead = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(404).json({ message: "Lead not found" });
    return null;
  }
  const lead = await Lead.findById(req.params.id);
  if (!lead) res.status(404).json({ message: "Lead not found" });
  return lead;
};

const populated = (id) => Lead.findById(id).populate("demo.teacherId", "fullName username");

// ---------------------------------------------------------------------------
// LIST + STATS
// ---------------------------------------------------------------------------
router.get("/", async (req, res) => {
  try {
    const leads = await Lead.find()
      .populate("demo.teacherId", "fullName username")
      .sort({ updatedAt: -1 });
    res.json(leads);
  } catch (err) {
    res.status(500).json({ message: "Error fetching leads" });
  }
});

// Funnel, sources and monthly trend for the Reports tab
router.get("/stats", async (req, res) => {
  try {
    const leads = await Lead.find().select("stage source createdAt convertedAt demo.status activities.type activities.text");
    const reachedDemo = (l) => l.demo?.status || ["demo_scheduled", "demo_done", "converted"].includes(l.stage);
    const attended = (l) => l.demo?.status === "attended" || l.stage === "demo_done" || l.stage === "converted";
    const total = leads.length;
    const funnel = {
      leads: total,
      // reached a conversation (a lead lost straight from "new" never was)
      contacted: leads.filter((l) =>
        ["contacted", "demo_scheduled", "demo_done", "converted"].includes(l.stage) ||
        (l.stage === "lost" && (l.activities || []).some((a) => ["call", "whatsapp", "email", "demo"].includes(a.type)))).length,
      demoScheduled: leads.filter(reachedDemo).length,
      demoAttended: leads.filter(attended).length,
      converted: leads.filter((l) => l.stage === "converted").length,
      lost: leads.filter((l) => l.stage === "lost").length,
    };
    const bySource = {};
    leads.forEach((l) => {
      const s = (bySource[l.source] = bySource[l.source] || { source: l.source, leads: 0, demos: 0, converted: 0 });
      s.leads++;
      if (reachedDemo(l)) s.demos++;
      if (l.stage === "converted") s.converted++;
    });
    const converted = leads.filter((l) => l.stage === "converted" && l.convertedAt);
    const avgDaysToConvert = converted.length
      ? Math.round(converted.reduce((sum, l) => sum + (l.convertedAt - l.createdAt) / DAY, 0) / converted.length)
      : null;
    // Last 6 months: leads created vs converted
    const now = new Date();
    const monthly = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return { key, label: d.toLocaleString("en-IN", { month: "short" }), leads: 0, converted: 0 };
    });
    const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    leads.forEach((l) => {
      const m = monthly.find((x) => x.key === monthKey(l.createdAt));
      if (m) m.leads++;
      if (l.convertedAt) {
        const c = monthly.find((x) => x.key === monthKey(l.convertedAt));
        if (c) c.converted++;
      }
    });
    res.json({
      funnel,
      conversionRate: total ? Math.round((funnel.converted / total) * 100) : 0,
      demoToConversion: funnel.demoAttended ? Math.round((funnel.converted / funnel.demoAttended) * 100) : 0,
      bySource: Object.values(bySource).sort((a, b) => b.leads - a.leads),
      avgDaysToConvert,
      monthly,
    });
  } catch (err) {
    res.status(500).json({ message: "Error building stats" });
  }
});

// ---------------------------------------------------------------------------
// CREATE / READ / UPDATE / DELETE
// ---------------------------------------------------------------------------
const EDITABLE = ["parentName", "phone", "email", "childName", "childAge", "city", "source", "referredBy", "interestMode", "preferredTime", "notes"];

router.post("/", async (req, res) => {
  try {
    const { by } = req.body;
    if (!req.body.parentName?.trim() || !req.body.phone?.trim()) {
      return res.status(400).json({ message: "Parent name and phone are required" });
    }
    // Same number already being followed up? (compare the last 10 digits, so
    // "+91 99636 13404" and "9963613404" match)
    const last10 = (p) => String(p || "").replace(/\D/g, "").slice(-10);
    const digits = last10(req.body.phone);
    const openLeads = digits.length === 10 ? await Lead.find({ stage: { $nin: ["converted", "lost"] } }).select("_id parentName phone") : [];
    const duplicate = openLeads.find((l) => last10(l.phone) === digits) || null;

    const data = {};
    EDITABLE.forEach((k) => {
      if (req.body[k] !== undefined && req.body[k] !== "") data[k] = req.body[k];
    });
    const lead = new Lead({ ...data, createdBy: by || "", assignedTo: mongoose.Types.ObjectId.isValid(req.body.assignedTo) ? req.body.assignedTo : null });
    log(lead, by, "created", `Enquiry received${lead.source ? ` via ${lead.source}` : ""}`);
    lead.followUps.push({
      dueAt: new Date(Date.now() + HOUR),
      type: "first_contact",
      title: "First call — introduce the academy and offer a demo class",
      channel: "call",
      auto: true,
    });
    await lead.save();
    res.json({ lead: await populated(lead._id), duplicateOf: duplicate ? { _id: duplicate._id, parentName: duplicate.parentName } : null });
  } catch (err) {
    console.error("Lead create error:", err);
    res.status(500).json({ message: "Error creating lead" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Lead not found" });
    const lead = await populated(req.params.id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    res.json(lead);
  } catch (err) {
    res.status(500).json({ message: "Error fetching lead" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const lead = await findLead(req, res);
    if (!lead) return;
    const changed = [];
    EDITABLE.forEach((k) => {
      if (req.body[k] !== undefined && String(req.body[k] ?? "") !== String(lead[k] ?? "")) {
        lead[k] = req.body[k] === "" && k === "childAge" ? null : req.body[k];
        changed.push(k);
      }
    });
    if (changed.length) log(lead, req.body.by, "updated", `Details updated (${changed.join(", ")})`);
    await lead.save();
    res.json(await populated(lead._id));
  } catch (err) {
    res.status(500).json({ message: "Error updating lead" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const lead = await findLead(req, res);
    if (!lead) return;
    await lead.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Error deleting lead" });
  }
});

// ---------------------------------------------------------------------------
// STAGE, NOTES, FOLLOW-UPS
// ---------------------------------------------------------------------------
router.post("/:id/stage", async (req, res) => {
  try {
    const lead = await findLead(req, res);
    if (!lead) return;
    const { stage, lostReason, by } = req.body;
    if (!Lead.STAGES.includes(stage)) return res.status(400).json({ message: "Unknown stage" });
    if (stage === "converted") return res.status(400).json({ message: "Use Convert to create the parent account" });
    if (stage === "lost") {
      lead.lostReason = lostReason || "";
      closeOpenFollowUps(lead, "Closed — lead lost");
    }
    setStage(lead, stage, by, stage === "lost" ? lostReason : "");
    await lead.save();
    res.json(await populated(lead._id));
  } catch (err) {
    res.status(500).json({ message: "Error updating stage" });
  }
});

// Log a call / WhatsApp / note. A logged call or message moves a New lead to Contacted.
router.post("/:id/activity", async (req, res) => {
  try {
    const lead = await findLead(req, res);
    if (!lead) return;
    const { type = "note", text = "", by } = req.body;
    if (!["note", "call", "whatsapp", "email"].includes(type)) return res.status(400).json({ message: "Unknown activity" });
    log(lead, by, type, text);
    if (type !== "note" && lead.stage === "new") setStage(lead, "contacted", by);
    await lead.save();
    res.json(await populated(lead._id));
  } catch (err) {
    res.status(500).json({ message: "Error saving activity" });
  }
});

router.post("/:id/followups", async (req, res) => {
  try {
    const lead = await findLead(req, res);
    if (!lead) return;
    const { dueAt, title, channel = "call", note = "", type = "general", by } = req.body;
    if (!dueAt || isNaN(new Date(dueAt))) return res.status(400).json({ message: "Pick a date and time" });
    lead.followUps.push({ dueAt: new Date(dueAt), title: title || "Follow-up", channel, note, type });
    log(lead, by, "followup", `Follow-up planned: ${title || "Follow-up"} — ${fmtWhen(dueAt)}`);
    await lead.save();
    res.json(await populated(lead._id));
  } catch (err) {
    res.status(500).json({ message: "Error adding follow-up" });
  }
});

// Complete (or reopen) a follow-up, optionally with an outcome and a next follow-up
router.patch("/:id/followups/:fid", async (req, res) => {
  try {
    const lead = await findLead(req, res);
    if (!lead) return;
    const f = lead.followUps.id(req.params.fid);
    if (!f) return res.status(404).json({ message: "Follow-up not found" });
    const { done = true, outcome = "", by, nextDueAt, nextTitle } = req.body;
    f.done = !!done;
    f.doneAt = done ? new Date() : null;
    if (outcome) f.outcome = outcome;
    if (done) {
      log(lead, by, f.channel === "whatsapp" ? "whatsapp" : "call", `${f.title || "Follow-up"} done${outcome ? `: ${outcome}` : ""}`);
      // An unanswered call isn't contact yet
      if (lead.stage === "new" && !/^no answer|^not reachable|^busy/i.test(outcome)) setStage(lead, "contacted", by);
    }
    if (nextDueAt && !isNaN(new Date(nextDueAt))) {
      lead.followUps.push({ dueAt: new Date(nextDueAt), title: nextTitle || "Follow-up", channel: f.channel, type: "general" });
      log(lead, by, "followup", `Next follow-up: ${nextTitle || "Follow-up"} — ${fmtWhen(nextDueAt)}`);
    }
    await lead.save();
    res.json(await populated(lead._id));
  } catch (err) {
    res.status(500).json({ message: "Error updating follow-up" });
  }
});

// ---------------------------------------------------------------------------
// DEMO CLASS
// ---------------------------------------------------------------------------
router.post("/:id/demo", async (req, res) => {
  try {
    const lead = await findLead(req, res);
    if (!lead) return;
    const { date, mode, teacherId, meetingLink = "", by } = req.body;
    const when = new Date(date);
    if (!date || isNaN(when)) return res.status(400).json({ message: "Pick the demo date and time" });
    const rescheduling = lead.demo?.status === "scheduled";

    lead.demo.date = when;
    lead.demo.mode = mode === "offline" ? "offline" : "online";
    lead.demo.teacherId = mongoose.Types.ObjectId.isValid(teacherId) ? teacherId : null;
    lead.demo.meetingLink = meetingLink;
    lead.demo.status = "scheduled";
    lead.demo.feedback = "";
    lead.demo.rating = null;

    // One confirmation call before the demo: the day before, or 2 h before if it's soon
    dropAutoFollowUps(lead, "pre_demo");
    const dayBefore = new Date(when.getTime() - DAY);
    const confirmAt = dayBefore > new Date() ? dayBefore : new Date(Math.max(Date.now(), when.getTime() - 2 * HOUR));
    lead.followUps.push({
      dueAt: confirmAt,
      type: "pre_demo",
      title: "Confirm the demo class (time, link/address, materials)",
      channel: "whatsapp",
      auto: true,
    });
    // The open first-contact task is no longer needed once a demo is booked
    lead.followUps.forEach((f) => {
      if (!f.done && f.type === "first_contact") {
        f.done = true;
        f.doneAt = new Date();
        f.outcome = "Demo booked";
      }
    });

    setStage(lead, "demo_scheduled", by);
    log(lead, by, "demo", `${rescheduling ? "Demo rescheduled" : "Demo scheduled"} for ${fmtWhen(when)} (${lead.demo.mode})`);
    await lead.save();

    if (lead.demo.teacherId) {
      const teacher = await User.findById(lead.demo.teacherId).select("pushSubscription fullName");
      pushTo(teacher, {
        title: rescheduling ? "Demo class rescheduled" : "New demo class",
        body: `${lead.childName || lead.parentName} · ${fmtWhen(when)} · ${lead.demo.mode}`,
        url: "https://art-portal.netlify.app",
      });
    }
    res.json(await populated(lead._id));
  } catch (err) {
    console.error("Demo schedule error:", err);
    res.status(500).json({ message: "Error scheduling demo" });
  }
});

router.post("/:id/demo/outcome", async (req, res) => {
  try {
    const lead = await findLead(req, res);
    if (!lead) return;
    const { status, feedback = "", rating, by } = req.body;
    if (!["attended", "no_show", "cancelled"].includes(status)) return res.status(400).json({ message: "Unknown outcome" });
    if (!lead.demo?.date) return res.status(400).json({ message: "No demo scheduled" });
    lead.demo.status = status;
    lead.demo.feedback = feedback;
    lead.demo.rating = rating ? Number(rating) : null;
    dropAutoFollowUps(lead, "pre_demo");
    const now = Date.now();
    if (status === "attended") {
      setStage(lead, "demo_done", by);
      log(lead, by, "demo", `Demo attended${rating ? ` — rated ${rating}/5` : ""}${feedback ? `: ${feedback}` : ""}`);
      lead.followUps.push(
        { dueAt: new Date(now + DAY), type: "post_demo", title: "Share demo feedback, fees and batch timings", channel: "whatsapp", auto: true },
        { dueAt: new Date(now + 3 * DAY), type: "post_demo", title: "Decision call — ready to enrol?", channel: "call", auto: true },
      );
    } else {
      setStage(lead, "contacted", by, status === "no_show" ? "missed the demo" : "demo cancelled");
      log(lead, by, "demo", status === "no_show" ? "Did not attend the demo" : "Demo cancelled");
      lead.followUps.push({ dueAt: new Date(now + DAY), type: "reschedule", title: "Call to reschedule the demo", channel: "call", auto: true });
    }
    await lead.save();
    res.json(await populated(lead._id));
  } catch (err) {
    res.status(500).json({ message: "Error saving demo outcome" });
  }
});

// ---------------------------------------------------------------------------
// CONVERT → parent account (same shape as Admin › Register User)
// ---------------------------------------------------------------------------
router.post("/:id/convert", async (req, res) => {
  try {
    const lead = await findLead(req, res);
    if (!lead) return;
    if (lead.stage === "converted") return res.status(400).json({ message: "Already converted" });
    const { username, password, monthlyFee, classMode, classId, registeredDate, childName, by } = req.body;
    if (!username?.trim() || !password?.trim()) return res.status(400).json({ message: "Username and password are required" });
    if (await User.findOne({ username: username.trim() })) return res.status(400).json({ message: "Username taken — choose another" });

    // Next admission number, matching Register User: TVA{max(existing, count)+1}
    const students = await User.find({ role: "parent" }).select("admissionId");
    const maxExisting = students.reduce((max, s) => {
      const m = /^TVA(\d+)$/i.exec((s.admissionId || "").trim());
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const today = new Date().toISOString().split("T")[0];
    const validClass = mongoose.Types.ObjectId.isValid(classId) ? await Class.findById(classId).select("_id") : null;

    const parent = new User({
      username: username.trim(),
      password: password.trim(),
      role: "parent",
      fullName: lead.parentName,
      childName: (childName || lead.childName || "").trim(),
      childAge: lead.childAge || undefined,
      phone: lead.phone,
      email: lead.email,
      parentEmail: lead.email,
      city: lead.city,
      referredBy: lead.referredBy,
      classMode: classMode === "offline" ? "offline" : "online",
      monthlyFee: Number(monthlyFee) || 0,
      admissionId: `TVA${Math.max(students.length, maxExisting) + 1}`,
      joiningDate: registeredDate || today,
      registeredDate: registeredDate || today,
      assignedClass: validClass ? validClass._id : null,
    });
    await parent.save();
    // Keep Class.students in sync with User.assignedClass
    if (validClass) await Class.findByIdAndUpdate(validClass._id, { $addToSet: { students: parent._id } });

    lead.convertedUserId = parent._id;
    lead.convertedAt = new Date();
    closeOpenFollowUps(lead, "Closed — enrolled");
    setStage(lead, "converted", by);
    log(lead, by, "converted", `Enrolled as ${parent.admissionId} (login: ${parent.username})`);
    await lead.save();
    res.json({ lead: await populated(lead._id), parent: { _id: parent._id, username: parent.username, admissionId: parent.admissionId } });
  } catch (err) {
    console.error("Lead convert error:", err);
    res.status(500).json({ message: "Error converting lead" });
  }
});

// ---------------------------------------------------------------------------
// CLIENTS (enrolled parents): log a follow-up so the team can see when a family
// was last contacted — used by the Clients page in the CRM dashboard.
// ---------------------------------------------------------------------------
router.post("/clients/:id/contact", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Client not found" });
    const { channel = "note", note = "", by = "" } = req.body;
    if (!["call", "whatsapp", "note"].includes(channel)) return res.status(400).json({ message: "Unknown channel" });
    if (channel === "note" && !String(note).trim()) return res.status(400).json({ message: "Write a note first" });
    const client = await User.findById(req.params.id);
    if (!client || client.role !== "parent") return res.status(404).json({ message: "Client not found" });
    client.crmContacts.push({ at: new Date(), by, channel, note: String(note).slice(0, 500) });
    // keep the log bounded
    if (client.crmContacts.length > 100) client.crmContacts = client.crmContacts.slice(-100);
    await client.save();
    res.json({ crmContacts: client.crmContacts });
  } catch (err) {
    console.error("Client contact log error:", err);
    res.status(500).json({ message: "Error saving follow-up" });
  }
});

// ---------------------------------------------------------------------------
// Morning summary push for admissions staff (called by the scheduler)
// ---------------------------------------------------------------------------
const sendCrmDailySummary = async () => {
  try {
    const IST = 5.5 * HOUR;
    const istNow = new Date(Date.now() + IST);
    const endOfDay = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate(), 23, 59, 59) - IST);
    const startOfDay = new Date(endOfDay.getTime() - DAY + 1000);
    const open = await Lead.find({ stage: { $nin: ["converted", "lost"] } }).select("followUps demo");
    let due = 0;
    let overdue = 0;
    let demos = 0;
    open.forEach((l) => {
      l.followUps.forEach((f) => {
        if (f.done) return;
        if (f.dueAt < startOfDay) overdue++;
        else if (f.dueAt <= endOfDay) due++;
      });
      if (l.demo?.status === "scheduled" && l.demo.date >= startOfDay && l.demo.date <= endOfDay) demos++;
    });
    if (!due && !overdue && !demos) return;
    const staff = await User.find({ role: "crm", pushSubscription: { $ne: null }, isActive: { $ne: false } }).select("pushSubscription");
    const parts = [];
    if (due) parts.push(`${due} follow-up${due === 1 ? "" : "s"} today`);
    if (overdue) parts.push(`${overdue} overdue`);
    if (demos) parts.push(`${demos} demo class${demos === 1 ? "" : "es"}`);
    await Promise.all(
      staff.map((u) => pushTo(u, { title: "Admissions — today", body: parts.join(" · "), url: "https://art-portal.netlify.app", tag: "crm-daily" })),
    );
    console.log(`📋 CRM summary sent to ${staff.length}: ${parts.join(", ")}`);
  } catch (err) {
    console.error("CRM summary error:", err);
  }
};

module.exports = { router, sendCrmDailySummary };
