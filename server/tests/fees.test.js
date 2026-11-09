// server/fees.js must give the same answers as client/src/utils/fees.js
// (Admin, Parent and the server's reminders all have to agree on what's due).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const server = require("../fees");

// Load the browser copy (ES module syntax) into a sandbox
const loadClientFees = () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "..", "client", "src", "utils", "fees.js"), "utf8");
  const names = [...src.matchAll(/export const (\w+)/g)].map((m) => m[1]);
  const code = `${src.replace(/export const /g, "const ")}\nmodule.exports = { ${names.join(", ")} };`;
  const sandbox = { module: { exports: {} }, Date, Number, String };
  vm.runInNewContext(code, sandbox);
  return sandbox.module.exports;
};
const client = loadClientFees();

const students = [
  { name: "plain", registeredDate: "2026-01-10", monthlyFee: 1500 },
  { name: "no dates", monthlyFee: 1000, createdAt: new Date("2026-03-05T00:00:00Z") },
  { name: "joining only", joiningDate: "2026-02-01", monthlyFee: 1200 },
  {
    name: "fee changes",
    registeredDate: "2026-01-01",
    monthlyFee: 2000,
    feeChangeHistory: [
      { fee: 1500, effectiveFrom: "2026-01" },
      { fee: 1800, effectiveFrom: "2026-04" },
      { fee: 2000, effectiveFrom: "2026-04" }, // same month: last saved wins
    ],
  },
  { name: "history starts late", registeredDate: "2026-01-01", monthlyFee: 999, feeChangeHistory: [{ fee: 1700, effectiveFrom: "2026-05" }] },
  { name: "override", registeredDate: "2026-01-01", monthlyFee: 1500, feeOverrides: [{ month: "2026-03", amount: 750 }] },
  {
    name: "inactive spell",
    registeredDate: "2026-01-01",
    monthlyFee: 1500,
    inactiveHistory: [{ inactiveFrom: "2026-02", inactiveTo: "2026-03" }, { inactiveFrom: "2026-06" }],
  },
  {
    name: "paid and passes",
    registeredDate: "2026-01-01",
    monthlyFee: 1500,
    payments: [{ month: "2026-01", status: "Paid", amount: 1500 }, { month: "2026-02", status: "Paid", amount: 1400 }],
    passes: [{ month: "2026-03", reason: "Sibling" }],
  },
];
const months = ["2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"];

test("start month: registeredDate, then joiningDate, then createdAt", () => {
  assert.equal(server.getStudentStartMonth(students[0]), "2026-01");
  assert.equal(server.getStudentStartMonth(students[1]), "2026-03");
  assert.equal(server.getStudentStartMonth(students[2]), "2026-02");
  for (const s of students) assert.equal(server.getStudentStartMonth(s), client.getStudentStartMonth(s), s.name);
});

test("fee for each month matches the client rules", () => {
  for (const s of students) {
    for (const m of months) {
      assert.equal(server.getFeeForMonth(s, m), client.getFeeForMonth(s, m), `${s.name} ${m}`);
      assert.equal(server.isInactiveForMonth(s, m), client.isStudentInactiveForMonth(s, m), `${s.name} ${m}`);
    }
  }
});

test("specific fee rules", () => {
  const changes = students[3];
  assert.equal(server.getFeeForMonth(changes, "2026-03"), 1500);
  assert.equal(server.getFeeForMonth(changes, "2026-04"), 2000, "two changes in one month: the last saved wins");
  assert.equal(server.getFeeForMonth(students[4], "2026-02"), 1700, "before the first change: earliest recorded fee");
  assert.equal(server.getFeeForMonth(students[5], "2026-03"), 750, "a one-month override wins");
  assert.equal(server.getFeeForMonth(students[5], "2026-04"), 1500);
  assert.equal(server.getFeeForMonth(students[6], "2026-02"), 0, "inactive month is free");
  assert.equal(server.getFeeForMonth(students[6], "2026-07"), 0, "open-ended inactive");
});

test("unpaid months match the client's Pending rows", () => {
  for (const s of students) {
    const fromServer = server.unpaidMonths(s, "2026-07");
    const fromClient = client.buildFeeHistory(s, "2026-07").rows
      .filter((r) => r.status === "Pending")
      .map((r) => ({ month: r.month, amount: r.amount }))
      .reverse();
    // (objects from the sandbox have another realm's prototype; compare as data)
    assert.deepEqual(fromServer, JSON.parse(JSON.stringify(fromClient)), s.name);
  }
  const paid = server.unpaidMonths(students[7], "2026-04").map((u) => u.month);
  assert.deepEqual(paid, ["2026-04"], "paid months and pass months are not due");
});
