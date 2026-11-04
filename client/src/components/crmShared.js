// Small pieces shared by the CRM dashboard (leads) and its Clients page.
import React, { useEffect, useRef, useId } from "react";
import { createPortal } from "react-dom";
import { IconX } from "./Icons";

// ---------- formatting & links ----------
export const fmtTime = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
export const fmtDate = (d) => new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
export const fmtDateTime = (d) => `${fmtDate(d)}, ${fmtTime(d)}`;

// wa.me needs digits only with country code (Indian 10-digit numbers get 91)
export const waNumber = (raw) => {
  let d = String(raw || "").replace(/\D/g, "").replace(/^0+/, "");
  if (d.length === 10) d = "91" + d;
  return d.length >= 11 && d.length <= 15 ? d : null;
};
export const telHref = (raw) => `tel:${String(raw || "").replace(/[^\d+]/g, "")}`;
export const waHref = (phone, text) => {
  const n = waNumber(phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
};
export const firstName = (n) => (n || "").trim().split(/\s+/)[0] || "there";

// ---------- sheet ----------
// Several sheets can be open at once (e.g. a message over a client's details);
// Escape closes only the top one.
const openSheets = [];

export const Sheet = ({ title, onClose, children, dark, wide = false, labelledBy = "crm-sheet-title" }) => {
  const ref = useRef(null);
  const token = useRef({});
  useEffect(() => {
    const me = token.current;
    openSheets.push(me);
    const prev = document.activeElement;
    const first = ref.current?.querySelector("[data-autofocus]");
    (first || ref.current)?.focus();
    const onKey = (e) => e.key === "Escape" && openSheets[openSheets.length - 1] === me && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const i = openSheets.indexOf(me);
      if (i > -1) openSheets.splice(i, 1);
      prev?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return createPortal(
    <div className={`crm-root crm-sheet-backdrop${dark ? " crm-dark" : ""}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`crm-sheet${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}>
        <div className="crm-sheet-head">
          <h2 id={labelledBy}>{title}</h2>
          <button type="button" className="crm-icon-btn" onClick={onClose} aria-label="Close">
            <IconX size={20} />
          </button>
        </div>
        <div className="crm-sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
};

// A single control gets a <label for>, so its accessible name is just the label
// (a wrapping label would also pull in a dropdown's option texts).
export const Field = ({ label, hint, children, required }) => {
  const autoId = useId();
  const head = (
    <>
      {label}
      {required && <span className="crm-req" aria-hidden="true"> *</span>}
    </>
  );
  if (React.isValidElement(children)) {
    const id = children.props.id || autoId;
    const hintId = hint ? `${id}-hint` : undefined;
    return (
      <div className="crm-field">
        <label className="crm-field-label" htmlFor={id}>{head}</label>
        {React.cloneElement(children, { id, "aria-describedby": hintId, "aria-required": required || undefined })}
        {hint && <span id={hintId} className="crm-hint">{hint}</span>}
      </div>
    );
  }
  return (
    <label className="crm-field">
      <span className="crm-field-label">{head}</span>
      {children}
      {hint && <span className="crm-hint">{hint}</span>}
    </label>
  );
};
