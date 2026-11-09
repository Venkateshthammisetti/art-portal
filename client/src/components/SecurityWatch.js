// Admin home: "Security check — watch only". Shows which API calls the planned
// access rules would have refused. Nothing is blocked yet; this is how we make
// sure the rules fit real use before they are switched on.
import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import "./SecurityWatch.css";

const API = "https://art-portal-7n6r.onrender.com/api";
const ROLE = { admin: "Admin", teacher: "Teacher", parent: "Parent", crm: "Admissions", "-": "Not signed in", unknown: "Unknown" };
const HINT = {
  "no-token": "Usually fine: people still on a login from before this update. It fades as they log in again.",
  "bad-token": "An old or altered login pass. A few are normal; many from one person are worth a look.",
  "wrong-role": "If this is a normal screen for that role, the rule needs changing before protection goes on.",
  "not-own": "Someone opened another family's or teacher's data. Check it was expected.",
  "no-rule": "A new screen without a rule yet. A rule needs adding before protection goes on.",
};
const SHORT = { "no-token": "Old login", "bad-token": "Bad pass", "wrong-role": "Wrong role", "not-own": "Not their data", "no-rule": "No rule yet" };
const when = (d) => (d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");

const SecurityWatch = () => {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    axios.get(`${API}/admin/auth-watch?days=${days}`)
      .then((r) => {
        const d = r.data || {};
        setData({
          configured: d.configured !== false,
          checked: Number(d.checked) || 0,
          wouldBlock: Number(d.wouldBlock) || 0,
          byReason: d.byReason && typeof d.byReason === "object" ? d.byReason : {},
          rows: Array.isArray(d.rows) ? d.rows : [],
        });
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [days]);
  useEffect(() => { load(); }, [load]);

  const summary = !data
    ? (error ? "Couldn't load" : "Loading…")
    : data.wouldBlock
      ? `${data.wouldBlock.toLocaleString("en-IN")} of ${data.checked.toLocaleString("en-IN")} calls would be refused`
      : `${data.checked.toLocaleString("en-IN")} calls checked, none would be refused`;

  return (
    <details className="sw-card">
      <summary>
        <span className="sw-icon" aria-hidden="true">🔒</span>
        <span className="sw-title">Security check <em>watch only</em></span>
        <span className={`sw-sum${data?.wouldBlock ? " warn" : ""}`}>{summary}</span>
      </summary>

      <div className="sw-body">
        <p className="sw-intro">
          Nothing is blocked. The server checks every call against the planned rules and lists here the ones
          they would refuse, so the rules can be fixed before protection is switched on.
        </p>
        {data && !data.configured && (
          <p className="sw-alert" role="alert">
            Login passes are off on the server. Add <code>AUTH_SECRET</code> (any long random text) in Render → Environment.
          </p>
        )}

        <div className="sw-bar">
          <div className="sw-days" role="group" aria-label="Period">
            {[1, 7, 30].map((d) => (
              <button key={d} type="button" aria-pressed={days === d} className={days === d ? "on" : ""} onClick={() => setDays(d)}>
                {d === 1 ? "Today" : `${d} days`}
              </button>
            ))}
          </div>
          <button type="button" className="sw-refresh" onClick={load} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button>
        </div>

        {error && <p className="sw-alert">Couldn't load the security check. <button type="button" onClick={load}>Try again</button></p>}

        {data && data.rows.length === 0 && !error && (
          <p className="sw-clear">✓ Every call in this period fits the planned rules.</p>
        )}

        {data && data.rows.length > 0 && (
          <>
            <ul className="sw-reasons">
              {Object.entries(data.byReason).map(([r, n]) => (
                <li key={r} title={HINT[r]}><strong>{(Number(n) || 0).toLocaleString("en-IN")}</strong> {SHORT[r] || r}</li>
              ))}
            </ul>
            <ul className="sw-rows">
              {data.rows.map((r) => (
                <li key={`${r.method} ${r.route} ${r.reason} ${r.role}`}>
                  <div className="sw-row-top">
                    <code className="sw-route"><span>{r.method}</span> {r.route}</code>
                    <span className="sw-count">{(Number(r.count) || 0).toLocaleString("en-IN")}×</span>
                  </div>
                  <div className="sw-row-meta">
                    <span className={`sw-chip r-${r.reason}`}>{SHORT[r.reason] || r.reason}</span>
                    <span>{ROLE[r.role] || r.role}{r.lastUserName ? ` · last: ${r.lastUserName}` : ""}</span>
                    <span className="sw-when">{when(r.lastAt)}</span>
                  </div>
                  <p className="sw-hint">{HINT[r.reason] || r.reasonText}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </details>
  );
};

export default SecurityWatch;
