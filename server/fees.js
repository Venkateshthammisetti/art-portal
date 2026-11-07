// Server copy of the fee rules in client/src/utils/fees.js (keep the two in step):
// fee changes over time, one-off month overrides, passes and inactive months.
const getStudentStartMonth = (u) => {
  const d = u?.registeredDate || u?.joiningDate || u?.createdAt;
  if (!d) return new Date().toISOString().slice(0, 7);
  return (typeof d === "string" ? d : new Date(d).toISOString()).slice(0, 7);
};

const isInactiveForMonth = (u, m) =>
  (u?.inactiveHistory || []).some((e) => m >= e.inactiveFrom && (!e.inactiveTo || m <= e.inactiveTo));

const getFeeForMonth = (u, m) => {
  if (isInactiveForMonth(u, m)) return 0;
  const o = (u?.feeOverrides || []).find((x) => x.month === m);
  if (o) return Number(o.amount) || 0;
  const h = u?.feeChangeHistory || [];
  if (!h.length) return Number(u?.monthlyFee) || 0;
  let best = null, earliest = null;
  for (const e of h) {
    if (!earliest || e.effectiveFrom < earliest.effectiveFrom) earliest = e;
    if (e.effectiveFrom <= m && (!best || e.effectiveFrom >= best.effectiveFrom)) best = e;
  }
  if (best) return Number(best.fee) || 0;
  return Number(earliest?.fee) || Number(u?.monthlyFee) || 0;
};

// Unpaid months from the start month up to (and including) `until`
const unpaidMonths = (u, until) => {
  const out = [];
  let [y, mo] = getStudentStartMonth(u).split("-").map(Number);
  const [uy, um] = until.split("-").map(Number);
  if (!y || !mo) return out;
  while (y * 12 + mo <= uy * 12 + um) {
    const m = `${y}-${String(mo).padStart(2, "0")}`;
    const paid = (u.payments || []).some((p) => p.month === m && p.status === "Paid");
    const pass = (u.passes || []).some((p) => p.month === m);
    if (!paid && !pass && !isInactiveForMonth(u, m)) out.push({ month: m, amount: getFeeForMonth(u, m) });
    mo += 1;
    if (mo > 12) { mo = 1; y += 1; }
  }
  return out;
};

module.exports = { getStudentStartMonth, isInactiveForMonth, getFeeForMonth, unpaidMonths };
