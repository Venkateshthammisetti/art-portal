// Admissions CRM dashboard (role "crm"): enquiries → demo class → enrolled parent.
// Tabs: Today (what to do now), Leads (list + pipeline board), Demos, Clients (enrolled
// families: status, location, referrals, follow-ups), Reports.
// The server creates the routine follow-ups automatically (see server/leads.js);
// this screen is about acting on them quickly: call, WhatsApp, log, move on.
import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import "./CRMDashboard.css";
import {
  IconHome, IconUsers, IconCalendar, IconChart, IconPlus, IconSearch, IconWhatsApp, IconPhone,
  IconCheck, IconClock, IconTrash, IconEdit, IconLogout, IconSun, IconMoon, IconNote, IconTrophy,
  IconWarning, IconRefresh, IconChevronRight, IconMail, IconUser, IconSuccess, IconError, IconInbox,
} from "./Icons";
import { subscribeDeviceToPush } from "../pushSubscribe";
import { Sheet, Field, fmtTime, fmtDate, fmtDateTime, waHref, telHref, firstName } from "./crmShared";
import { ClientsTab, ClientDetail, ClientMessageSheet, buildClients, logClientContact } from "./CRMClients";
import logoImg from "./new-logo.png";

const API = "https://art-portal-7n6r.onrender.com/api/leads";
const BASE = "https://art-portal-7n6r.onrender.com/api";

export const STAGES = [
  { key: "new", label: "New enquiry", short: "New", tone: "blue" },
  { key: "contacted", label: "Contacted", short: "Contacted", tone: "violet" },
  { key: "demo_scheduled", label: "Demo scheduled", short: "Demo booked", tone: "amber" },
  { key: "demo_done", label: "Demo done", short: "Demo done", tone: "teal" },
  { key: "converted", label: "Converted", short: "Enrolled", tone: "green" },
  { key: "lost", label: "Lost", short: "Lost", tone: "grey" },
];
const stageOf = (k) => STAGES.find((s) => s.key === k) || STAGES[0];
const OPEN_STAGES = ["new", "contacted", "demo_scheduled", "demo_done"];
const SOURCES = ["Instagram", "Facebook", "Google", "WhatsApp", "Referral", "Website", "Walk-in", "Phone call", "Other"];
const LOST_REASONS = ["Fees too high", "Timing doesn't suit", "Chose another academy", "Not interested now", "No response", "Location too far", "Other"];
const CHANNEL_ICON = { call: IconPhone, whatsapp: IconWhatsApp, email: IconMail, visit: IconUser };

// ---------------- helpers ----------------
const DAY = 86400000;
const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dueLabel = (d) => {
  const t = new Date(d);
  const today = startOfDay();
  const days = Math.round((startOfDay(t) - today) / DAY);
  if (t < new Date() && days < 0) return { text: `Overdue ${-days}d`, tone: "overdue" };
  if (t < new Date()) return { text: `Overdue · ${fmtTime(t)}`, tone: "overdue" };
  if (days === 0) return { text: `Today · ${fmtTime(t)}`, tone: "today" };
  if (days === 1) return { text: `Tomorrow · ${fmtTime(t)}`, tone: "soon" };
  return { text: fmtDateTime(t), tone: "later" };
};
// <input type="datetime-local"> wants local "YYYY-MM-DDTHH:mm"
const toLocalInput = (d) => {
  const x = new Date(d);
  const p = (n) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`;
};
const at = (daysAhead, hour, minute = 0) => {
  const d = startOfDay(new Date(Date.now() + daysAhead * DAY));
  d.setHours(hour, minute, 0, 0);
  return d;
};
const QUICK_TIMES = [
  { label: "In 2 hours", get: () => new Date(Date.now() + 2 * 3600000) },
  { label: "Tomorrow 10 am", get: () => at(1, 10) },
  { label: "In 3 days", get: () => at(3, 11) },
  { label: "Next week", get: () => at(7, 11) },
];
// Demo teacher may come populated ({_id, fullName}) or as a bare id
const teacherIdOf = (demo) => (demo?.teacherId && typeof demo.teacherId === "object" ? demo.teacherId._id : demo?.teacherId) || "";
const teacherNameOf = (demo, teachers = []) => {
  if (demo?.teacherId && typeof demo.teacherId === "object" && demo.teacherId.fullName) return demo.teacherId.fullName;
  const t = teachers.find((x) => x._id === teacherIdOf(demo));
  return t ? t.fullName || t.username : "";
};

// Plain-text WhatsApp templates (no emoji: some phones show them as "?")
const TEMPLATES = {
  intro: (l) =>
    `Hello ${firstName(l.parentName)}, thank you for contacting Thevenkyart Art Academy!\n\n` +
    `We would love to have ${l.childName || "your child"} join a free demo class so you can see how we teach. ` +
    `Which day and time suits you best this week?`,
  demoConfirm: (l) =>
    `Hello ${firstName(l.parentName)}, this is a reminder of ${l.childName || "your child"}'s demo class at Thevenkyart Art Academy on ` +
    `${l.demo?.date ? fmtDateTime(l.demo.date) : "the scheduled time"}` +
    `${l.demo?.mode === "online" && l.demo?.meetingLink ? `.\n\nJoin here: ${l.demo.meetingLink}` : "."}\n\n` +
    `Please keep a pencil, eraser and drawing paper ready. See you there!`,
  postDemo: (l) =>
    `Hello ${firstName(l.parentName)}, thank you for attending the demo class! ` +
    `It was lovely having ${l.childName || "your child"} with us.\n\n` +
    `Would you like me to share the batch timings and fee details so ${l.childName || "they"} can start regular classes?`,
  checkIn: (l) =>
    `Hello ${firstName(l.parentName)}, just checking in from Thevenkyart Art Academy. ` +
    `Do you have any questions about the classes for ${l.childName || "your child"}? Happy to help.`,
};

// ---------------- shared UI ----------------
const StageBadge = ({ stage }) => {
  const s = stageOf(stage);
  return <span className={`crm-badge tone-${s.tone}`}>{s.short}</span>;
};

const QuickTimes = ({ onPick }) => (
  <div className="crm-quick-times" role="group" aria-label="Quick times">
    {QUICK_TIMES.map((q) => (
      <button key={q.label} type="button" className="crm-chip" onClick={() => onPick(toLocalInput(q.get()))}>
        {q.label}
      </button>
    ))}
  </div>
);

const ContactButtons = ({ lead, template = "checkIn", compact = false, onLogged }) => {
  const wa = waHref(lead.phone, TEMPLATES[template](lead));
  return (
    <div className={`crm-contact${compact ? " compact" : ""}`}>
      <a className="crm-btn crm-btn-ghost" href={telHref(lead.phone)} onClick={() => onLogged?.("call")} aria-label={`Call ${lead.parentName}`}>
        <IconPhone /> {!compact && "Call"}
      </a>
      {wa && (
        <a className="crm-btn crm-btn-wa" href={wa} target="_blank" rel="noopener noreferrer" onClick={() => onLogged?.("whatsapp")} aria-label={`WhatsApp ${lead.parentName}`}>
          <IconWhatsApp /> {!compact && "WhatsApp"}
        </a>
      )}
    </div>
  );
};

// ---------------- add lead ----------------
const emptyLead = { parentName: "", phone: "", childName: "", childAge: "", email: "", city: "", source: "Instagram", referredBy: "", interestMode: "either", preferredTime: "", notes: "" };

const AddLeadSheet = ({ by, dark, onClose, onCreated, onOpenLead }) => {
  const [f, setF] = useState(emptyLead);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dupe, setDupe] = useState(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    if (!f.parentName.trim() || !f.phone.trim()) {
      setError("Parent name and phone number are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await axios.post(API, { ...f, childAge: f.childAge ? Number(f.childAge) : undefined, by });
      onCreated(res.data.lead);
      if (res.data.duplicateOf) setDupe({ ...res.data.duplicateOf, created: res.data.lead });
      else onClose(res.data.lead);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't save the lead. Try again.");
    } finally {
      setSaving(false);
    }
  };
  if (dupe) {
    return (
      <Sheet title="Lead saved" onClose={() => onClose(dupe.created)} dark={dark}>
        <div className="crm-notice warn">
          <IconWarning /> This number is already being followed up as <strong>{dupe.parentName}</strong>.
        </div>
        <div className="crm-row-actions">
          <button type="button" className="crm-btn crm-btn-ghost" onClick={() => onOpenLead(dupe._id)}>Open existing lead</button>
          <button type="button" className="crm-btn crm-btn-primary" onClick={() => onClose(dupe.created)} data-autofocus>Continue with new lead</button>
        </div>
      </Sheet>
    );
  }
  return (
    <Sheet title="New enquiry" onClose={() => onClose(null)} dark={dark}>
      <form className="crm-form" onSubmit={submit} noValidate>
        <div className="crm-grid2">
          <Field label="Parent name" required><input data-autofocus value={f.parentName} onChange={set("parentName")} autoComplete="off" /></Field>
          <Field label="Phone" required><input type="tel" inputMode="tel" value={f.phone} onChange={set("phone")} placeholder="98xxxxxxxx" /></Field>
          <Field label="Child's name"><input value={f.childName} onChange={set("childName")} /></Field>
          <Field label="Child's age"><input type="number" inputMode="numeric" min="2" max="60" value={f.childAge} onChange={set("childAge")} /></Field>
          <Field label="Source" required>
            <select value={f.source} onChange={set("source")}>
              {SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          {f.source === "Referral" ? (
            <Field label="Referred by"><input value={f.referredBy} onChange={set("referredBy")} placeholder="Parent or student name" /></Field>
          ) : (
            <Field label="City"><input value={f.city} onChange={set("city")} /></Field>
          )}
          <Field label="Prefers">
            <select value={f.interestMode} onChange={set("interestMode")}>
              <option value="either">Online or offline</option>
              <option value="online">Online classes</option>
              <option value="offline">Offline classes</option>
            </select>
          </Field>
          <Field label="Preferred days / time"><input value={f.preferredTime} onChange={set("preferredTime")} placeholder="e.g. Weekends, evening" /></Field>
        </div>
        <Field label="Notes"><textarea rows={3} value={f.notes} onChange={set("notes")} placeholder="What are they looking for?" /></Field>
        <p className="crm-hint">A “first call” follow-up is added automatically for the next hour.</p>
        {error && <p className="crm-error" role="alert"><IconError /> {error}</p>}
        <div className="crm-form-actions">
          <button type="button" className="crm-btn crm-btn-ghost" onClick={() => onClose(null)}>Cancel</button>
          <button type="submit" className="crm-btn crm-btn-primary" disabled={saving}>{saving ? "Saving…" : <><IconPlus /> Add lead</>}</button>
        </div>
      </form>
    </Sheet>
  );
};

// ---------------- lead detail ----------------
const LeadDetail = ({ lead, by, dark, teachers, classes, onClose, onUpdated, onDeleted }) => {
  const [panel, setPanel] = useState(null); // demo | outcome | followup | complete | note | convert | lost | edit | delete
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({});
  const [converted, setConverted] = useState(null);
  const set = (k) => (e) => setForm((x) => ({ ...x, [k]: e.target.value }));

  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      const updated = await fn();
      if (updated) onUpdated(updated);
      setPanel(null);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const post = (path, body) => axios.post(`${API}/${lead._id}${path}`, { ...body, by }).then((r) => r.data);

  const open = (p, initial = {}) => {
    setError("");
    setForm(initial);
    setPanel(p);
  };

  const logContact = (type) => post("/activity", { type, text: type === "call" ? "Called the parent" : "Sent a WhatsApp message" }).then(onUpdated).catch(() => {});
  const openFollowUps = (lead.followUps || []).filter((f) => !f.done).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  const doneFollowUps = (lead.followUps || []).filter((f) => f.done).sort((a, b) => new Date(b.doneAt || b.dueAt) - new Date(a.doneAt || a.dueAt));
  const isClosed = lead.stage === "converted" || lead.stage === "lost";
  const demo = lead.demo || {};
  const template = lead.stage === "demo_scheduled" ? "demoConfirm" : lead.stage === "demo_done" ? "postDemo" : lead.stage === "new" ? "intro" : "checkIn";
  const stageIndex = STAGES.findIndex((s) => s.key === lead.stage);

  return (
    <Sheet title={lead.parentName} onClose={onClose} dark={dark} wide labelledBy="crm-lead-title">
      <div className="crm-lead-top">
        <div>
          <p className="crm-lead-sub">
            {lead.childName ? <>For <strong>{lead.childName}</strong>{lead.childAge ? `, ${lead.childAge} yrs` : ""} · </> : null}
            {lead.phone} · {lead.source}
          </p>
          <StageBadge stage={lead.stage} />
        </div>
        <ContactButtons lead={lead} template={template} onLogged={logContact} />
      </div>

      {/* Stage progress */}
      {lead.stage !== "lost" && (
        <ol className="crm-steps" aria-label="Progress">
          {STAGES.filter((s) => s.key !== "lost").map((s, i) => (
            <li key={s.key} className={i < stageIndex ? "done" : i === stageIndex ? "current" : ""} aria-current={i === stageIndex ? "step" : undefined}>
              <span className="crm-step-dot" aria-hidden="true">{i < stageIndex ? <IconCheck size={12} /> : i + 1}</span>
              <span className="crm-step-label">{s.short}</span>
            </li>
          ))}
        </ol>
      )}
      {lead.stage === "lost" && <div className="crm-notice">Marked lost{lead.lostReason ? `: ${lead.lostReason}` : ""}.</div>}
      {converted && (
        <div className="crm-notice ok" role="status">
          <IconSuccess /> Enrolled as <strong>{converted.admissionId}</strong> — login <strong>{converted.username}</strong>
          {waHref(lead.phone, "") && (
            <a
              className="crm-btn crm-btn-wa crm-btn-sm"
              target="_blank"
              rel="noopener noreferrer"
              href={waHref(
                lead.phone,
                `Welcome to Thevenkyart Art Academy, ${firstName(lead.parentName)}!\n\n${lead.childName || "Your child"} is now enrolled (${converted.admissionId}).\n\n` +
                  `Parent portal: https://art-portal.netlify.app\nUsername: ${converted.username}\nPassword: ${converted.password}\n\n` +
                  `You can see classes, attendance, artworks and fees there.`,
              )}
            >
              <IconWhatsApp /> Send login on WhatsApp
            </a>
          )}
        </div>
      )}

      {error && !panel && <p className="crm-error" role="alert"><IconError /> {error}</p>}

      {/* Next steps */}
      {!isClosed && !panel && (
        <div className="crm-next">
          {(lead.stage === "new" || lead.stage === "contacted" || demo.status !== "scheduled") && lead.stage !== "demo_done" && (
            <button type="button" className="crm-btn crm-btn-primary" onClick={() => open("demo", { date: toLocalInput(at(1, 17)), mode: lead.interestMode === "offline" ? "offline" : "online", teacherId: "", meetingLink: "" })}>
              <IconCalendar /> Book demo class
            </button>
          )}
          {demo.status === "scheduled" && (
            <>
              <button type="button" className="crm-btn crm-btn-primary" onClick={() => open("outcome", { status: "attended", rating: "5", feedback: "" })}>
                <IconCheck /> Record demo outcome
              </button>
              <button type="button" className="crm-btn crm-btn-ghost" onClick={() => open("demo", { date: toLocalInput(demo.date), mode: demo.mode || "online", teacherId: teacherIdOf(demo), meetingLink: demo.meetingLink || "" })}>
                Reschedule
              </button>
            </>
          )}
          {(lead.stage === "demo_done" || lead.stage === "contacted") && (
            <button type="button" className="crm-btn crm-btn-success" onClick={() => open("convert", {
              username: (lead.childName || lead.parentName).toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "") + Math.floor(10 + Math.random() * 89),
              password: Math.random().toString(36).slice(2, 8),
              monthlyFee: "", classMode: demo.mode || (lead.interestMode === "offline" ? "offline" : "online"), classId: "", childName: lead.childName || "",
              registeredDate: new Date().toISOString().slice(0, 10),
            })}>
              <IconTrophy /> Convert to student
            </button>
          )}
          <button type="button" className="crm-btn crm-btn-ghost" onClick={() => open("followup", { dueAt: toLocalInput(at(1, 11)), title: "", channel: "call" })}><IconClock /> Plan follow-up</button>
          <button type="button" className="crm-btn crm-btn-ghost" onClick={() => open("note", { text: "", type: "note" })}><IconNote /> Add note</button>
        </div>
      )}

      {/* Panels */}
      {panel === "demo" && (
        <form className="crm-panel" onSubmit={(e) => { e.preventDefault(); run(() => post("/demo", { ...form, date: new Date(form.date).toISOString() })); }}>
          <h3>{demo.status === "scheduled" ? "Reschedule demo" : "Book demo class"}</h3>
          <div className="crm-grid2">
            <Field label="Date & time" required><input type="datetime-local" value={form.date} onChange={set("date")} required data-autofocus /></Field>
            <Field label="Mode">
              <select value={form.mode} onChange={set("mode")}><option value="online">Online</option><option value="offline">At the academy</option></select>
            </Field>
            <Field label="Teacher" hint="They get a notification on their phone.">
              <select value={form.teacherId} onChange={set("teacherId")}>
                <option value="">Not assigned yet</option>
                {teachers.map((t) => <option key={t._id} value={t._id}>{t.fullName || t.username}</option>)}
              </select>
            </Field>
            {form.mode === "online" && <Field label="Meeting link"><input type="url" value={form.meetingLink} onChange={set("meetingLink")} placeholder="https://" /></Field>}
          </div>
          <p className="crm-hint">A confirmation reminder is added for the day before.</p>
          <PanelActions busy={busy} error={error} onCancel={() => setPanel(null)} label="Save demo" />
        </form>
      )}

      {panel === "outcome" && (
        <form className="crm-panel" onSubmit={(e) => { e.preventDefault(); run(() => post("/demo/outcome", form)); }}>
          <h3>How did the demo go?</h3>
          <div className="crm-segment" role="radiogroup" aria-label="Outcome">
            {[["attended", "Attended"], ["no_show", "Didn't attend"], ["cancelled", "Cancelled"]].map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={form.status === v} className={form.status === v ? "active" : ""} onClick={() => setForm((x) => ({ ...x, status: v }))}>{l}</button>
            ))}
          </div>
          {form.status === "attended" && (
            <div className="crm-grid2">
              <Field label="Child's interest (1–5)">
                <select value={form.rating} onChange={set("rating")}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}</select>
              </Field>
              <Field label="Teacher / parent feedback"><input value={form.feedback} onChange={set("feedback")} placeholder="e.g. Enjoyed shading, parent asked about fees" /></Field>
            </div>
          )}
          <p className="crm-hint">{form.status === "attended" ? "Two follow-ups are added: share fees tomorrow, decision call in 3 days." : "A call to reschedule is added for tomorrow."}</p>
          <PanelActions busy={busy} error={error} onCancel={() => setPanel(null)} label="Save outcome" />
        </form>
      )}

      {panel === "followup" && (
        <form className="crm-panel" onSubmit={(e) => { e.preventDefault(); run(() => post("/followups", { ...form, dueAt: new Date(form.dueAt).toISOString(), title: form.title || "Follow-up" })); }}>
          <h3>Plan a follow-up</h3>
          <QuickTimes onPick={(v) => setForm((x) => ({ ...x, dueAt: v }))} />
          <div className="crm-grid2">
            <Field label="When" required><input type="datetime-local" value={form.dueAt} onChange={set("dueAt")} required /></Field>
            <Field label="How">
              <select value={form.channel} onChange={set("channel")}><option value="call">Call</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="visit">Visit</option></select>
            </Field>
          </div>
          <Field label="What for"><input value={form.title} onChange={set("title")} placeholder="e.g. Share fee details" data-autofocus /></Field>
          <PanelActions busy={busy} error={error} onCancel={() => setPanel(null)} label="Add follow-up" />
        </form>
      )}

      {panel === "complete" && (
        <form className="crm-panel" onSubmit={(e) => { e.preventDefault(); run(() => axios.patch(`${API}/${lead._id}/followups/${form.id}`, { done: true, outcome: form.outcome, nextDueAt: form.next ? new Date(form.next).toISOString() : undefined, nextTitle: form.nextTitle, by }).then((r) => r.data)); }}>
          <h3>Done: {form.title}</h3>
          <Field label="What happened?"><input value={form.outcome} onChange={set("outcome")} placeholder="e.g. Parent will confirm tomorrow" data-autofocus /></Field>
          <Field label="Next follow-up (optional)">
            <QuickTimes onPick={(v) => setForm((x) => ({ ...x, next: v }))} />
            <input type="datetime-local" value={form.next || ""} onChange={set("next")} />
          </Field>
          {form.next && <Field label="Next follow-up is for"><input value={form.nextTitle || ""} onChange={set("nextTitle")} placeholder="Follow-up" /></Field>}
          <PanelActions busy={busy} error={error} onCancel={() => setPanel(null)} label="Mark done" />
        </form>
      )}

      {panel === "note" && (
        <form className="crm-panel" onSubmit={(e) => { e.preventDefault(); if (form.text.trim()) run(() => post("/activity", form)); }}>
          <h3>Add to timeline</h3>
          <div className="crm-segment" role="radiogroup" aria-label="Type">
            {[["note", "Note"], ["call", "Call"], ["whatsapp", "WhatsApp"]].map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={form.type === v} className={form.type === v ? "active" : ""} onClick={() => setForm((x) => ({ ...x, type: v }))}>{l}</button>
            ))}
          </div>
          <Field label="Details"><textarea rows={3} value={form.text} onChange={set("text")} data-autofocus /></Field>
          <PanelActions busy={busy} error={error} onCancel={() => setPanel(null)} label="Save" />
        </form>
      )}

      {panel === "convert" && (
        <form className="crm-panel" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await post("/convert", form); setConverted({ ...r.parent, password: form.password }); return r.lead; }); }}>
          <h3>Convert to student</h3>
          <p className="crm-hint">Creates the parent login with the details on this lead and the next admission number.</p>
          <div className="crm-grid2">
            <Field label="Child's name"><input value={form.childName} onChange={set("childName")} /></Field>
            <Field label="Monthly fee (₹)"><input type="number" inputMode="numeric" min="0" value={form.monthlyFee} onChange={set("monthlyFee")} /></Field>
            <Field label="Username" required><input value={form.username} onChange={set("username")} autoComplete="off" required /></Field>
            <Field label="Password" required><input value={form.password} onChange={set("password")} autoComplete="off" required /></Field>
            <Field label="Class mode">
              <select value={form.classMode} onChange={set("classMode")}><option value="online">Online</option><option value="offline">Offline</option></select>
            </Field>
            <Field label="Join class (optional)">
              <select value={form.classId} onChange={set("classId")}>
                <option value="">Assign later</option>
                {classes.filter((c) => !form.classMode || (c.classMode || "online") === form.classMode).map((c) => (
                  <option key={c._id} value={c._id}>{c.className} ({(c.students || []).length}/{c.maxCapacity || 10})</option>
                ))}
              </select>
            </Field>
            <Field label="Fees start from"><input type="date" value={form.registeredDate} onChange={set("registeredDate")} /></Field>
          </div>
          <PanelActions busy={busy} error={error} onCancel={() => setPanel(null)} label="Create student" tone="success" />
        </form>
      )}

      {panel === "lost" && (
        <form className="crm-panel" onSubmit={(e) => { e.preventDefault(); run(() => post("/stage", { stage: "lost", lostReason: form.reason })); }}>
          <h3>Mark as lost</h3>
          <Field label="Reason">
            <select value={form.reason} onChange={set("reason")} data-autofocus>{LOST_REASONS.map((r) => <option key={r}>{r}</option>)}</select>
          </Field>
          <p className="crm-hint">Open follow-ups are closed. You can reopen the lead later.</p>
          <PanelActions busy={busy} error={error} onCancel={() => setPanel(null)} label="Mark lost" tone="danger" />
        </form>
      )}

      {panel === "edit" && (
        <form className="crm-panel" onSubmit={(e) => { e.preventDefault(); run(() => axios.put(`${API}/${lead._id}`, { ...form, by }).then((r) => r.data)); }}>
          <h3>Edit details</h3>
          <div className="crm-grid2">
            {[["parentName", "Parent name"], ["phone", "Phone"], ["childName", "Child's name"], ["childAge", "Child's age"], ["email", "Email"], ["city", "City"], ["referredBy", "Referred by"], ["preferredTime", "Preferred days / time"]].map(([k, l]) => (
              <Field key={k} label={l}><input value={form[k] ?? ""} onChange={set(k)} type={k === "childAge" ? "number" : k === "email" ? "email" : "text"} /></Field>
            ))}
            <Field label="Source"><select value={form.source} onChange={set("source")}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select></Field>
          </div>
          <Field label="Notes"><textarea rows={3} value={form.notes ?? ""} onChange={set("notes")} /></Field>
          <PanelActions busy={busy} error={error} onCancel={() => setPanel(null)} label="Save details" />
        </form>
      )}

      {panel === "delete" && (
        <div className="crm-panel">
          <h3>Delete this lead?</h3>
          <p className="crm-hint">The lead and its whole history are removed. To keep the history, mark it lost instead.</p>
          <div className="crm-form-actions">
            <button type="button" className="crm-btn crm-btn-ghost" onClick={() => setPanel(null)} data-autofocus>Cancel</button>
            <button type="button" className="crm-btn crm-btn-danger" disabled={busy} onClick={() => run(async () => { await axios.delete(`${API}/${lead._id}`); onDeleted(lead._id); return null; })}>Delete lead</button>
          </div>
        </div>
      )}

      {/* Demo */}
      {demo.date && (
        <section className="crm-section">
          <h3 className="crm-section-title"><IconCalendar /> Demo class</h3>
          <div className="crm-demo-card">
            <p><strong>{fmtDateTime(demo.date)}</strong> · {demo.mode === "offline" ? "At the academy" : "Online"}</p>
            <p className="crm-muted">
              {teacherNameOf(demo, teachers) ? `Teacher: ${teacherNameOf(demo, teachers)}` : "Teacher not assigned"}
              {demo.status && ` · ${({ scheduled: "Scheduled", attended: "Attended", no_show: "Didn't attend", cancelled: "Cancelled" })[demo.status]}`}
              {demo.rating ? ` · Interest ${demo.rating}/5` : ""}
            </p>
            {demo.feedback && <p className="crm-muted">“{demo.feedback}”</p>}
            {demo.meetingLink && demo.status === "scheduled" && <a className="crm-link" href={demo.meetingLink} target="_blank" rel="noopener noreferrer">Meeting link <IconChevronRight size={14} /></a>}
          </div>
        </section>
      )}

      {/* Follow-ups */}
      <section className="crm-section">
        <h3 className="crm-section-title"><IconClock /> Follow-ups</h3>
        {openFollowUps.length === 0 && <p className="crm-muted">{isClosed ? "No open follow-ups." : "Nothing planned — add a follow-up so this lead doesn't go cold."}</p>}
        <ul className="crm-list">
          {openFollowUps.map((f) => {
            const due = dueLabel(f.dueAt);
            const Ico = CHANNEL_ICON[f.channel] || IconPhone;
            return (
              <li key={f._id} className="crm-task">
                <span className={`crm-task-icon tone-${due.tone}`} aria-hidden="true"><Ico /></span>
                <div className="crm-task-body">
                  <p className="crm-task-title">{f.title || "Follow-up"}{f.auto && <span className="crm-auto">auto</span>}</p>
                  <p className={`crm-due tone-${due.tone}`}>{due.text}</p>
                </div>
                <button type="button" className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => open("complete", { id: f._id, title: f.title || "Follow-up", outcome: "" })}><IconCheck /> Done</button>
              </li>
            );
          })}
        </ul>
        {doneFollowUps.length > 0 && (
          <details className="crm-details">
            <summary>{doneFollowUps.length} completed</summary>
            <ul className="crm-list">
              {doneFollowUps.map((f) => (
                <li key={f._id} className="crm-task done">
                  <span className="crm-task-icon" aria-hidden="true"><IconCheck /></span>
                  <div className="crm-task-body">
                    <p className="crm-task-title">{f.title || "Follow-up"}</p>
                    <p className="crm-muted">{f.doneAt ? fmtDateTime(f.doneAt) : ""}{f.outcome ? ` · ${f.outcome}` : ""}</p>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Timeline */}
      <section className="crm-section">
        <h3 className="crm-section-title"><IconNote /> Timeline</h3>
        <ol className="crm-timeline">
          {[...(lead.activities || [])].reverse().map((a) => (
            <li key={a._id || a.at} className={`t-${a.type}`}>
              <p className="crm-tl-text">{a.text}</p>
              <p className="crm-muted">{fmtDateTime(a.at)}{a.by ? ` · ${a.by}` : ""}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Details + housekeeping */}
      <section className="crm-section">
        <h3 className="crm-section-title"><IconUser /> Details</h3>
        <dl className="crm-dl">
          {[["Phone", lead.phone], ["Email", lead.email], ["City", lead.city], ["Prefers", { online: "Online classes", offline: "Offline classes", either: "Online or offline" }[lead.interestMode]], ["Preferred time", lead.preferredTime], ["Referred by", lead.referredBy], ["Enquired", fmtDateTime(lead.createdAt)], ["Notes", lead.notes]]
            .filter(([, v]) => v)
            .map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
        </dl>
        <div className="crm-row-actions">
          {lead.stage !== "converted" && (
            <button type="button" className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => open("edit", { ...lead })}><IconEdit /> Edit</button>
          )}
          {lead.stage === "lost" ? (
            <button type="button" className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => run(() => post("/stage", { stage: "contacted" }))}>Reopen lead</button>
          ) : lead.stage !== "converted" && (
            <button type="button" className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => open("lost", { reason: LOST_REASONS[0] })}>Mark lost</button>
          )}
          <button type="button" className="crm-btn crm-btn-ghost crm-btn-sm crm-danger-text" onClick={() => open("delete")}><IconTrash /> Delete</button>
        </div>
      </section>
    </Sheet>
  );
};

const PanelActions = ({ busy, error, onCancel, label, tone = "primary" }) => (
  <>
    {error && <p className="crm-error" role="alert"><IconError /> {error}</p>}
    <div className="crm-form-actions">
      <button type="button" className="crm-btn crm-btn-ghost" onClick={onCancel}>Cancel</button>
      <button type="submit" className={`crm-btn crm-btn-${tone}`} disabled={busy}>{busy ? "Saving…" : label}</button>
    </div>
  </>
);

// ---------------- list pieces ----------------
const LeadCard = ({ lead, onOpen }) => {
  const due = lead.nextFollowUpAt && OPEN_STAGES.includes(lead.stage) ? dueLabel(lead.nextFollowUpAt) : null;
  return (
    <button type="button" className="crm-card crm-lead-card" onClick={() => onOpen(lead._id)}>
      <div className="crm-card-row">
        <span className="crm-lead-name">{lead.parentName}</span>
        <StageBadge stage={lead.stage} />
      </div>
      <p className="crm-muted">{lead.childName ? `${lead.childName}${lead.childAge ? `, ${lead.childAge}` : ""} · ` : ""}{lead.source}</p>
      {lead.demo?.status === "scheduled" && <p className="crm-meta"><IconCalendar /> Demo {fmtDateTime(lead.demo.date)}</p>}
      {due && <p className={`crm-meta crm-due tone-${due.tone}`}><IconClock /> {due.text}</p>}
      {!due && OPEN_STAGES.includes(lead.stage) && <p className="crm-meta crm-due tone-overdue"><IconWarning /> No follow-up planned</p>}
    </button>
  );
};

// ---------------- tabs ----------------
const TodayTab = ({ leads, onOpen, onComplete, user, teachers }) => {
  const now = new Date();
  const endToday = new Date(startOfDay().getTime() + DAY - 1);
  const tasks = [];
  leads.forEach((l) => {
    if (!OPEN_STAGES.includes(l.stage)) return;
    (l.followUps || []).forEach((f) => !f.done && tasks.push({ lead: l, f, due: new Date(f.dueAt) }));
  });
  tasks.sort((a, b) => a.due - b.due);
  const overdue = tasks.filter((t) => t.due < startOfDay());
  const today = tasks.filter((t) => t.due >= startOfDay() && t.due <= endToday);
  const demos = leads
    .filter((l) => l.demo?.status === "scheduled" && new Date(l.demo.date) <= new Date(endToday.getTime() + DAY))
    .sort((a, b) => new Date(a.demo.date) - new Date(b.demo.date));
  const weekAgo = new Date(now - 7 * DAY);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const kpis = [
    { label: "Overdue", value: overdue.length, tone: overdue.length ? "red" : "grey" },
    { label: "Due today", value: today.length, tone: "blue" },
    { label: "Demos today & tomorrow", value: demos.length, tone: "amber" },
    { label: "New this week", value: leads.filter((l) => new Date(l.createdAt) >= weekAgo).length, tone: "violet" },
    { label: "Enrolled this month", value: leads.filter((l) => l.convertedAt && new Date(l.convertedAt) >= monthStart).length, tone: "green" },
  ];
  const hour = now.getHours();
  const Task = ({ t }) => {
    const due = dueLabel(t.f.dueAt);
    const template = t.f.type === "pre_demo" ? "demoConfirm" : t.f.type === "post_demo" ? "postDemo" : t.f.type === "first_contact" ? "intro" : "checkIn";
    return (
      <li className="crm-card crm-task-card">
        <button type="button" className="crm-task-main" onClick={() => onOpen(t.lead._id)}>
          <p className="crm-task-title">{t.f.title || "Follow-up"}</p>
          <p className="crm-muted">{t.lead.parentName}{t.lead.childName ? ` · ${t.lead.childName}` : ""}</p>
          <p className={`crm-due tone-${due.tone}`}>{due.text}</p>
        </button>
        <div className="crm-task-actions">
          <ContactButtons lead={t.lead} template={template} compact />
          <button type="button" className="crm-btn crm-btn-ghost crm-btn-icon" onClick={() => onComplete(t.lead._id, t.f)} aria-label={`Mark "${t.f.title || "follow-up"}" done`}><IconCheck /></button>
        </div>
      </li>
    );
  };
  return (
    <div className="crm-tab">
      <h2 className="crm-greet">Good {hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}, {firstName(user.fullName || user.username)}</h2>
      <div className="crm-kpis">
        {kpis.map((k) => (
          <div key={k.label} className={`crm-kpi tone-${k.tone}`}><span className="crm-kpi-value">{k.value}</span><span className="crm-kpi-label">{k.label}</span></div>
        ))}
      </div>
      {overdue.length + today.length + demos.length === 0 && (
        <div className="crm-empty"><IconSuccess size={30} /><p><strong>All caught up.</strong> No follow-ups or demos due today.</p></div>
      )}
      {overdue.length > 0 && (<><h3 className="crm-h3 tone-red">Overdue ({overdue.length})</h3><ul className="crm-stack">{overdue.map((t) => <Task key={t.f._id} t={t} />)}</ul></>)}
      {today.length > 0 && (<><h3 className="crm-h3">Due today ({today.length})</h3><ul className="crm-stack">{today.map((t) => <Task key={t.f._id} t={t} />)}</ul></>)}
      {demos.length > 0 && (
        <>
          <h3 className="crm-h3">Demo classes — today & tomorrow</h3>
          <ul className="crm-stack">
            {demos.map((l) => (
              <li key={l._id}>
                <button type="button" className="crm-card crm-lead-card" onClick={() => onOpen(l._id)}>
                  <div className="crm-card-row"><span className="crm-lead-name">{l.childName || l.parentName}</span><span className="crm-badge tone-amber">{fmtTime(l.demo.date)}</span></div>
                  <p className="crm-muted">{fmtDate(l.demo.date)} · {l.demo.mode === "offline" ? "At the academy" : "Online"} · {teacherNameOf(l.demo, teachers) || "No teacher yet"}</p>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

const LeadsTab = ({ leads, onOpen }) => {
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("open");
  const [source, setSource] = useState("all");
  const [view, setView] = useState("list");
  const counts = useMemo(() => {
    const c = { open: 0, all: leads.length };
    leads.forEach((l) => { c[l.stage] = (c[l.stage] || 0) + 1; if (OPEN_STAGES.includes(l.stage)) c.open++; });
    return c;
  }, [leads]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const digits = s.replace(/\D/g, "");
    return leads
      .filter((l) => (stage === "all" ? true : stage === "open" ? OPEN_STAGES.includes(l.stage) : l.stage === stage))
      .filter((l) => source === "all" || l.source === source)
      .filter((l) => !s || [l.parentName, l.childName, l.city, l.email].some((v) => (v || "").toLowerCase().includes(s)) || (digits.length >= 3 && (l.phone || "").replace(/\D/g, "").includes(digits)))
      .sort((a, b) => {
        const an = a.nextFollowUpAt ? new Date(a.nextFollowUpAt) : null;
        const bn = b.nextFollowUpAt ? new Date(b.nextFollowUpAt) : null;
        if (an && bn) return an - bn;
        if (an) return -1;
        if (bn) return 1;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });
  }, [leads, q, stage, source]);
  const chips = [{ key: "open", label: "Open" }, ...STAGES.map((s) => ({ key: s.key, label: s.short })), { key: "all", label: "All" }];
  return (
    <div className="crm-tab">
      <div className="crm-toolbar">
        <label className="crm-search">
          <IconSearch /><span className="crm-sr">Search leads</span>
          <input type="search" placeholder="Name, child, phone…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className="crm-select" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source">
          <option value="all">All sources</option>
          {SOURCES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <div className="crm-segment small" role="radiogroup" aria-label="View">
          {[["list", "List"], ["board", "Board"]].map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={view === v} className={view === v ? "active" : ""} onClick={() => setView(v)}>{l}</button>
          ))}
        </div>
      </div>
      {view === "list" && (
        <>
          <div className="crm-chips" role="group" aria-label="Filter by stage">
            {chips.map((c) => (
              <button key={c.key} type="button" className={`crm-chip${stage === c.key ? " active" : ""}`} aria-pressed={stage === c.key} onClick={() => setStage(c.key)}>
                {c.label} <span className="crm-chip-count">{counts[c.key] || 0}</span>
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <div className="crm-empty"><p>No leads match.</p></div>
          ) : (
            <ul className="crm-grid">{filtered.map((l) => <li key={l._id}><LeadCard lead={l} onOpen={onOpen} /></li>)}</ul>
          )}
        </>
      )}
      {view === "board" && (
        <div className="crm-board" aria-label="Pipeline">
          {STAGES.filter((s) => s.key !== "lost").map((s) => {
            const col = filtered.filter((l) => l.stage === s.key);
            return (
              <section key={s.key} className="crm-col" aria-label={s.label}>
                <h3 className="crm-col-title"><span className={`crm-dot tone-${s.tone}`} aria-hidden="true" />{s.label}<span className="crm-chip-count">{col.length}</span></h3>
                <ul className="crm-stack">{col.map((l) => <li key={l._id}><LeadCard lead={l} onOpen={onOpen} /></li>)}</ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

const DemosTab = ({ leads, onOpen, teachers }) => {
  const now = new Date();
  const scheduled = leads.filter((l) => l.demo?.status === "scheduled").sort((a, b) => new Date(a.demo.date) - new Date(b.demo.date));
  const needsOutcome = scheduled.filter((l) => new Date(l.demo.date) < now);
  const upcoming = scheduled.filter((l) => new Date(l.demo.date) >= now);
  const groups = upcoming.reduce((g, l) => { const k = fmtDate(l.demo.date); (g[k] = g[k] || []).push(l); return g; }, {});
  const past = leads.filter((l) => l.demo?.status && l.demo.status !== "scheduled").sort((a, b) => new Date(b.demo.date) - new Date(a.demo.date)).slice(0, 20);
  const Row = ({ l }) => (
    <li>
      <button type="button" className="crm-card crm-lead-card" onClick={() => onOpen(l._id)}>
        <div className="crm-card-row"><span className="crm-lead-name">{l.childName || l.parentName}</span><span className="crm-badge tone-amber">{fmtTime(l.demo.date)}</span></div>
        <p className="crm-muted">{l.parentName} · {l.demo.mode === "offline" ? "At the academy" : "Online"} · {teacherNameOf(l.demo, teachers) || "No teacher yet"}</p>
      </button>
    </li>
  );
  return (
    <div className="crm-tab">
      {needsOutcome.length > 0 && (
        <>
          <h3 className="crm-h3 tone-red">Record the outcome ({needsOutcome.length})</h3>
          <ul className="crm-stack">{needsOutcome.map((l) => <Row key={l._id} l={l} />)}</ul>
        </>
      )}
      <h3 className="crm-h3">Upcoming demos</h3>
      {upcoming.length === 0 && <div className="crm-empty"><p>No demo classes booked. Book one from a lead.</p></div>}
      {Object.entries(groups).map(([day, ls]) => (
        <div key={day}><p className="crm-day">{day}</p><ul className="crm-stack">{ls.map((l) => <Row key={l._id} l={l} />)}</ul></div>
      ))}
      {past.length > 0 && (
        <details className="crm-details">
          <summary>Recent demo outcomes ({past.length})</summary>
          <ul className="crm-stack">
            {past.map((l) => (
              <li key={l._id}>
                <button type="button" className="crm-card crm-lead-card" onClick={() => onOpen(l._id)}>
                  <div className="crm-card-row"><span className="crm-lead-name">{l.childName || l.parentName}</span><StageBadge stage={l.stage} /></div>
                  <p className="crm-muted">{fmtDateTime(l.demo.date)} · {({ attended: "Attended", no_show: "Didn't attend", cancelled: "Cancelled" })[l.demo.status]}{l.demo.rating ? ` · ${l.demo.rating}/5` : ""}</p>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};

const ReportsTab = ({ refreshKey }) => {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    axios.get(`${API}/stats`).then((r) => setStats(r.data)).catch(() => setError("Couldn't load reports."));
  }, [refreshKey]);
  if (error) return <div className="crm-tab"><div className="crm-empty"><p>{error}</p></div></div>;
  if (!stats) return <div className="crm-tab"><div className="crm-empty"><p>Loading reports…</p></div></div>;
  const f = stats.funnel;
  const steps = [["Enquiries", f.leads], ["Contacted", f.contacted], ["Demo booked", f.demoScheduled], ["Demo attended", f.demoAttended], ["Enrolled", f.converted]];
  return (
    <div className="crm-tab">
      <div className="crm-kpis">
        <div className="crm-kpi tone-blue"><span className="crm-kpi-value">{f.leads}</span><span className="crm-kpi-label">Total enquiries</span></div>
        <div className="crm-kpi tone-green"><span className="crm-kpi-value">{stats.conversionRate}%</span><span className="crm-kpi-label">Enquiry → enrolled</span></div>
        <div className="crm-kpi tone-teal"><span className="crm-kpi-value">{stats.demoToConversion}%</span><span className="crm-kpi-label">Demo → enrolled</span></div>
        <div className="crm-kpi tone-violet"><span className="crm-kpi-value">{stats.avgDaysToConvert ?? "—"}</span><span className="crm-kpi-label">Avg. days to enrol</span></div>
      </div>
      <section className="crm-card crm-report">
        <h3 className="crm-h3">Funnel</h3>
        <ol className="crm-funnel">
          {steps.map(([label, n]) => (
            <li key={label}>
              <span className="crm-funnel-label">{label}</span>
              <span className="crm-funnel-bar"><span style={{ width: `${f.leads ? Math.max(4, (n / f.leads) * 100) : 0}%` }} /></span>
              <span className="crm-funnel-n">{n}{f.leads ? <small> · {Math.round((n / f.leads) * 100)}%</small> : null}</span>
            </li>
          ))}
        </ol>
        <p className="crm-muted">Lost: {f.lost}</p>
      </section>
      <section className="crm-card crm-report">
        <h3 className="crm-h3">Enquiries vs enrolments (6 months)</h3>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={stats.monthly} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--crm-border)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "var(--crm-card)", border: "1px solid var(--crm-border)", borderRadius: 10, color: "var(--crm-text)" }} />
              <Legend />
              <Bar dataKey="leads" name="Enquiries" fill="#60a5fa" radius={[6, 6, 0, 0]} />
              <Bar dataKey="converted" name="Enrolled" fill="#16a34a" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="crm-card crm-report">
        <h3 className="crm-h3">Where enquiries come from</h3>
        <div className="crm-table-wrap">
          <table className="crm-table">
            <thead><tr><th>Source</th><th>Enquiries</th><th>Demos</th><th>Enrolled</th><th>Rate</th></tr></thead>
            <tbody>
              {stats.bySource.map((s) => (
                <tr key={s.source}><td>{s.source}</td><td>{s.leads}</td><td>{s.demos}</td><td>{s.converted}</td><td>{s.leads ? Math.round((s.converted / s.leads) * 100) : 0}%</td></tr>
              ))}
              {stats.bySource.length === 0 && <tr><td colSpan="5">No enquiries yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

// ---------------- main ----------------
const TABS = [
  { key: "today", label: "Today", Icon: IconHome },
  { key: "leads", label: "Leads", Icon: IconInbox },
  { key: "demos", label: "Demos", Icon: IconCalendar },
  { key: "clients", label: "Clients", Icon: IconUsers },
  { key: "reports", label: "Reports", Icon: IconChart },
];

const CRMDashboard = ({ user, onLogout }) => {
  const [tab, setTab] = useState("today");
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [clientId, setClientId] = useState(null);
  const [messaging, setMessaging] = useState(null); // { clientId, startWith }
  const [adding, setAdding] = useState(false);
  const [completing, setCompleting] = useState(null); // { leadId, f }
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem("crm_theme") === "dark"; } catch { return false; }
  });
  const [toast, setToast] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const by = user.fullName || user.username || "";

  const load = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [l, u, c] = await Promise.all([axios.get(API), axios.get(`${BASE}/users`), axios.get(`${BASE}/classes`)]);
      setLeads(l.data || []);
      setUsers(u.data || []);
      setClasses(c.data || []);
    } catch {
      setLoadError("Couldn't load leads. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (user?._id) subscribeDeviceToPush(user._id); }, [user?._id]);
  useEffect(() => {
    try { localStorage.setItem("crm_theme", dark ? "dark" : "light"); } catch { /* ignore */ }
  }, [dark]);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const upsert = (lead) => {
    setLeads((ls) => (ls.some((l) => l._id === lead._id) ? ls.map((l) => (l._id === lead._id ? lead : l)) : [lead, ...ls]));
    setRefreshKey((k) => k + 1);
  };
  const openLead = leads.find((l) => l._id === openId);
  const teachers = useMemo(() => users.filter((x) => x.role === "teacher" && x.isActive !== false), [users]);
  const clients = useMemo(() => buildClients(users, leads, classes), [users, leads, classes]);
  const openClient = clients.find((c) => c.id === clientId);
  const messagingClient = messaging && clients.find((c) => c.id === messaging.clientId);

  // Every call / WhatsApp / note on a client is logged with the staff name
  const logContact = async (client, channel, note = "") => {
    const contacts = await logClientContact(client.id, channel, note, by);
    setUsers((us) => us.map((x) => (x._id === client.id ? { ...x, crmContacts: contacts } : x)));
  };
  const onCall = (client) => { logContact(client, "call").catch(() => setToast("Couldn't log the call")); };
  const onMessage = (client, startWith) => setMessaging({ clientId: client.id, startWith });
  const onWhatsAppOpened = (client, label) => { logContact(client, "whatsapp", label).catch(() => setToast("Couldn't log the message")); };

  const quickComplete = async (outcome) => {
    const { leadId, f } = completing;
    try {
      // "No answer" shouldn't leave the lead with nothing planned: retry in 3 hours
      const retry = outcome.startsWith("No answer");
      const r = await axios.patch(`${API}/${leadId}/followups/${f._id}`, {
        done: true,
        outcome,
        by,
        nextDueAt: retry ? new Date(Date.now() + 3 * 3600000).toISOString() : undefined,
        nextTitle: retry ? f.title || "Follow-up" : undefined,
      });
      upsert(r.data);
      setToast(outcome.startsWith("No answer") ? "Done — retry planned in 3 hours" : "Follow-up done");
    } catch {
      setToast("Couldn't update. Try again.");
    }
    setCompleting(null);
  };

  return (
    <div className={`crm-root crm-app${dark ? " crm-dark" : ""}`}>
      <aside className="crm-sidebar" aria-label="Navigation">
        <div className="crm-brand"><img src={logoImg} alt="" /><span>Admissions</span></div>
        <nav>
          {TABS.map(({ key, label, Icon }) => (
            <button key={key} type="button" className={tab === key ? "active" : ""} aria-current={tab === key ? "page" : undefined} onClick={() => setTab(key)}><Icon /> {label}</button>
          ))}
        </nav>
        <button type="button" className="crm-btn crm-btn-primary crm-btn-block" onClick={() => setAdding(true)}><IconPlus /> New enquiry</button>
      </aside>

      <div className="crm-main">
        <header className="crm-header">
          <h1>{TABS.find((t) => t.key === tab).label}</h1>
          <div className="crm-header-actions">
            <button type="button" className="crm-icon-btn" onClick={load} aria-label="Refresh" disabled={loading}><span className={loading ? "crm-spin" : ""}><IconRefresh size={18} /></span></button>
            <button type="button" className="crm-icon-btn" onClick={() => setDark((d) => !d)} aria-label={dark ? "Light mode" : "Dark mode"}>{dark ? <IconSun size={18} /> : <IconMoon size={18} />}</button>
            <button type="button" className="crm-icon-btn" onClick={onLogout} aria-label="Log out"><IconLogout size={18} /></button>
          </div>
        </header>

        <main className="crm-content">
          {loadError ? (
            <div className="crm-empty" role="alert"><p>{loadError}</p><button type="button" className="crm-btn crm-btn-ghost" onClick={load}>Try again</button></div>
          ) : loading && leads.length === 0 ? (
            <div className="crm-empty"><span className="crm-spinner" aria-hidden="true" /><p>Loading…</p></div>
          ) : (
            <>
              {tab === "today" && <TodayTab leads={leads} user={user} teachers={teachers} onOpen={setOpenId} onComplete={(leadId, f) => setCompleting({ leadId, f })} />}
              {tab === "leads" && <LeadsTab leads={leads} onOpen={setOpenId} />}
              {tab === "demos" && <DemosTab leads={leads} teachers={teachers} onOpen={setOpenId} />}
              {tab === "clients" && <ClientsTab clients={clients} onOpen={setClientId} onCall={onCall} onMessage={onMessage} />}
              {tab === "reports" && <ReportsTab refreshKey={refreshKey} />}
            </>
          )}
        </main>
      </div>

      {/* Phone: five tabs; "New enquiry" floats above them on the screens where it makes sense */}
      <nav className="crm-bottom-nav" aria-label="Main">
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} type="button" className={tab === key ? "active" : ""} aria-current={tab === key ? "page" : undefined} onClick={() => setTab(key)}><Icon size={22} /><span>{label}</span></button>
        ))}
      </nav>
      {["today", "leads", "demos"].includes(tab) && (
        <button type="button" className="crm-fab" onClick={() => setAdding(true)} aria-label="New enquiry"><IconPlus size={26} /></button>
      )}

      {adding && (
        <AddLeadSheet
          by={by}
          dark={dark}
          onCreated={upsert}
          onOpenLead={(id) => { setAdding(false); setOpenId(id); }}
          onClose={(created) => { setAdding(false); if (created) { setToast("Lead added — first call due within the hour"); setOpenId(created._id); } }}
        />
      )}
      {openLead && (
        <LeadDetail
          key={openLead._id}
          lead={openLead}
          by={by}
          dark={dark}
          teachers={teachers}
          classes={classes}
          onClose={() => setOpenId(null)}
          onUpdated={upsert}
          onDeleted={(id) => { setLeads((ls) => ls.filter((l) => l._id !== id)); setOpenId(null); setToast("Lead deleted"); }}
        />
      )}
      {openClient && (
        <ClientDetail
          key={`client-${openClient.id}`}
          client={openClient}
          dark={dark}
          onClose={() => setClientId(null)}
          onOpenClient={setClientId}
          onCall={onCall}
          onMessage={onMessage}
          onNote={(client, note) => logContact(client, "note", note)}
        />
      )}
      {messagingClient && (
        <ClientMessageSheet
          key={`message-${messagingClient.id}-${messaging.startWith || ""}`}
          client={messagingClient}
          staff={by}
          dark={dark}
          startWith={messaging.startWith}
          onClose={() => setMessaging(null)}
          onSent={onWhatsAppOpened}
        />
      )}
      {completing && (
        <Sheet title="Mark follow-up done" onClose={() => setCompleting(null)} dark={dark} labelledBy="crm-done-title">
          <p className="crm-muted">{completing.f.title}</p>
          <div className="crm-stack-buttons">
            {["Spoke to the parent", "Sent WhatsApp", "No answer — try again", "Parent will get back"].map((o, i) => (
              <button key={o} type="button" className="crm-btn crm-btn-ghost crm-btn-block" onClick={() => quickComplete(o)} data-autofocus={i === 0 ? true : undefined}>{o}</button>
            ))}
            <button type="button" className="crm-btn crm-btn-primary crm-btn-block" onClick={() => { setOpenId(completing.leadId); setCompleting(null); }}>Open lead for more</button>
          </div>
        </Sheet>
      )}
      {toast && <div className="crm-toast" role="status">{toast}</div>}
    </div>
  );
};

export default CRMDashboard;
