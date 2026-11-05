// Fee rules shared by the Admin and Parent dashboards, so a parent always sees
// exactly the dues Admin sees (and sends in WhatsApp reminders).

// "YYYY-MM" for a date (local time)
export const monthKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

// Student's first billable month "YYYY-MM": registeredDate, else joiningDate,
// else createdAt. A record with no date at all starts the current month.
export const getStudentStartMonth = (user) => {
  const dateStr = user?.registeredDate || user?.joiningDate || user?.createdAt;
  if (!dateStr) return new Date().toISOString().slice(0, 7);
  if (typeof dateStr === "string") return dateStr.slice(0, 7);
  return new Date(dateStr).toISOString().slice(0, 7);
};

// True if a student's inactiveHistory covers the given month (fee should be ₹0).
export const isStudentInactiveForMonth = (user, monthStr) => {
  const history = user?.inactiveHistory || [];
  return history.some((entry) => {
    const from = entry.inactiveFrom;
    const to = entry.inactiveTo; // null/undefined = still inactive
    return monthStr >= from && (!to || monthStr <= to);
  });
};

// The fee in effect for a month. Returns 0 for inactive months. A feeOverrides
// entry for the exact month wins over everything else — it's a one-off custom
// amount for that single still-unpaid month (Edit Fee in the Fee Tracker),
// separate from feeChangeHistory's permanent from-here-onward changes. Without
// any history, user.monthlyFee is used.
export const getFeeForMonth = (user, monthStr) => {
  if (isStudentInactiveForMonth(user, monthStr)) return 0;
  const override = (user?.feeOverrides || []).find((o) => o.month === monthStr);
  if (override) return Number(override.amount) || 0;

  const history = user?.feeChangeHistory || [];
  if (history.length === 0) return Number(user?.monthlyFee) || 0;

  // Best entry = greatest effectiveFrom <= monthStr; on ties the LAST entry
  // in the array wins (most recently saved).
  let best = null;
  let earliest = null;
  for (const entry of history) {
    if (!earliest || entry.effectiveFrom < earliest.effectiveFrom) earliest = entry;
    if (entry.effectiveFrom <= monthStr && (!best || entry.effectiveFrom >= best.effectiveFrom)) best = entry;
  }
  if (best) return Number(best.fee) || 0;

  // monthStr is before all history entries — use the earliest recorded fee
  return Number(earliest?.fee) || Number(user?.monthlyFee) || 0;
};

// Every month from the student's start month to `until` (inclusive), oldest first.
export const billableMonths = (user, until = monthKey()) => {
  const start = getStudentStartMonth(user);
  const months = [];
  let [y, m] = start.split("-").map(Number);
  const [uy, um] = until.split("-").map(Number);
  if (!y || !m) return months;
  while (y * 12 + m <= uy * 12 + um) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return months;
};

// One month's fee row: { month, status, amount, paidDate, reason }.
// status: "NotJoined" | "Paid" | "Pass" | "Inactive" | "Pending"
// (any payment entry for the month counts as Paid — Pending entries are
// deleted on the server, not stored).
export const feeRowForMonth = (user, month) => {
  if (month < getStudentStartMonth(user)) return { month, status: "NotJoined", amount: 0, paidDate: null };
  const payment = (user?.payments || []).find((p) => p.month === month && p.status === "Paid");
  if (payment) return { month, status: "Paid", amount: payment.amount ?? getFeeForMonth(user, month), paidDate: payment.paidDate || null };
  const pass = (user?.passes || []).find((p) => p.month === month);
  if (pass) return { month, status: "Pass", amount: 0, paidDate: null, reason: pass.reason || "" };
  if (isStudentInactiveForMonth(user, month)) return { month, status: "Inactive", amount: 0, paidDate: null };
  return { month, status: "Pending", amount: getFeeForMonth(user, month), paidDate: null };
};

// Full fee history, newest first, and the total still due.
export const buildFeeHistory = (user, until = monthKey()) => {
  const rows = billableMonths(user, until).map((m) => feeRowForMonth(user, m)).reverse();
  const totalDue = rows.reduce((sum, r) => (r.status === "Pending" ? sum + (Number(r.amount) || 0) : sum), 0);
  return { rows, totalDue, pendingMonths: rows.filter((r) => r.status === "Pending").length };
};
