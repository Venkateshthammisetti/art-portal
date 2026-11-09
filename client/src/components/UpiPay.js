// Parent › Fees: "Pay by UPI". The parent ticks the months to pay (all due
// months to start with); on a phone one tap opens their UPI app with the amount
// and a note filled in. Afterwards "I've paid" opens Send payment proof with the
// same months, so the academy can mark them paid. On a computer it shows the QR.
import React, { useEffect, useState } from "react";
import { UPI_ID, upiLink, upiNote, canOpenUpiApp } from "../utils/upi";
import "./UpiPay.css";

const monthShort = (ym) => {
  const [y, m] = String(ym).split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "short", year: "numeric" });
};
const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

const UpiPayCard = ({ pendingRows = [], childName, onPaid, onShowQr }) => {
  const rowsKey = pendingRows.map((r) => `${r.month}:${r.amount}`).join("|");
  const [months, setMonths] = useState(() => pendingRows.map((r) => r.month));
  const [opened, setOpened] = useState(false);
  const [copied, setCopied] = useState(false);
  const phone = canOpenUpiApp();

  // Keep the ticked months valid when the dues change (e.g. a month gets marked paid)
  useEffect(() => {
    setMonths((ms) => {
      const valid = ms.filter((m) => pendingRows.some((r) => r.month === m));
      return valid.length ? valid : pendingRows.map((r) => r.month);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsKey]);

  if (!pendingRows.length) return null;

  const chosen = pendingRows.filter((r) => months.includes(r.month)); // oldest first
  const amount = chosen.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const link = upiLink({ amount, note: upiNote(childName, chosen.map((r) => r.month)) });
  const toggle = (m) => setMonths((ms) => (ms.includes(m) ? ms.filter((x) => x !== m) : [...ms, m]));
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(UPI_ID);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked: the ID is on screen to type */ }
  };
  const paid = () => onPaid(chosen.map((r) => r.month));

  return (
    <section className="upi-card" aria-labelledby="upi-title">
      <div className="upi-head">
        <div>
          <h4 id="upi-title">Pay by UPI</h4>
          <p>GPay, PhonePe, Paytm or any UPI app</p>
        </div>
        <strong className="upi-amt" aria-live="polite">{inr(amount)}</strong>
      </div>

      {pendingRows.length > 1 && (
        <div className="upi-months" role="group" aria-label="Months to pay">
          {pendingRows.map((r) => {
            const on = months.includes(r.month);
            return (
              <button key={r.month} type="button" className={on ? "on" : ""} aria-pressed={on} onClick={() => toggle(r.month)}>
                <span className="upi-tick" aria-hidden="true">{on ? "✓" : ""}</span>
                {monthShort(r.month)} <em>{inr(r.amount)}</em>
              </button>
            );
          })}
        </div>
      )}

      {phone ? (
        amount > 0 ? (
          <a className="upi-pay-btn" href={link} onClick={() => setOpened(true)}>
            Pay {inr(amount)} in UPI app
          </a>
        ) : (
          <button type="button" className="upi-pay-btn" disabled>Choose a month to pay</button>
        )
      ) : (
        <button type="button" className="upi-pay-btn" onClick={onShowQr}>
          Show QR to scan with your phone
        </button>
      )}

      {opened ? (
        <div className="upi-done" role="status">
          <p>Finished paying? Send the payment screenshot so the academy can mark {chosen.length === 1 ? "it" : "them"} as paid.</p>
          <button type="button" className="upi-done-btn" onClick={paid}>I've paid · send screenshot</button>
        </div>
      ) : (
        <button type="button" className="upi-link" onClick={paid}>Already paid? Send the screenshot</button>
      )}

      <div className="upi-foot">
        <span>UPI ID <b>{UPI_ID}</b></span>
        <button type="button" onClick={copy}>{copied ? "Copied ✓" : "Copy"}</button>
        {phone && <button type="button" onClick={onShowQr}>Show QR</button>}
      </div>
      {phone && <p className="upi-fine">If your UPI app doesn't open or won't accept the link, pay to the UPI ID above or scan the QR.</p>}
    </section>
  );
};

export default UpiPayCard;
