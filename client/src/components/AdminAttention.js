// Admin home: "Needs attention today". One card per kind of work, each with
// the count and the first few items; tapping takes the admin where to act.
import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { AwareButton, undoCheckIn } from "./CheckInAck";
import "./AdminAttention.css";

const API = "https://art-portal-7n6r.onrender.com/api";
const monthLabel = (ym) => { const [y, m] = String(ym).split("-").map(Number); return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "short", year: "numeric" }); };
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const waNumber = (raw) => { let d = String(raw || "").replace(/\D/g, "").replace(/^0+/, ""); if (d.length === 10) d = "91" + d; return d.length >= 11 && d.length <= 15 ? d : null; };
const firstName = (s) => String(s || "").trim().split(/\s+/)[0];

const AdminAttention = ({ adminId, onOpenProofs, onOpenUser, onOpenOverdue }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(null);

  const load = useCallback(() => {
    setError(false);
    axios.get(`${API}/admin/attention`).then((r) => setData(r.data)).catch(() => setError(true));
  }, []);
  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  if (error && !data) {
    return (
      <div className="att-card att-error" role="alert">
        <span>Couldn't load today's to-do list.</span>
        <button type="button" onClick={load}>Retry</button>
      </div>
    );
  }
  if (!data) return <div className="att-card att-skel" aria-hidden="true" />;

  // "I'm aware" on a missed-classes item: move it between the two lists
  const setKnown = (userId, known, note) => setData((d) => {
    const all = [...d.items.missing, ...(d.items.missingKnown || [])];
    const item = all.find((m) => String(m.userId) === String(userId));
    if (!item) return d;
    const next = { ...item, known, knownNote: note };
    const missing = known ? d.items.missing.filter((m) => m !== item) : [next, ...d.items.missing];
    const missingKnown = known ? [next, ...(d.items.missingKnown || []).filter((m) => m !== item)] : (d.items.missingKnown || []).filter((m) => m !== item);
    const counts = { ...d.counts, missing: missing.length };
    return { ...d, counts, total: Object.values(counts).reduce((a, b) => a + b, 0), items: { ...d.items, missing, missingKnown } };
  });

  const { counts, items } = data;
  const cards = [
    { key: "proofs", label: "Payment proofs to check", tone: "blue", count: counts.proofs, action: { label: "Review", onClick: onOpenProofs },
      rows: items.proofs.map((p) => ({ id: `${p.userId}-${p.at}`, main: p.child, sub: `${p.months.map(monthLabel).join(", ")} · ${inr(p.amount)}` })) },
    { key: "resets", label: "Password resets", tone: "red", count: counts.resets,
      rows: items.resets.map((r) => ({ id: r.id, main: r.who, sub: new Date(r.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }), action: r.userId ? { label: "Set password", onClick: () => onOpenUser(r.userId) } : null })) },
    { key: "overdue", label: "Fees overdue (30+ days)", tone: "amber", count: counts.overdue, extra: counts.overdue ? inr(data.overdueAmount) : null, action: { label: "Open fees", onClick: onOpenOverdue },
      rows: items.overdue.map((o) => ({ id: o.userId, main: o.child, sub: `${o.months} month${o.months > 1 ? "s" : ""} · ${inr(o.amount)} · since ${monthLabel(o.oldest)}` })) },
    { key: "missing", label: "Missed last 3 classes", tone: "red", count: counts.missing,
      rows: items.missing.map((m) => {
        const wa = waNumber(m.phone);
        const msg = `Hello ${m.parent ? `${m.parent} Sir/Madam` : "Sir/Madam"}, this is Thevenkyart Art Academy. We have missed ${firstName(m.child)} in the last few classes. Is everything okay? We would love to see ${firstName(m.child)} back in class.`;
        return { id: m.userId, main: m.child, sub: `${m.misses} classes in a row${m.lastPresent ? ` · last attended ${new Date(m.lastPresent + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}${m.teacherNote ? ` · Teacher: ${m.teacherNote}` : ""}`,
          link: wa ? { label: "WhatsApp", href: `https://wa.me/${wa}?text=${encodeURIComponent(msg)}` } : null,
          aware: adminId ? { studentId: m.userId, childName: m.child } : null };
      }) },
    { key: "unmarked", label: "Classes without attendance today", tone: "amber", count: counts.unmarked,
      rows: items.unmarked.map((u) => ({ id: `${u.classId}-${u.time}`, main: `${u.className} · ${u.time}`, sub: `Teacher: ${u.teacher}` })) },
    { key: "notices", label: "Away today (parent told us)", tone: "green", count: counts.notices,
      rows: items.notices.map((n) => ({ id: `${n.userId}-${n.time}`, main: n.child, sub: [n.time, n.reason].filter(Boolean).join(" · ") || "Can't attend" })) },
  ];

  return (
    <section className="att-wrap" aria-labelledby="att-title">
      <div className="att-head">
        <h3 id="att-title">Needs attention today</h3>
        <button type="button" className="att-refresh" onClick={load} aria-label="Refresh">↻</button>
      </div>
      {data.total === 0 ? (
        <div className="att-card att-clear">All clear. Nothing needs your attention right now.</div>
      ) : (
        <div className="att-grid">
          {cards.filter((c) => c.count > 0).map((c) => (
            <div key={c.key} className={`att-card tone-${c.tone}`}>
              <button type="button" className="att-card-head" onClick={() => setOpen(open === c.key ? null : c.key)} aria-expanded={open === c.key}>
                <strong className="att-count">{c.count}</strong>
                <span className="att-label">{c.label}{c.extra && <em> · {c.extra}</em>}</span>
                <span className="att-chev" aria-hidden="true">{open === c.key ? "▴" : "▾"}</span>
              </button>
              {open === c.key && (
                <ul className="att-list">
                  {c.rows.slice(0, 8).map((r) => (
                    <li key={r.id}>
                      <span className="att-main">{r.main}<span>{r.sub}</span></span>
                      {r.action && <button type="button" className="att-mini" onClick={r.action.onClick}>{r.action.label}</button>}
                      {r.link && <a className="att-mini wa" href={r.link.href} target="_blank" rel="noreferrer">{r.link.label}</a>}
                      {r.aware && <AwareButton studentId={r.aware.studentId} childName={r.aware.childName} by={adminId} onChange={(k, note) => setKnown(r.aware.studentId, k, note)} />}
                    </li>
                  ))}
                  {c.rows.length > 8 && <li className="att-more">+ {c.rows.length - 8} more</li>}
                </ul>
              )}
              {c.action && <button type="button" className="att-action" onClick={c.action.onClick}>{c.action.label}</button>}
            </div>
          ))}
        </div>
      )}
      {(items.missingKnown || []).length > 0 && (
        <details className="ack-known att-known">
          <summary>{items.missingKnown.length} missing-classes item{items.missingKnown.length > 1 ? "s" : ""} marked as known</summary>
          <ul>
            {items.missingKnown.map((m) => (
              <li key={m.userId}>
                <span>{m.child}{m.knownNote ? <em> · {m.knownNote}</em> : null}</span>
                <button type="button" onClick={() => undoCheckIn(m.userId, adminId).then(() => setKnown(m.userId, false, "")).catch(() => {})}>Show again</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
};

export default AdminAttention;
