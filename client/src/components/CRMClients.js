// CRM › Clients: every enrolled family (parent + student) with status filters,
// location filter, list/grid views, full details (including how many referrals
// they have made) and one-tap Call / WhatsApp follow-ups with a personalised,
// editable message for inactive, on-pass and active clients.
import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
  IconSearch, IconPhone, IconWhatsApp, IconLocation, IconShare, IconUser, IconClock, IconNote,
  IconCalendar, IconError, IconChevronRight, IconUsers,
} from "./Icons";
import { Sheet, Field, fmtDateTime, waHref, telHref } from "./crmShared";

export const CLIENTS_API = "https://art-portal-7n6r.onrender.com/api/leads/clients";

// ---------------------------------------------------------------------------
// data
// ---------------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, "0");
export const monthKeyOf = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const monthShort = (key) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "short", year: "numeric" });
};
const monthLabel = (key) => {
  if (!key) return "";
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
};
const fmtYMD = (str) => {
  if (!str) return "";
  const [y, m, d] = String(str).slice(0, 10).split("-").map(Number);
  return y ? new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
};
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const last10 = (p) => String(p || "").replace(/\D/g, "").slice(-10);
// Same rule as Admin: `location`, falling back to `city`
export const locationOf = (u) => (u.location || u.city || "").trim();
const timeAgo = (d) => {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.floor(h / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const mo = Math.floor(days / 30);
  return `${mo} month${mo > 1 ? "s" : ""} ago`;
};

export const STATUS = {
  active: { label: "Active", tone: "green" },
  pass: { label: "Pass", tone: "amber" },
  inactive: { label: "Inactive", tone: "red" },
};
// Mutually exclusive, so the filter counts add up to "All":
// inactive (account switched off) > pass (fee pass this month) > active.
const statusOf = (u, nowKey) => {
  if (u.isActive === false) return "inactive";
  if ((u.passes || []).some((p) => p.month === nowKey)) return "pass";
  return "active";
};
const inactiveInfo = (u) => {
  const h = u.inactiveHistory || [];
  const open = [...h].reverse().find((x) => !x.inactiveTo) || h[h.length - 1];
  return open ? { from: open.inactiveFrom, reason: open.reason || "" } : { from: "", reason: "" };
};
const FEE = { paid: "Paid", pending: "Pending", pass: "On pass", inactive: "—", upcoming: "Starts later" };
const feeStateOf = (u, status, nowKey) => {
  if ((u.payments || []).some((p) => p.month === nowKey)) return "paid";
  if (status === "pass") return "pass";
  if (status === "inactive") return "inactive";
  const start = String(u.registeredDate || u.joiningDate || "").slice(0, 7);
  return start && start > nowKey ? "upcoming" : "pending";
};
const OPEN_LEAD = ["new", "contacted", "demo_scheduled", "demo_done"];

// Turns the raw users / leads / classes into the rows the page shows.
// Siblings (same parent phone) are grouped as one *family* for referral counting:
// "referred by" is free text, so it is matched (ignoring case, spaces and
// punctuation) against a family's usernames and admission IDs, then against
// parent / child names only when that name belongs to exactly one family.
export const buildClients = (users, leads, classes, nowKey = monthKeyOf()) => {
  const parents = users.filter((u) => u.role === "parent");
  const classById = new Map(classes.map((c) => [String(c._id), c]));
  const famKey = (u) => {
    const p = last10(u.phone);
    return p.length === 10 ? `p${p}` : `i${u._id}`;
  };
  const families = new Map();
  parents.forEach((u) => {
    const k = famKey(u);
    if (!families.has(k)) families.set(k, []);
    families.get(k).push(u);
  });

  const strong = new Map(); // username / admission id -> family
  const names = new Map(); // parent / child name -> families using it
  families.forEach((members, k) => {
    members.forEach((m) => {
      [m.username, m.admissionId].map(norm).filter((x) => x.length >= 3).forEach((x) => strong.set(x, k));
      [m.fullName, m.childName].map(norm).filter((x) => x.length >= 3).forEach((x) => {
        if (!names.has(x)) names.set(x, new Set());
        names.get(x).add(k);
      });
    });
  });
  const resolve = (text) => {
    const x = norm(text);
    if (x.length < 3) return null;
    if (strong.has(x)) return strong.get(x);
    const set = names.get(x);
    return set && set.size === 1 ? [...set][0] : null;
  };

  const referredBy = new Map(); // family -> referring family
  families.forEach((members, k) => {
    for (const m of members) {
      const r = resolve(m.referredBy);
      if (r && r !== k) {
        referredBy.set(k, r);
        break;
      }
    }
  });
  const referralsOf = new Map(); // referring family -> referred families
  referredBy.forEach((r, k) => {
    if (!referralsOf.has(r)) referralsOf.set(r, []);
    referralsOf.get(r).push(k);
  });
  const leadsOf = new Map(); // referring family -> enquiries they sent that haven't enrolled
  leads.forEach((l) => {
    if (l.stage === "converted") return; // already counted as an enrolled family
    const r = resolve(l.referredBy);
    if (!r) return;
    if (!leadsOf.has(r)) leadsOf.set(r, []);
    leadsOf.get(r).push(l);
  });

  const describe = (key) => {
    const members = families.get(key) || [];
    return {
      key,
      parent: members[0]?.fullName || members[0]?.username || "Family",
      students: members.map((m) => ({ id: m._id, name: m.childName || m.username, status: statusOf(m, nowKey) })),
    };
  };

  return parents.map((u) => {
    const k = famKey(u);
    const members = families.get(k);
    const status = statusOf(u, nowKey);
    const cls = u.assignedClass ? classById.get(String(u.assignedClass._id || u.assignedClass)) : null;
    const contacts = [...(u.crmContacts || [])].sort((a, b) => new Date(a.at) - new Date(b.at));
    const refFamilies = (referralsOf.get(k) || []).map(describe);
    const refLeads = leadsOf.get(k) || [];
    const location = locationOf(u);
    return {
      id: u._id,
      user: u,
      status,
      location,
      inactive: status === "inactive" ? inactiveInfo(u) : null,
      pass: (u.passes || []).find((p) => p.month === nowKey) || null,
      cls,
      fee: feeStateOf(u, status, nowKey),
      siblings: members.filter((m) => m._id !== u._id),
      referrals: {
        count: refFamilies.length,
        families: refFamilies,
        openLeads: refLeads.filter((l) => OPEN_LEAD.includes(l.stage)),
      },
      referredByText: (u.referredBy || "").trim(),
      referredBy: referredBy.has(k) ? describe(referredBy.get(k)) : null,
      contacts,
      lastContact: contacts[contacts.length - 1] || null,
      search: [u.childName, u.fullName, u.username, u.admissionId, u.email, u.parentEmail, u.city, u.location, last10(u.phone)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    };
  });
};

// ---------------------------------------------------------------------------
// follow-up messages — plain text, no emoji (some phones show them as "?"),
// never mention why a pass or deactivation was recorded (may be medical etc.)
// ---------------------------------------------------------------------------
export const clientTemplates = (c, staff) => {
  const u = c.user;
  const greet = u.fullName ? `${u.fullName} Sir/Madam` : "Sir/Madam";
  const child = u.childName || "your child";
  const head = `Hello ${greet}, this is ${staff ? `${staff} from ` : ""}Thevenkyart Art Academy.`;
  const passMonth = monthLabel(c.pass?.month || monthKeyOf());
  const since = c.inactive?.from ? ` since ${monthLabel(c.inactive.from)}` : " for a while";

  if (c.status === "inactive") {
    return [
      {
        key: "miss",
        label: "We miss you",
        text:
          `${head}\n\nWe noticed that ${child} has not been attending classes${since}, and we really miss having ${child} in the studio.\n\n` +
          `Is everything okay? If the timing or batch is the issue, we are happy to arrange a slot that suits you so ${child} can continue painting with us.\n\n` +
          `Please let us know a convenient time to talk.`,
      },
      {
        key: "restart",
        label: "Restart classes",
        text:
          `${head}\n\n${child} had been making lovely progress in art and we would love to see ${child} back. ` +
          `Classes can restart from any day that suits you, and we will arrange the batch as per your convenience.\n\n` +
          `Shall I share the available batch timings for the coming week?`,
      },
    ];
  }
  if (c.status === "pass") {
    return [
      {
        key: "checkin",
        label: "Check-in",
        text:
          `${head}\n\nWe hope you and ${child} are doing well. We noticed ${child} is on a fee pass for ${passMonth}.\n\n` +
          `We just wanted to check in and plan when ${child} would like to join classes again. Please let us know the date and we will have everything ready.`,
      },
      {
        key: "rejoin",
        label: "Rejoin date",
        text:
          `${head}\n\nHope everything is fine at your end. Since ${child}'s fee pass for ${passMonth} is in place, we wanted to ask when ${child} will be back in class.\n\n` +
          `If you tell us the date, we will confirm the batch and timing for ${child}. We are looking forward to it!`,
      },
    ];
  }
  return [
    {
      key: "checkin",
      label: "Friendly check-in",
      text:
        `${head}\n\nJust checking in to hear how ${child} is enjoying the classes. ` +
        `If you have any feedback, questions or a request for ${child}'s batch, please let us know. We are always happy to help.`,
    },
    {
      key: "referral",
      label: "Ask for a referral",
      text:
        `${head}\n\nThank you for being part of our art family. If you know another family whose child would enjoy art classes, ` +
        `please share our details with them and ask them to mention your referral name "${u.username}" when they join.\n\n` +
        `We would be delighted to welcome them!`,
    },
  ];
};

// ---------------------------------------------------------------------------
// small UI pieces
// ---------------------------------------------------------------------------
const StatusBadge = ({ status }) => {
  const s = STATUS[status];
  return <span className={`crm-badge tone-${s.tone}`}>{s.label}</span>;
};
const ModeBadge = ({ mode }) => (
  <span className={`crm-badge tone-${mode === "offline" ? "amber" : "blue"}`}>{mode === "offline" ? "Offline" : "Online"}</span>
);
const Avatar = ({ name, status }) => (
  <span className={`crm-avatar tone-${STATUS[status].tone}`} aria-hidden="true">{(name || "?").trim().charAt(0).toUpperCase()}</span>
);
const clientName = (c) => c.user.childName || c.user.fullName || c.user.username;

const Actions = ({ client, onCall, onMessage, compact = false }) => (
  <div className={`crm-contact${compact ? " compact" : ""}`}>
    <a className="crm-btn crm-btn-ghost" href={telHref(client.user.phone)} onClick={() => onCall(client)} aria-label={`Call ${client.user.fullName || clientName(client)}`}>
      <IconPhone /> {!compact && "Call"}
    </a>
    <button type="button" className="crm-btn crm-btn-wa" onClick={() => onMessage(client)} aria-label={`WhatsApp message to ${client.user.fullName || clientName(client)}`}>
      <IconWhatsApp /> {!compact && "WhatsApp"}
    </button>
  </div>
);

// Inactive / pass clients nobody has contacted in the last FOLLOWUP_DAYS days
export const FOLLOWUP_DAYS = 7;
export const needsFollowUp = (c, now = Date.now()) =>
  c.status !== "active" && (!c.lastContact || now - new Date(c.lastContact.at).getTime() > FOLLOWUP_DAYS * 86400000);

const LastContact = ({ client }) => {
  const needs = client.status !== "active";
  if (client.lastContact) {
    return (
      <p className={`crm-meta${needsFollowUp(client) ? " crm-due tone-overdue" : ""}`}>
        <IconClock /> Followed up {timeAgo(client.lastContact.at)} · {({ call: "Call", whatsapp: "WhatsApp", note: "Note" })[client.lastContact.channel]}
      </p>
    );
  }
  return needs ? <p className="crm-meta crm-due tone-overdue"><IconClock /> Not followed up yet</p> : null;
};

const ClientCard = ({ client, onOpen, onCall, onMessage }) => {
  const u = client.user;
  return (
    <div className="crm-card crm-client-card">
      <button type="button" className="crm-client-main" onClick={() => onOpen(client.id)}>
        <div className="crm-card-row">
          <span className="crm-client-id">
            <Avatar name={clientName(client)} status={client.status} />
            <span className="crm-client-names">
              <span className="crm-lead-name">{clientName(client)}</span>
              <span className="crm-muted">{u.fullName || "—"}{u.admissionId ? ` · ${u.admissionId}` : ""}</span>
            </span>
          </span>
          <StatusBadge status={client.status} />
        </div>
        <p className="crm-meta"><IconLocation /> {client.location || "No location"}</p>
        <div className="crm-client-tags">
          <ModeBadge mode={u.classMode} />
          {client.referrals.count > 0 && <span className="crm-badge tone-violet"><IconShare size={12} /> {client.referrals.count} referral{client.referrals.count === 1 ? "" : "s"}</span>}
        </div>
        <LastContact client={client} />
      </button>
      <Actions client={client} onCall={onCall} onMessage={onMessage} />
    </div>
  );
};

const ClientRow = ({ client, onOpen, onCall, onMessage }) => {
  const u = client.user;
  return (
    <div className="crm-card crm-client-row">
      <button type="button" className="crm-row-main" onClick={() => onOpen(client.id)}>
        <span className="crm-row-cell crm-row-name">
          <Avatar name={clientName(client)} status={client.status} />
          <span className="crm-client-names">
            <span className="crm-lead-name">{clientName(client)}</span>
            <span className="crm-muted">{u.fullName || "—"}</span>
          </span>
        </span>
        <span className="crm-row-cell crm-row-phone">{u.phone || "—"}</span>
        <span className="crm-row-cell crm-row-loc"><IconLocation size={14} /> {client.location || "—"}</span>
        <span className="crm-row-cell crm-row-mode"><ModeBadge mode={u.classMode} /></span>
        <span className="crm-row-cell crm-row-status"><StatusBadge status={client.status} /></span>
        <span className="crm-row-cell crm-row-ref" title="Referrals made">{client.referrals.count > 0 ? <><IconShare size={13} /> {client.referrals.count}</> : null}</span>
        <span className="crm-row-cell crm-row-last">
          {client.lastContact ? <span className={needsFollowUp(client) ? "crm-due tone-overdue" : undefined}>Followed up {timeAgo(client.lastContact.at)}</span> : client.status !== "active" ? <span className="crm-due tone-overdue">Not followed up</span> : null}
        </span>
      </button>
      <Actions client={client} onCall={onCall} onMessage={onMessage} compact />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Clients tab
// ---------------------------------------------------------------------------
const SORTS = [
  { key: "name", label: "Name A–Z" },
  { key: "followup", label: "Needs follow-up first" },
  { key: "referrals", label: "Most referrals" },
  { key: "newest", label: "Newest first" },
];

export const ClientsTab = ({ clients, onOpen, onCall, onMessage }) => {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [loc, setLoc] = useState("all");
  const [sort, setSort] = useState("name");
  const [view, setView] = useState(() => {
    try { return localStorage.getItem("crm_clients_view") === "list" ? "list" : "grid"; } catch { return "grid"; }
  });
  useEffect(() => {
    try { localStorage.setItem("crm_clients_view", view); } catch { /* ignore */ }
  }, [view]);

  // Location options (with counts), most common first
  const locations = useMemo(() => {
    const m = new Map();
    clients.forEach((c) => {
      const key = c.location ? norm(c.location) : "__none";
      const cur = m.get(key) || { key, label: c.location || "No location", count: 0 };
      cur.count++;
      m.set(key, cur);
    });
    return [...m.values()].sort((a, b) => (a.key === "__none") - (b.key === "__none") || b.count - a.count || a.label.localeCompare(b.label));
  }, [clients]);

  // Search + location define the scope; the status chips count inside that scope
  const scoped = useMemo(() => {
    const s = q.trim().toLowerCase();
    const digits = s.replace(/\D/g, "");
    return clients.filter((c) => {
      if (loc !== "all" && (c.location ? norm(c.location) : "__none") !== loc) return false;
      if (!s) return true;
      return c.search.includes(s) || (digits.length >= 3 && c.search.includes(digits));
    });
  }, [clients, q, loc]);

  const counts = useMemo(() => {
    const c = { all: scoped.length, active: 0, pass: 0, inactive: 0, followup: 0 };
    scoped.forEach((x) => { c[x.status]++; if (needsFollowUp(x)) c.followup++; });
    return c;
  }, [scoped]);

  const shown = useMemo(() => {
    const list = status === "all" ? [...scoped]
      : status === "followup" ? scoped.filter((c) => needsFollowUp(c))
      : scoped.filter((c) => c.status === status);
    const byName = (a, b) => clientName(a).localeCompare(clientName(b));
    const regDate = (c) => new Date(c.user.registeredDate || c.user.joiningDate || c.user.createdAt || 0).getTime();
    if (sort === "followup") {
      // inactive / pass first, longest without a follow-up (or never) at the top
      const score = (c) => (c.status === "active" ? Infinity : c.lastContact ? new Date(c.lastContact.at).getTime() : 0);
      list.sort((a, b) => (score(a) === score(b) ? byName(a, b) : score(a) < score(b) ? -1 : 1));
    } else if (sort === "referrals") list.sort((a, b) => b.referrals.count - a.referrals.count || byName(a, b));
    else if (sort === "newest") list.sort((a, b) => regDate(b) - regDate(a) || byName(a, b));
    else list.sort(byName);
    return list;
  }, [scoped, status, sort]);

  const chips = [["all", "All"], ["active", "Active"], ["pass", "Pass"], ["inactive", "Inactive"]];
  const filtered = q.trim() || loc !== "all" || status !== "all";
  const clear = () => { setQ(""); setLoc("all"); setStatus("all"); };

  return (
    <div className="crm-tab">
      <div className="crm-toolbar crm-toolbar-clients">
        <label className="crm-search">
          <IconSearch /><span className="crm-sr">Search clients</span>
          <input type="search" placeholder="Student, parent, phone, ID…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className="crm-select" value={loc} onChange={(e) => setLoc(e.target.value)} aria-label="Location">
          <option value="all">All locations ({clients.length})</option>
          {locations.map((l) => <option key={l.key} value={l.key}>{l.label} ({l.count})</option>)}
        </select>
        <select className="crm-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
          {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      <div className="crm-chips" role="group" aria-label="Filter by status">
        {chips.slice(0, 1).map(([key, label]) => (
          <button key={key} type="button" className={`crm-chip${status === key ? " active" : ""}`} aria-pressed={status === key} onClick={() => setStatus(key)}>
            {label} <span className="crm-chip-count">{counts[key]}</span>
          </button>
        ))}
        <button type="button" className={`crm-chip crm-chip-due${status === "followup" ? " active" : ""}`} aria-pressed={status === "followup"} onClick={() => setStatus("followup")}
          title={`Inactive or pass, not contacted in the last ${FOLLOWUP_DAYS} days`}>
          <IconClock size={14} /> Needs follow-up <span className="crm-chip-count">{counts.followup}</span>
        </button>
        {chips.slice(1).map(([key, label]) => (
          <button key={key} type="button" className={`crm-chip${status === key ? " active" : ""}`} aria-pressed={status === key} onClick={() => setStatus(key)}>
            {label} <span className="crm-chip-count">{counts[key]}</span>
          </button>
        ))}
      </div>
      <div className="crm-hint-row">
        <p className="crm-hint" aria-live="polite">
          {status === "followup"
            ? `${shown.length} inactive or pass, not contacted in ${FOLLOWUP_DAYS}+ days`
            : `${shown.length} of ${clients.length} · Pass = fee pass for ${monthShort(monthKeyOf())}`}
        </p>
        <div className="crm-segment small" role="radiogroup" aria-label="View">
          {[["grid", "Grid"], ["list", "List"]].map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={view === v} className={view === v ? "active" : ""} onClick={() => setView(v)}>{l}</button>
          ))}
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="crm-empty"><IconUsers size={28} /><p>No enrolled students yet. Converted leads appear here.</p></div>
      ) : shown.length === 0 && status === "followup" && !q.trim() && loc === "all" ? (
        <div className="crm-empty"><p><strong>All caught up.</strong> Every inactive and pass client was contacted in the last {FOLLOWUP_DAYS} days.</p></div>
      ) : shown.length === 0 ? (
        <div className="crm-empty">
          <p><strong>No clients match.</strong> Try another status or location, or search by a different name or number.</p>
          {filtered && <button type="button" className="crm-btn crm-btn-ghost" onClick={clear}>Clear filters</button>}
        </div>
      ) : view === "grid" ? (
        <ul className="crm-clients-grid">
          {shown.map((c) => <li key={c.id}><ClientCard client={c} onOpen={onOpen} onCall={onCall} onMessage={onMessage} /></li>)}
        </ul>
      ) : (
        <div className="crm-clients-list-wrap">
          <div className="crm-row-head" aria-hidden="true">
            <span className="crm-row-name">Student / parent</span><span className="crm-row-phone">Phone</span><span className="crm-row-loc">Location</span>
            <span className="crm-row-mode">Mode</span><span className="crm-row-status">Status</span><span className="crm-row-ref">Referrals</span><span className="crm-row-last">Followed up</span>
            <span className="crm-row-actions-h" />
          </div>
          <ul className="crm-clients-list">
            {shown.map((c) => <li key={c.id}><ClientRow client={c} onOpen={onOpen} onCall={onCall} onMessage={onMessage} /></li>)}
          </ul>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// message sheet (Call is a plain tel: link; WhatsApp opens here first so the
// message can be changed)
// ---------------------------------------------------------------------------
export const ClientMessageSheet = ({ client, staff, dark, startWith, onClose, onSent }) => {
  const templates = useMemo(() => clientTemplates(client, staff), [client, staff]);
  const first = templates.find((t) => t.key === startWith) || templates[0];
  const [key, setKey] = useState(first.key);
  const [text, setText] = useState(first.text);
  const href = waHref(client.user.phone, text);
  const pick = (t) => { setKey(t.key); setText(t.text); };
  const label = templates.find((t) => t.key === key)?.label || "Message";
  return (
    <Sheet title={`Message ${client.user.fullName || clientName(client)}`} onClose={onClose} dark={dark} labelledBy="crm-msg-title">
      <p className="crm-muted">
        For <strong>{clientName(client)}</strong> · <StatusBadge status={client.status} />
      </p>
      <div className="crm-segment" role="radiogroup" aria-label="Message template">
        {templates.map((t) => (
          <button key={t.key} type="button" role="radio" aria-checked={key === t.key} className={key === t.key ? "active" : ""} onClick={() => pick(t)}>{t.label}</button>
        ))}
      </div>
      <Field label="Message" hint="Edit it however you like before opening WhatsApp.">
        <textarea rows={9} value={text} onChange={(e) => setText(e.target.value)} data-autofocus />
      </Field>
      {!href && <p className="crm-error" role="alert"><IconError /> This phone number can't be used for WhatsApp. Fix it in the student's profile first.</p>}
      <div className="crm-form-actions">
        <button type="button" className="crm-btn crm-btn-ghost" onClick={onClose}>Cancel</button>
        {href ? (
          <a className="crm-btn crm-btn-wa" href={href} target="_blank" rel="noopener noreferrer" onClick={() => { onSent(client, label); onClose(); }}>
            <IconWhatsApp /> Open WhatsApp
          </a>
        ) : (
          <button type="button" className="crm-btn crm-btn-wa" disabled><IconWhatsApp /> Open WhatsApp</button>
        )}
      </div>
    </Sheet>
  );
};

// ---------------------------------------------------------------------------
// detail sheet
// ---------------------------------------------------------------------------
export const ClientDetail = ({ client, dark, onClose, onOpenClient, onCall, onMessage, onNote }) => {
  const u = client.user;
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const ref = client.referrals;
  const saveNote = async (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    setError("");
    try {
      await onNote(client, note.trim());
      setNote("");
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't save the note. Try again.");
    } finally {
      setSaving(false);
    }
  };
  const rows = [
    ["Parent", u.fullName], ["Admission ID", u.admissionId], ["Phone", u.phone], ["Email", u.parentEmail || u.email],
    ["Location", client.location], ["City", u.city && u.city !== client.location ? u.city : ""],
    ["Student age", u.childAge ? `${u.childAge} yrs` : ""], ["Registered", fmtYMD(u.registeredDate)], ["Joined", fmtYMD(u.joiningDate)],
  ].filter(([, v]) => v);
  const passes = [...(u.passes || [])].sort((a, b) => (b.month || "").localeCompare(a.month || "")).slice(0, 6);

  return (
    <Sheet title={clientName(client)} onClose={onClose} dark={dark} wide labelledBy="crm-client-title">
      <div className="crm-lead-top">
        <div>
          <p className="crm-lead-sub">{u.fullName || "—"}{u.admissionId ? ` · ${u.admissionId}` : ""}</p>
          <div className="crm-client-tags"><StatusBadge status={client.status} /><ModeBadge mode={u.classMode} /></div>
        </div>
        <Actions client={client} onCall={onCall} onMessage={onMessage} />
      </div>

      {client.status === "inactive" && (
        <div className="crm-notice warn">
          Inactive{client.inactive?.from ? ` since ${monthLabel(client.inactive.from)}` : ""}{client.inactive?.reason ? ` · ${client.inactive.reason}` : ""}. Send a follow-up to bring them back.
        </div>
      )}
      {client.status === "pass" && (
        <div className="crm-notice warn">
          On a fee pass for {monthLabel(client.pass.month)}{client.pass.reason ? ` · ${client.pass.reason}` : ""}. Check when they plan to rejoin.
        </div>
      )}

      <section className="crm-section">
        <h3 className="crm-section-title"><IconShare /> Referrals</h3>
        <div className="crm-ref-card">
          <span className="crm-ref-number" aria-label={`${ref.count} referrals made`}>{ref.count}</span>
          <span className="crm-muted">{ref.count === 1 ? "family referred" : "families referred"} who joined</span>
        </div>
        {ref.families.length > 0 && (
          <ul className="crm-list">
            {ref.families.map((f) => (
              <li key={f.key} className="crm-task">
                <span className="crm-task-icon tone-today" aria-hidden="true"><IconUser /></span>
                <div className="crm-task-body">
                  <p className="crm-task-title">{f.parent}</p>
                  <p className="crm-muted">{f.students.map((s) => `${s.name} (${STATUS[s.status].label})`).join(", ")}</p>
                </div>
                <button type="button" className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => onOpenClient(f.students[0].id)}>Open <IconChevronRight size={14} /></button>
              </li>
            ))}
          </ul>
        )}
        {ref.openLeads.length > 0 && (
          <p className="crm-hint">+ {ref.openLeads.length} enquir{ref.openLeads.length === 1 ? "y" : "ies"} in progress: {ref.openLeads.map((l) => l.parentName).join(", ")}</p>
        )}
        {ref.count === 0 && ref.openLeads.length === 0 && (
          <div>
            <p className="crm-hint">No referrals recorded yet.</p>
            <button type="button" className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => onMessage(client, "referral")}><IconWhatsApp /> Ask for a referral</button>
          </div>
        )}
        {client.referredByText && (
          <p className="crm-hint">
            Referred by <strong>{client.referredBy ? client.referredBy.parent : client.referredByText}</strong>
            {client.referredBy && (
              <> · <button type="button" className="crm-linkbtn" onClick={() => onOpenClient(client.referredBy.students[0].id)}>open</button></>
            )}
          </p>
        )}
      </section>

      <section className="crm-section">
        <h3 className="crm-section-title"><IconUser /> Details</h3>
        <dl className="crm-dl">
          {rows.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
        </dl>
      </section>

      <section className="crm-section">
        <h3 className="crm-section-title"><IconCalendar /> Class &amp; fees</h3>
        <dl className="crm-dl">
          <div><dt>Class</dt><dd>{client.cls ? client.cls.className : "Not assigned"}</dd></div>
          <div><dt>Teacher</dt><dd>{client.cls?.teacher?.fullName || "—"}</dd></div>
          {client.cls?.schedule?.length > 0 && (
            <div className="crm-dl-wide"><dt>Schedule</dt><dd>{client.cls.schedule.map((s) => `${s.day} ${s.time}`).join(" · ")}</dd></div>
          )}
          <div><dt>Monthly fee</dt><dd>{u.monthlyFee ? `₹${Number(u.monthlyFee).toLocaleString()}` : "—"}</dd></div>
          <div><dt>{monthLabel(monthKeyOf())}</dt><dd>{FEE[client.fee]}</dd></div>
        </dl>
        {passes.length > 0 && (
          <details className="crm-details">
            <summary>Pass history ({(u.passes || []).length})</summary>
            <ul className="crm-list">
              {passes.map((p) => (
                <li key={p.month} className="crm-task">
                  <div className="crm-task-body"><p className="crm-task-title">{monthLabel(p.month)}</p>{p.reason && <p className="crm-muted">{p.reason}</p>}</div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {client.siblings.length > 0 && (
        <section className="crm-section">
          <h3 className="crm-section-title"><IconUsers /> Siblings enrolled</h3>
          <ul className="crm-list">
            {client.siblings.map((s) => (
              <li key={s._id} className="crm-task">
                <div className="crm-task-body"><p className="crm-task-title">{s.childName || s.username}</p><p className="crm-muted">{STATUS[statusOf(s, monthKeyOf())].label}</p></div>
                <button type="button" className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => onOpenClient(s._id)}>Open <IconChevronRight size={14} /></button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="crm-section">
        <h3 className="crm-section-title"><IconClock /> Follow-up history</h3>
        {client.contacts.length === 0 && <p className="crm-muted">No follow-ups logged yet. Calls and WhatsApp messages you start from here are recorded automatically.</p>}
        <ol className="crm-timeline">
          {[...client.contacts].reverse().slice(0, 10).map((c) => (
            <li key={c._id || c.at} className={`t-${c.channel === "whatsapp" ? "whatsapp" : c.channel === "call" ? "demo" : "note"}`}>
              <p className="crm-tl-text">{({ call: "Called", whatsapp: "WhatsApp", note: "Note" })[c.channel]}{c.note ? `: ${c.note}` : ""}</p>
              <p className="crm-muted">{fmtDateTime(c.at)}{c.by ? ` · ${c.by}` : ""}</p>
            </li>
          ))}
        </ol>
        <form className="crm-form" onSubmit={saveNote}>
          <Field label="Add a note"><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Spoke to mother — will rejoin from 10th" /></Field>
          {error && <p className="crm-error" role="alert"><IconError /> {error}</p>}
          <div className="crm-form-actions">
            <button type="submit" className="crm-btn crm-btn-primary crm-btn-sm" disabled={saving || !note.trim()}>{saving ? "Saving…" : <><IconNote /> Save note</>}</button>
          </div>
        </form>
      </section>
    </Sheet>
  );
};

export const logClientContact = (id, channel, note, by) =>
  axios.post(`${CLIENTS_API}/${id}/contact`, { channel, note, by }).then((r) => r.data.crmContacts);

