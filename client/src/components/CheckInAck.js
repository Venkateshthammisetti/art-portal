// "I'm aware" on a missed-classes check-in item (Teacher home, Admin Needs
// attention). Saves the mark (with an optional note) for this run of absences.
import React, { useState } from "react";
import axios from "axios";
import notify from "../utils/notify";
import "./CheckInAck.css";

const API = "https://art-portal-7n6r.onrender.com/api";

export const ackCheckIn = (studentId, by, note = "") => axios.post(`${API}/checkins/${studentId}`, { by, note });
export const undoCheckIn = (studentId, by) => axios.delete(`${API}/checkins/${studentId}`, { params: { by } });

export const AwareButton = ({ studentId, childName, by, onChange }) => {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const first = String(childName || "").split(" ")[0] || "this student";

  const save = async () => {
    setBusy(true);
    try {
      await ackCheckIn(studentId, by, note);
      onChange(true, note.trim());
      notify.success(`Hidden. ${first} shows again only after attending and then missing 3 in a row.`, {
        action: {
          label: "Undo",
          onClick: () => undoCheckIn(studentId, by).then(() => onChange(false, "")).catch(() => notify.error("Couldn't undo. Try again.")),
        },
      });
    } catch (err) {
      notify.error(err.response?.data?.message || "Couldn't save. Try again.");
      if (err.response?.status === 409) onChange(true, ""); // not missing any more: drop it
    } finally {
      setBusy(false);
      setOpen(false);
      setNote("");
    }
  };

  if (!open) {
    return <button type="button" className="ack-btn" onClick={(e) => { e.stopPropagation(); setOpen(true); }}>I'm aware</button>;
  }
  return (
    <div className="ack-form" onClick={(e) => e.stopPropagation()}>
      <label className="ack-sr" htmlFor={`ack-${studentId}`}>Note (optional)</label>
      <input
        id={`ack-${studentId}`}
        type="text"
        value={note}
        maxLength={140}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setOpen(false); }}
        placeholder="Note (optional), e.g. travelling till 20th"
        autoFocus
      />
      <button type="button" className="ack-save" onClick={save} disabled={busy}>{busy ? "…" : "Hide"}</button>
      <button type="button" className="ack-cancel" onClick={() => setOpen(false)} aria-label="Cancel">×</button>
    </div>
  );
};
