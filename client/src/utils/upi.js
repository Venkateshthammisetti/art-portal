// The academy's UPI details, used by Pay by UPI (parent Fees), the QR in the
// payment popup and "Copy details". Change them here only.
export const UPI_ID = "9963613404-2@ybl";
export const UPI_NAME = "TAMMISETTI VENKATESH"; // name registered to the UPI ID

// upi://pay link that opens the parent's UPI app (GPay, PhonePe, Paytm, BHIM…)
// with the amount and a note already filled in.
export const upiLink = ({ amount, note } = {}) => {
  // Built by hand: some UPI apps reject a percent-encoded "@" in the UPI ID
  const parts = [`pa=${UPI_ID}`, `pn=${encodeURIComponent(UPI_NAME)}`];
  if (amount > 0) parts.push(`am=${Number(amount).toFixed(2)}`);
  parts.push("cu=INR");
  if (note) parts.push(`tn=${encodeURIComponent(String(note).slice(0, 50))}`);
  return `upi://pay?${parts.join("&")}`;
};

// Phones and tablets can open upi:// links; desktop browsers can't.
export const canOpenUpiApp = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return true;
  return navigator.maxTouchPoints > 1 && /Macintosh/.test(ua); // iPadOS reports as a Mac
};

// "Aarav fee Oct, Nov 26"
export const upiNote = (childName, months) => {
  const first = String(childName || "").trim().split(/\s+/)[0] || "Fee";
  const label = months.map((m) => {
    const [y, mo] = m.split("-").map(Number);
    return new Date(y, mo - 1, 1).toLocaleString("en-US", { month: "short" });
  });
  const year = months.length ? ` ${months[months.length - 1].slice(2, 4)}` : "";
  return `${first} fee ${label.join(", ")}${year}`;
};
