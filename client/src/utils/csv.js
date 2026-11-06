// CSV download for admin lists. Opens cleanly in Excel / Google Sheets:
// UTF-8 BOM, quoted cells, and cells that start with = + - @ are prefixed so
// a spreadsheet never runs them as formulas.
const cell = (v) => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export const toCSV = (header, rows) => [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");

export const downloadCSV = (filename, header, rows) => {
  const blob = new Blob(["﻿" + toCSV(header, rows)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
