// Parent self-service UI: add-to-calendar, absence notices, contact edits,
// report conversations, payment proof + receipts, referral stats, siblings.
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import imageCompression from "browser-image-compression";
import { ParentSheet } from "./ParentExtras";

const API = "https://art-portal-7n6r.onrender.com/api";
const DAYS = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
const errMsg = (e, fallback) => e?.response?.data?.message || fallback;

// Upcoming class times (slots are stored as IST day + "HH:MM")
export const upcomingClasses = (schedule, days = 21, now = Date.now()) => {
  const ist = new Date(now + 330 * 60000);
  const out = [];
  for (let add = 0; add < days; add++) {
    const d = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + add));
    (schedule || []).forEach((slot) => {
      if (DAYS[slot.day] !== d.getUTCDay() || !slot.time) return;
      const [h, m] = String(slot.time).split(":").map(Number);
      if (Number.isNaN(h)) return;
      const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m || 0) - 330 * 60000;
      if (start + 60 * 60000 <= now) return; // already over
      out.push({ date: d.toISOString().slice(0, 10), time: slot.time, start, link: slot.link });
    });
  }
  return out.sort((a, b) => a.start - b.start);
};
const fmtClass = (start) => new Date(start).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

// ---------- .ics for the weekly classes ----------
const icsStamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
export const downloadCalendar = (cls) => {
  const slots = upcomingClasses(cls?.schedule, 7);
  if (!slots.length) return false;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Thevenkyart//Classes//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  slots.forEach((s, i) => {
    const link = s.link || cls.meetingLink || "";
    lines.push(
      "BEGIN:VEVENT",
      `UID:${cls._id || "class"}-${s.time.replace(":", "")}-${i}@thevenkyart`,
      `DTSTAMP:${icsStamp(Date.now())}`,
      `DTSTART:${icsStamp(s.start)}`,
      `DTEND:${icsStamp(s.start + 60 * 60000)}`,
      "RRULE:FREQ=WEEKLY",
      `SUMMARY:${(cls.className || "Art class").replace(/[,;]/g, " ")} — Thevenkyart`,
      `DESCRIPTION:${link ? `Join: ${link}` : "Thevenkyart Art Academy class"}`,
      ...(link ? [`URL:${link}`, `LOCATION:${link}`] : []),
      "BEGIN:VALARM", "TRIGGER:-PT15M", "ACTION:DISPLAY", "DESCRIPTION:Art class in 15 minutes", "END:VALARM",
      "END:VEVENT",
    );
  });
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "thevenkyart-classes.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return true;
};

// ---------- absence notices ----------
export const AbsencePanel = ({ studentId, schedule, notices, childName, onChange }) => {
  const [picking, setPicking] = useState(null); // occurrence being reported
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const upcoming = useMemo(() => upcomingClasses(schedule, 21).slice(0, 8), [schedule]);
  const noticeFor = (o) => (notices || []).find((n) => n.date === o.date && (!n.time || n.time === o.time));

  const send = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await axios.post(`${API}/parent/${studentId}/absence`, { date: picking.date, time: picking.time, reason });
      onChange(res.data.absenceNotices);
      setPicking(null);
      setReason("");
    } catch (e) {
      setError(errMsg(e, "Couldn't send that. Please try again."));
    } finally {
      setBusy(false);
    }
  };
  const cancel = async (n) => {
    try {
      const res = await axios.delete(`${API}/parent/${studentId}/absence/${n._id}`);
      onChange(res.data.absenceNotices);
    } catch { /* keep as is */ }
  };

  if (!upcoming.length) return null;
  return (
    <div className="ps-card">
      <h4>Can't make a class?</h4>
      <p className="ps-muted">Let the teacher know in advance — it shows on their attendance list.</p>
      <ul className="ps-list">
        {upcoming.map((o) => {
          const n = noticeFor(o);
          return (
            <li key={`${o.date}-${o.time}`} className={n ? "informed" : ""}>
              <span className="ps-when">{fmtClass(o.start)}</span>
              {n ? (
                <span className="ps-row-end">
                  <span className="ps-chip">Teacher informed</span>
                  <button type="button" className="ps-link" onClick={() => cancel(n)}>Undo</button>
                </span>
              ) : (
                <button type="button" className="ps-btn-ghost" onClick={() => { setPicking(o); setError(""); }}>Can't attend</button>
              )}
            </li>
          );
        })}
      </ul>
      {picking && (
        <ParentSheet title="Tell the teacher" onClose={() => setPicking(null)}>
          <p className="ps-sheet-lead">{childName || "Your child"} will miss the class on <strong>{fmtClass(picking.start)}</strong>.</p>
          <label className="ps-field">
            <span>Reason (optional)</span>
            <input type="text" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Unwell, travelling, school exam" />
          </label>
          {error && <p className="pd-sheet-error" role="alert">{error}</p>}
          <div className="ps-actions">
            <button type="button" className="ps-btn-ghost" onClick={() => setPicking(null)}>Cancel</button>
            <button type="button" className="pd-btn-primary" onClick={send} disabled={busy}>{busy ? "Sending…" : "Send to teacher"}</button>
          </div>
        </ParentSheet>
      )}
    </div>
  );
};

// ---------- contact details ----------
export const EditContactSheet = ({ studentId, profile, onClose, onSaved }) => {
  const [form, setForm] = useState({ phone: profile?.phone || "", email: profile?.email || profile?.parentEmail || "", location: profile?.location || profile?.city || "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await axios.put(`${API}/parent/${studentId}/contact`, form);
      onSaved(res.data);
      onClose();
    } catch (err) {
      setError(errMsg(err, "Couldn't save. Please try again."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <ParentSheet title="Contact details" onClose={onClose}>
      <form onSubmit={save}>
        <label className="ps-field"><span>Phone</span><input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} required /></label>
        <label className="ps-field"><span>Email</span><input type="email" autoComplete="email" value={form.email} onChange={set("email")} /></label>
        <label className="ps-field"><span>City / area</span><input type="text" autoComplete="address-level2" value={form.location} onChange={set("location")} /></label>
        <p className="ps-muted">Need to change something else, like the class or fee? Message the academy from Refer &amp; Support.</p>
        {error && <p className="pd-sheet-error" role="alert">{error}</p>}
        <div className="ps-actions">
          <button type="button" className="ps-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="pd-btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </ParentSheet>
  );
};

// ---------- report conversation ----------
const timeShort = (d) => new Date(d).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
export const ReportThread = ({ report, parentId, onUpdated }) => {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const msgs = report.messages?.length
    ? report.messages
    : report.parentComment ? [{ from: "parent", text: report.parentComment, at: report.createdAt, _legacy: true }] : [];

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await axios.post(`${API}/feedback/${report._id}/messages`, { from: "parent", userId: parentId, text });
      onUpdated({ ...report, messages: res.data.messages, parentComment: report.parentComment || text.trim() });
      setText("");
      setOpen(false);
    } catch (e) {
      setError(errMsg(e, "Couldn't send. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rt-thread">
      {msgs.length > 0 && (
        <ul className="rt-list">
          {msgs.map((m, i) => (
            <li key={m._id || i} className={`rt-msg ${m.from}`}>
              <span className="rt-who">{m.from === "parent" ? "You" : m.name || "Teacher"}{!m._legacy && m.at ? ` · ${timeShort(m.at)}` : ""}</span>
              <p>{m.text}</p>
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <div className="rt-compose">
          <textarea className="rc-textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write to the teacher…" maxLength={1000} aria-label="Message to the teacher" autoFocus />
          {error && <p className="pd-sheet-error" role="alert">{error}</p>}
          <div className="cia-actions">
            <button type="button" className="cia-btn cancel" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="cia-btn send" onClick={send} disabled={busy || !text.trim()}>{busy ? "Sending…" : "Send"}</button>
          </div>
        </div>
      ) : (
        <button type="button" className="rc-action-btn comment" onClick={() => setOpen(true)}>
          {msgs.length ? "Reply" : "Message the teacher"}
        </button>
      )}
    </div>
  );
};

// ---------- payment proof ----------
const monthName = (ym) => { const [y, m] = ym.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" }); };
// "YYYY-MM" n months from now (local time)
const monthFromNow = (n) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// Send payment proof. Due months are listed first; "Add another month" lets a
// parent send proof for any earlier (or the next) month too, e.g. a month that
// was paid but never marked. The amount is filled in from the fees and can be changed.
export const PaymentProofSheet = ({ studentId, pendingRows = [], feeRows = [], monthlyFee = 0, initialMonths, initialNote = "", onClose, onSent }) => {
  const [months, setMonths] = useState(() =>
    initialMonths?.length ? [...initialMonths] : pendingRows.slice(0, 1).map((r) => r.month));
  const [extra, setExtra] = useState(() => (initialMonths || []).filter((m) => !pendingRows.some((r) => r.month === m)));
  const [addMonth, setAddMonth] = useState(() => (pendingRows.length ? "" : monthFromNow(-1)));
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [note, setNote] = useState(initialNote);
  const [amountText, setAmountText] = useState(null); // null = follow the months picked
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const rowFor = (m) => feeRows.find((r) => r.month === m) || pendingRows.find((r) => r.month === m);
  const feeFor = (m) => {
    const r = rowFor(m);
    if (r && r.status !== "Pass" && r.status !== "Inactive" && Number(r.amount) > 0) return Number(r.amount);
    return Number(monthlyFee) || 0;
  };
  const suggested = months.reduce((sum, m) => sum + feeFor(m), 0);
  const amount = amountText === null ? suggested : Number(amountText) || 0;
  const maxMonth = monthFromNow(1); // allow paying next month in advance

  const toggle = (m) => setMonths((ms) => (ms.includes(m) ? ms.filter((x) => x !== m) : [...ms, m]));
  const addExtra = () => {
    setError("");
    if (!/^\d{4}-\d{2}$/.test(addMonth)) return setError("Pick a month to add");
    if (addMonth > maxMonth) return setError("That month is too far ahead");
    if (!pendingRows.some((r) => r.month === addMonth) && !extra.includes(addMonth)) setExtra((xs) => [...xs, addMonth].sort());
    setMonths((ms) => (ms.includes(addMonth) ? ms : [...ms, addMonth]));
    setAddMonth("");
  };
  const removeExtra = (m) => {
    setExtra((xs) => xs.filter((x) => x !== m));
    setMonths((ms) => ms.filter((x) => x !== m));
  };
  const pick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };
  const send = async () => {
    if (!months.length) return setError("Choose the month(s) you paid for");
    if (!file) return setError("Attach the payment screenshot");
    setBusy(true);
    setError("");
    try {
      const small = file.type.startsWith("image/") ? await imageCompression(file, { maxSizeMB: 0.4, maxWidthOrHeight: 1600, fileType: "image/jpeg" }) : file;
      const fd = new FormData();
      fd.append("proof", small, small.name || "payment.jpg");
      fd.append("months", [...months].sort().join(","));
      fd.append("amount", String(amount));
      fd.append("note", note);
      const res = await axios.post(`${API}/parent/${studentId}/payment-proof`, fd);
      onSent(res.data.paymentProofs);
      onClose();
    } catch (e) {
      setError(errMsg(e, "Upload failed. Please try again."));
    } finally {
      setBusy(false);
    }
  };
  const statusNote = (m) => {
    const st = rowFor(m)?.status;
    return st === "Paid" ? "already marked paid" : st === "Pass" ? "on a pass" : st === "Inactive" ? "on a break" : "";
  };

  return (
    <ParentSheet title="Send payment proof" onClose={onClose}>
      <p className="ps-muted">Paid by UPI or bank transfer? Send the screenshot here and the academy will mark it as paid.</p>
      <fieldset className="ps-months">
        <legend>Paid for</legend>
        {pendingRows.map((r) => (
          <label key={r.month} className="ps-check">
            <input type="checkbox" checked={months.includes(r.month)} onChange={() => toggle(r.month)} />
            <span>{monthName(r.month)} <small className="ps-due">due</small></span>
            <em>₹{Number(r.amount) || 0}</em>
          </label>
        ))}
        {extra.map((m) => (
          <div key={m} className="ps-check ps-extra">
            <input type="checkbox" checked={months.includes(m)} onChange={() => toggle(m)} aria-label={monthName(m)} />
            <span>{monthName(m)}{statusNote(m) && <small className="ps-due muted">{statusNote(m)}</small>}</span>
            <em>₹{feeFor(m)}</em>
            <button type="button" className="ps-remove" onClick={() => removeExtra(m)} aria-label={`Remove ${monthName(m)}`}>×</button>
          </div>
        ))}
        {!pendingRows.length && !extra.length && <p className="ps-none">No fees are due right now. Add the month you paid for:</p>}
        <div className="ps-add-month">
          <label htmlFor="ps-add-month">{pendingRows.length || extra.length ? "Add another month" : "Month"}</label>
          <div>
            <input id="ps-add-month" type="month" value={addMonth} max={maxMonth} onChange={(e) => setAddMonth(e.target.value)} />
            <button type="button" className="ps-btn-ghost" onClick={addExtra}>Add</button>
          </div>
        </div>
      </fieldset>
      <label className="ps-field">
        <span>Amount paid (₹)</span>
        <input type="number" inputMode="numeric" min="0" value={amountText === null ? (suggested || "") : amountText} onChange={(e) => setAmountText(e.target.value)} placeholder="e.g. 3000" />
      </label>
      <label className="ps-upload">
        <input type="file" accept="image/*,application/pdf" onChange={pick} />
        {preview && file?.type.startsWith("image/") ? <img src={preview} alt="Payment screenshot preview" /> : <span>{file ? file.name : "Choose screenshot"}</span>}
      </label>
      <label className="ps-field"><span>Note (optional)</span><input type="text" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="e.g. UPI ref 4421…" /></label>
      {error && <p className="pd-sheet-error" role="alert">{error}</p>}
      <div className="ps-actions">
        <button type="button" className="ps-btn-ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="pd-btn-primary" onClick={send} disabled={busy}>{busy ? "Sending…" : "Send"}</button>
      </div>
    </ParentSheet>
  );
};

// ---------- receipt image for a paid month ----------
export const downloadReceipt = async ({ row, profile, logoSrc }) => {
  const W = 900, H = 560;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  x.fillStyle = "#ffffff"; x.fillRect(0, 0, W, H);
  x.fillStyle = "#1e3a8a"; x.fillRect(0, 0, W, 120);
  try {
    const logo = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = logoSrc; });
    x.drawImage(logo, 36, 24, 72, 72);
  } catch { /* no logo */ }
  x.fillStyle = "#ffffff"; x.font = "bold 30px Arial"; x.fillText("Thevenkyart Art Academy", 128, 62);
  x.font = "18px Arial"; x.fillText("Fee receipt", 128, 92);
  const rows = [
    ["Student", profile?.childName || ""],
    ["Parent", profile?.fullName || ""],
    ["Admission ID", profile?.admissionId || profile?.username || ""],
    ["Month", monthName(row.month)],
    ["Amount paid", `Rs. ${Number(row.amount) || 0}`],
    ["Paid on", row.paidDate ? new Date(row.paidDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—"],
  ];
  rows.forEach(([k, v], i) => {
    const y = 180 + i * 52;
    x.fillStyle = "#64748b"; x.font = "20px Arial"; x.fillText(k, 48, y);
    x.fillStyle = "#0f172a"; x.font = "bold 22px Arial"; x.fillText(String(v), 300, y);
    x.strokeStyle = "#e2e8f0"; x.beginPath(); x.moveTo(48, y + 16); x.lineTo(W - 48, y + 16); x.stroke();
  });
  x.fillStyle = "#15803d"; x.font = "bold 26px Arial"; x.fillText("PAID", W - 140, 180);
  x.fillStyle = "#94a3b8"; x.font = "15px Arial"; x.fillText("www.thevenkyart.com · thevenkyart@gmail.com · +91 9963613404", 48, H - 30);
  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  const name = `Receipt_${(profile?.childName || "student").replace(/\W+/g, "_")}_${row.month}.png`;
  const file = new File([blob], name, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Fee receipt" }); return; } catch (e) { if (e?.name === "AbortError") return; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

// ---------- referral stats ----------
export const ReferralStats = ({ studentId }) => {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    axios.get(`${API}/parent/${studentId}/referrals`).then((r) => alive && setData(r.data)).catch(() => alive && setData({ error: true }));
    return () => { alive = false; };
  }, [studentId]);
  if (!data || data.error) return null;
  return (
    <div className="ps-ref">
      <strong className="ps-ref-num">{data.count}</strong>
      <div>
        <span className="ps-ref-label">{data.count === 1 ? "family joined" : "families joined"} with your referral</span>
        {data.families?.length > 0 && <span className="ps-muted">{data.families.map((f) => f.children.join(" & ")).filter(Boolean).join(", ")}</span>}
        {data.enquiries > 0 && <span className="ps-muted">+ {data.enquiries} more {data.enquiries === 1 ? "enquiry" : "enquiries"} in progress</span>}
        {data.count === 0 && !data.enquiries && <span className="ps-muted">Share your code below — friends mention it when they join.</span>}
      </div>
    </div>
  );
};

// ---------- siblings ----------
export const useFamily = (studentId) => {
  const [children, setChildren] = useState([]);
  useEffect(() => {
    let alive = true;
    if (!studentId) return undefined;
    axios.get(`${API}/parent/${studentId}/family`).then((r) => alive && setChildren(r.data.children || [])).catch(() => {});
    return () => { alive = false; };
  }, [studentId]);
  return children;
};

export const switchToChild = (child) => {
  try {
    localStorage.setItem("user", JSON.stringify(child));
  } catch { /* ignore */ }
  window.location.hash = "overview";
  window.location.reload();
};

// ---------- teacher's side of a report conversation ----------
export const TeacherReportThread = ({ report, teacherId, onUpdated, allowStart = false }) => {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const msgs = report.messages?.length
    ? report.messages
    : report.parentComment ? [{ from: "parent", text: report.parentComment, _legacy: true }] : [];
  if (!msgs.length && !allowStart) return null; // the parent usually starts the conversation
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await axios.post(`${API}/feedback/${report._id}/messages`, { from: "teacher", userId: teacherId, text });
      onUpdated({ ...report, messages: res.data.messages });
      setText("");
    } catch (e) {
      setError(errMsg(e, "Couldn't send. Please try again."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rt-thread teacher">
      {msgs.length === 0 && <p className="rt-start-hint">Start a conversation with the parent about this report.</p>}
      <ul className="rt-list">
        {msgs.map((m, i) => (
          <li key={m._id || i} className={`rt-msg ${m.from === "teacher" ? "parent" : "teacher"}`}>
            <span className="rt-who">{m.from === "teacher" ? "You" : "Parent"}{!m._legacy && m.at ? ` · ${timeShort(m.at)}` : ""}</span>
            <p>{m.text}</p>
          </li>
        ))}
      </ul>
      <div className="rt-compose inline">
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder={msgs.length ? "Reply to the parent…" : "Write to the parent…"} aria-label="Message to the parent" maxLength={1000} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button type="button" className="rt-send" onClick={send} disabled={busy || !text.trim()}>{busy ? "…" : "Send"}</button>
      </div>
      {error && <p className="pd-sheet-error" role="alert">{error}</p>}
    </div>
  );
};


// ---------- class notes & homework (from the teacher) ----------
const noteDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
export const ClassNotesCard = ({ studentId, compact = false, onSeeAll }) => {
  const [notes, setNotes] = useState(null);
  useEffect(() => {
    let alive = true;
    axios.get(`${API}/class-notes/student/${studentId}?limit=${compact ? 1 : 12}`)
      .then((r) => alive && setNotes(Array.isArray(r.data) ? r.data : []))
      .catch(() => alive && setNotes([]));
    return () => { alive = false; };
  }, [studentId, compact]);
  if (!notes || notes.length === 0) return compact ? null : (
    <div className="ps-card"><h4>Class notes</h4><p className="ps-muted">After each class the teacher will share what was done and any homework here.</p></div>
  );
  return (
    <div className={compact ? "info-card cn-card" : "ps-card cn-card"}>
      <div className="cn-head">
        <h4>{compact ? "From the last class" : "Class notes & homework"}</h4>
        {compact && onSeeAll && <button type="button" className="ps-link" onClick={onSeeAll}>See all</button>}
      </div>
      <ul className="cn-list">
        {notes.map((n) => (
          <li key={n._id}>
            <span className="cn-date">{noteDate(n.date)}{n.teacherId?.fullName ? ` · ${n.teacherId.fullName}` : ""}</span>
            {n.text && <p className="cn-text">{n.text}</p>}
            {n.homework && <p className="cn-hw"><strong>Homework:</strong> {n.homework}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
};
