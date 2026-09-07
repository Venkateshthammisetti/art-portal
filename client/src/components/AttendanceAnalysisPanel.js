import React, { useEffect, useRef, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  ComposedChart,
  Line,
  Legend,
} from "recharts";
import axios from "axios";
import { toPng } from "html-to-image";
import {
  IconCalendar,
  IconCheck,
  IconError,
  IconWarning,
  IconTrendingUp,
  IconDownload,
  IconShare,
  IconWhatsApp,
} from "./Icons";

const API = "https://art-portal-7n6r.onrender.com";

export const ATT_COLORS = { Present: "#16a34a", Absent: "#ef4444", Missed: "#f59e0b" };

const slugify = (s) =>
  String(s || "attendance-analysis")
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60) || "attendance-analysis";

// wa.me needs a bare international number: digits only, country code, no "+".
// Mirrors the normaliser used elsewhere in the admin dashboard.
const toWhatsAppNumber = (raw) => {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, "");
  if (!d) return null;
  d = d.replace(/^0+/, "");
  if (d.length === 10) d = "91" + d;
  if (d.length === 12 && d.startsWith("91")) return d;
  return d.length >= 11 && d.length <= 15 ? d : null;
};

// Renders `node` to a PNG data URL, skipping any element flagged .aa-no-export.
const nodeToPng = (node, background) =>
  toPng(node, {
    backgroundColor: background,
    pixelRatio: 2,
    cacheBust: true,
    filter: (el) => !(el.classList && el.classList.contains("aa-no-export")),
  });

const triggerDownload = (dataUrl, fileName) => {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Detect the active theme from the DOM: the admin shell sets
// [data-theme="dark"] on .admin-container, the parent shell sets
// <body class="dark">. An explicit boolean `dark` prop always wins.
const detectDark = () => {
  if (typeof document === "undefined") return false;
  return (
    document.body.classList.contains("dark") ||
    !!document.querySelector('.admin-container[data-theme="dark"]')
  );
};

const useIsDark = (explicit) => {
  const [dark, setDark] = useState(() =>
    typeof explicit === "boolean" ? explicit : detectDark(),
  );
  useEffect(() => {
    if (typeof explicit === "boolean") {
      setDark(explicit);
      return undefined;
    }
    const sync = () => setDark(detectDark());
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    const admin = document.querySelector(".admin-container");
    if (admin) mo.observe(admin, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, [explicit]);
  return dark;
};

const palette = (dark) => ({
  panelBg: dark ? "#0f172a" : "#ffffff",
  cardBg: dark ? "#1e293b" : "#fafbfc",
  soloBg: dark ? "#1e293b" : "#ffffff",
  border: dark ? "#334155" : "#e2e8f0",
  text: dark ? "#f1f5f9" : "#1e293b",
  muted: dark ? "#94a3b8" : "#64748b",
  faint: dark ? "#64748b" : "#94a3b8",
  grid: dark ? "#1e293b" : "#f1f5f9",
  headBg: dark ? "#1e293b" : "#f8fafc",
  rowBorder: dark ? "#334155" : "#f1f5f9",
  toggleTrack: dark ? "#0f172a" : "#f1f5f9",
  toggleActive: dark ? "#334155" : "#ffffff",
});

const rateColor = (held, rate) =>
  held === 0 ? "#94a3b8" : rate >= 80 ? "#16a34a" : rate >= 50 ? "#d97706" : "#dc2626";

const AttTooltip = ({ active, payload, label, dark }) => {
  if (!active || !payload || !payload.length) return null;
  const c = palette(dark);
  return (
    <div
      style={{
        background: c.soloBg,
        border: `1px solid ${c.border}`,
        borderRadius: 8,
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        padding: "9px 12px",
        fontSize: "0.78rem",
      }}
    >
      {label != null && (
        <div style={{ fontWeight: 700, color: c.text, marginBottom: 5 }}>{label}</div>
      )}
      {payload.map((e) => (
        <div
          key={e.dataKey || e.name}
          style={{ color: e.color || (e.payload && e.payload.color) || c.text, fontWeight: 600 }}
        >
          {e.name}: {e.value}
          {/rate/i.test(e.dataKey || "") ? "%" : ""}
        </div>
      ))}
    </div>
  );
};

// Scrollable table with a sticky header row and an optional sticky totals row.
const StickyTable = ({ dark, columns, rows, totalsRow, emptyText = "No data." }) => {
  const c = palette(dark);
  const th = {
    position: "sticky",
    top: 0,
    zIndex: 3,
    background: c.headBg,
    color: c.faint,
    padding: "12px 16px",
    fontSize: "0.8rem",
    fontWeight: 700,
    textAlign: "left",
    boxShadow: `inset 0 -1px 0 ${c.border}`,
    whiteSpace: "nowrap",
  };
  const td = {
    padding: "12px 16px",
    fontSize: "0.9rem",
    borderBottom: `1px solid ${c.rowBorder}`,
    color: c.text,
    whiteSpace: "nowrap",
  };
  const totTd = {
    ...td,
    position: "sticky",
    bottom: 0,
    zIndex: 3,
    background: c.headBg,
    borderBottom: "none",
    boxShadow: `inset 0 1px 0 ${c.border}`,
    fontWeight: 800,
  };
  return (
    <div
      style={{
        maxHeight: 360,
        overflow: "auto",
        border: `1px solid ${c.border}`,
        borderRadius: 12,
        position: "relative",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i} style={th}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{ ...td, textAlign: "center", color: c.faint, padding: 24 }}
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.key} style={{ opacity: row.dim ? 0.5 : 1 }}>
                {row.cells.map((cell, i) => (
                  <td
                    key={i}
                    style={{ ...td, color: cell.color || c.text, fontWeight: cell.bold ? 700 : 400 }}
                  >
                    {cell.v}
                  </td>
                ))}
              </tr>
            ))
          )}
          {totalsRow && (
            <tr>
              {totalsRow.map((cell, i) => (
                <td key={i} style={{ ...totTd, color: cell.color || c.text }}>
                  {cell.v}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

// Given a flat list of Attendance records ({ date: "YYYY-MM-DD", status }),
// renders a month-by-month Present / Absent / Missed breakdown for a chosen
// year with a rate line, split donut, trend area and a sticky monthly table.
export const AttendanceAnalysisPanel = ({
  records = [],
  loading,
  error,
  emptyLabel,
  renderExtra,
  dark: darkProp,
  exportTitle,
  shareTargets = [],
}) => {
  const dark = useIsDark(darkProp);
  const c = palette(dark);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [chartType, setChartType] = useState("bar");
  const captureRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const canExport = !!exportTitle;
  const fileBase = `${slugify(exportTitle)}-attendance-${year}`;

  const capture = async () => {
    if (!captureRef.current) return null;
    return nodeToPng(captureRef.current, c.panelBg);
  };

  const handleDownload = async () => {
    setBusy(true);
    try {
      const dataUrl = await capture();
      if (dataUrl) triggerDownload(dataUrl, `${fileBase}.png`);
    } catch (err) {
      alert("Could not generate the image. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const shareText = (childName) =>
    `${childName ? `${childName}'s attendance` : "Attendance"} analysis for ${year} — Thevenkyart Art Academy.`;

  const handleShare = async () => {
    setBusy(true);
    try {
      const dataUrl = await capture();
      if (!dataUrl) return;
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `${fileBase}.png`, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: exportTitle, text: shareText() });
        return;
      }
      // No native file sharing (typical on desktop): download the image, then
      // let the admin pick a parent to open WhatsApp with a ready message.
      triggerDownload(dataUrl, `${fileBase}.png`);
      if (shareTargets.length) {
        setPickerOpen(true);
      } else {
        alert("Image downloaded. Attach it in your chat with the parent to share.");
      }
    } catch (err) {
      if (err && err.name !== "AbortError") {
        alert("Could not prepare the image to share. Please try the Download button.");
      }
    } finally {
      setBusy(false);
    }
  };

  const shareToParent = (target) => {
    setPickerOpen(false);
    const number = toWhatsAppNumber(target.phone);
    if (!number) {
      alert(
        `No usable WhatsApp number for ${target.child || target.label}.\n\n` +
          `Stored phone: ${target.phone || "(empty)"}\n\n` +
          `The attendance image was still downloaded — send it manually.`,
      );
      return;
    }
    const greet = target.parent ? `${target.parent} Sir/Madam` : "Sir/Madam";
    const msg =
      `Attendance summary — ${target.child || target.label}\n` +
      `Hello ${greet}, this is Thevenkyart Art Academy.\n\n` +
      `As requested, here is ${target.child || "your child"}'s attendance analysis for ${year}. ` +
      `Please see the attached image (just downloaded to your device).\n\n` +
      `Do let us know if you have any questions.`;
    window.open(
      `https://wa.me/${number}?text=${encodeURIComponent(msg)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const years = (() => {
    const set = new Set([currentYear]);
    records.forEach((r) => {
      if (r.date) set.add(Number(String(r.date).slice(0, 4)));
    });
    return [...set].filter((y) => y >= 2015 && y <= currentYear + 1).sort((a, b) => b - a);
  })();

  const monthly = [];
  for (let m = 0; m < 12; m++) {
    const monthStr = `${year}-${String(m + 1).padStart(2, "0")}`;
    const inMonth = records.filter((r) => String(r.date || "").slice(0, 7) === monthStr);
    const present = inMonth.filter((r) => r.status === "Present").length;
    const absent = inMonth.filter((r) => r.status === "Absent").length;
    const missed = inMonth.filter((r) => r.status === "Missed").length;
    const held = present + absent + missed;
    const d = new Date(monthStr + "-01");
    monthly.push({
      monthStr,
      name: d.toLocaleString("default", { month: "short" }),
      nameLong: `${d.toLocaleString("default", { month: "long" })} ${year}`,
      present,
      absent,
      missed,
      held,
      rate: held > 0 ? Math.round((present / held) * 100) : 0,
    });
  }

  const totalPresent = monthly.reduce((a, r) => a + r.present, 0);
  const totalAbsent = monthly.reduce((a, r) => a + r.absent, 0);
  const totalMissed = monthly.reduce((a, r) => a + r.missed, 0);
  const totalHeld = totalPresent + totalAbsent + totalMissed;
  const overallRate = totalHeld > 0 ? Math.round((totalPresent / totalHeld) * 100) : 0;
  const activeMonths = monthly.filter((r) => r.held > 0);
  const bestMonth = activeMonths.reduce((b, r) => (!b || r.rate > b.rate ? r : b), null);
  const worstMonth = activeMonths.reduce((b, r) => (!b || r.rate < b.rate ? r : b), null);

  const pieData = [
    { name: "Present", value: totalPresent, color: ATT_COLORS.Present },
    { name: "Absent", value: totalAbsent, color: ATT_COLORS.Absent },
    { name: "Missed", value: totalMissed, color: ATT_COLORS.Missed },
  ].filter((d) => d.value > 0);

  const kpis = [
    { label: "Classes Held", value: totalHeld, color: dark ? "#e2e8f0" : "#0f172a", tint: dark ? "#0f172a" : "#f1f5f9", Icon: IconCalendar },
    { label: "Present", value: totalPresent, color: "#16a34a", tint: dark ? "#052e16" : "#f0fdf4", Icon: IconCheck },
    { label: "Absent", value: totalAbsent, color: "#ef4444", tint: dark ? "#450a0a" : "#fef2f2", Icon: IconError },
    { label: "Missed", value: totalMissed, color: "#f59e0b", tint: dark ? "#422006" : "#fffbeb", Icon: IconWarning },
    { label: "Attendance Rate", value: `${overallRate}%`, color: "#0f766e", tint: dark ? "#042f2e" : "#f0fdfa", Icon: IconTrendingUp },
  ];

  const cardStyle = { background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 12, padding: 16 };
  const sectionTitle = { margin: "0 0 10px", fontSize: "0.9rem", fontWeight: 700, color: c.text };

  const toolBtn = (bg, color, border) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 12px",
    borderRadius: 8,
    border: border || "none",
    background: bg,
    color,
    fontWeight: 700,
    fontSize: "0.82rem",
    cursor: busy ? "wait" : "pointer",
    opacity: busy ? 0.7 : 1,
    whiteSpace: "nowrap",
  });

  return (
    <div
      ref={captureRef}
      style={{
        background: c.panelBg,
        border: `1px solid ${c.border}`,
        borderLeft: "4px solid #0f766e",
        borderRadius: 14,
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: c.text }}>
            Attendance Analysis — {year}
          </h3>
          {exportTitle && (
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: c.muted, marginTop: 2 }}>
              {exportTitle}
            </div>
          )}
        </div>

        <div
          className="aa-no-export"
          style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", position: "relative" }}
        >
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={{
              padding: "7px 12px",
              borderRadius: 8,
              border: `1px solid ${c.border}`,
              background: c.soloBg,
              color: c.text,
              fontWeight: 600,
              fontSize: "0.9rem",
            }}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          {canExport && !loading && !error && records.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleDownload}
                disabled={busy}
                style={toolBtn(dark ? "#1e293b" : "#f1f5f9", c.text, `1px solid ${c.border}`)}
                title="Download this analysis as a PNG image"
              >
                <IconDownload /> Image
              </button>
              <button
                type="button"
                onClick={handleShare}
                disabled={busy}
                style={toolBtn("#0f766e", "#fff")}
                title="Share this analysis image with a parent"
              >
                <IconShare /> Share
              </button>

              {pickerOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    right: 0,
                    zIndex: 40,
                    minWidth: 240,
                    maxHeight: 300,
                    overflowY: "auto",
                    background: c.soloBg,
                    border: `1px solid ${c.border}`,
                    borderRadius: 10,
                    boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
                    padding: 6,
                  }}
                >
                  <div style={{ padding: "6px 10px", fontSize: "0.75rem", fontWeight: 700, color: c.faint, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Send image to a parent
                  </div>
                  {shareTargets.length === 0 ? (
                    <div style={{ padding: "8px 10px", fontSize: "0.85rem", color: c.faint }}>No students in this class.</div>
                  ) : (
                    shareTargets.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => shareToParent(t)}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          gap: 1,
                          width: "100%",
                          textAlign: "left",
                          background: "transparent",
                          border: "none",
                          borderRadius: 6,
                          padding: "8px 10px",
                          cursor: "pointer",
                          color: c.text,
                        }}
                      >
                        <span style={{ fontWeight: 700, fontSize: "0.88rem", display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <IconWhatsApp /> {t.child || t.label}
                        </span>
                        <span style={{ fontSize: "0.76rem", color: c.faint }}>
                          {t.parent ? `${t.parent} · ` : ""}
                          {t.phone || "no number on file"}
                        </span>
                      </button>
                    ))
                  )}
                  <button
                    type="button"
                    onClick={() => setPickerOpen(false)}
                    style={{ width: "100%", background: "transparent", border: "none", color: c.faint, fontSize: "0.8rem", padding: "6px 10px", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {loading ? (
        <p style={{ color: c.faint, textAlign: "center", padding: "40px 0" }}>Loading attendance…</p>
      ) : error ? (
        <p style={{ color: "#dc2626", textAlign: "center", padding: "40px 0" }}>
          Failed to load attendance records.
        </p>
      ) : records.length === 0 ? (
        <p style={{ color: c.faint, textAlign: "center", padding: "40px 0" }}>
          {emptyLabel || "No attendance records found."}
        </p>
      ) : (
        <>
          {/* KPI ROW */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 12,
              marginBottom: 18,
            }}
          >
            {kpis.map((k) => (
              <div
                key={k.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: `1px solid ${c.border}`,
                  background: c.soloBg,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: k.tint,
                    color: k.color,
                    flexShrink: 0,
                  }}
                >
                  <k.Icon />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                      color: c.faint,
                    }}
                  >
                    {k.label}
                  </div>
                  <div
                    style={{
                      fontSize: "1.15rem",
                      fontWeight: 800,
                      color: k.color,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {k.value}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* MAIN CHART */}
          <div style={{ ...cardStyle, marginBottom: 18 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <h4 style={sectionTitle}>Monthly Attendance</h4>
              <div style={{ display: "inline-flex", background: c.toggleTrack, borderRadius: 8, padding: 3 }}>
                {["bar", "line"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setChartType(t)}
                    style={{
                      border: "none",
                      cursor: "pointer",
                      padding: "5px 14px",
                      borderRadius: 6,
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      background: chartType === t ? c.toggleActive : "transparent",
                      color: chartType === t ? c.text : c.faint,
                      boxShadow: chartType === t ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                    }}
                  >
                    {t[0].toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ width: "100%", height: 300, fontSize: "0.75rem" }}>
              <ResponsiveContainer>
                <ComposedChart data={monthly} margin={{ top: 10, right: 6, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.grid} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: c.faint, fontSize: 11 }} />
                  <YAxis yAxisId="count" axisLine={false} tickLine={false} width={30} allowDecimals={false} tick={{ fill: c.faint, fontSize: 11 }} />
                  <YAxis yAxisId="rate" orientation="right" axisLine={false} tickLine={false} width={38} unit="%" domain={[0, 100]} tick={{ fill: c.faint, fontSize: 11 }} />
                  <Tooltip content={<AttTooltip dark={dark} />} />
                  <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: "0.75rem" }} />
                  {chartType === "bar" ? (
                    <>
                      <Bar yAxisId="count" dataKey="present" name="Present" stackId="a" fill={ATT_COLORS.Present} maxBarSize={30} />
                      <Bar yAxisId="count" dataKey="absent" name="Absent" stackId="a" fill={ATT_COLORS.Absent} maxBarSize={30} />
                      <Bar yAxisId="count" dataKey="missed" name="Missed" stackId="a" fill={ATT_COLORS.Missed} maxBarSize={30} radius={[4, 4, 0, 0]} />
                      <Line yAxisId="rate" type="monotone" dataKey="rate" name="Rate %" stroke="#0f766e" strokeWidth={2.5} dot={{ r: 3, fill: "#0f766e" }} />
                    </>
                  ) : (
                    <>
                      <Line yAxisId="count" type="monotone" dataKey="present" name="Present" stroke={ATT_COLORS.Present} strokeWidth={2.5} dot={{ r: 3, fill: ATT_COLORS.Present }} />
                      <Line yAxisId="count" type="monotone" dataKey="absent" name="Absent" stroke={ATT_COLORS.Absent} strokeWidth={2.5} dot={{ r: 3, fill: ATT_COLORS.Absent }} />
                      <Line yAxisId="count" type="monotone" dataKey="missed" name="Missed" stroke={ATT_COLORS.Missed} strokeWidth={2.5} dot={{ r: 3, fill: ATT_COLORS.Missed }} />
                      <Line yAxisId="rate" type="monotone" dataKey="rate" name="Rate %" stroke="#0f766e" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* YEAR SPLIT + RATE TREND */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
              gap: 16,
              marginBottom: 18,
            }}
          >
            <div style={cardStyle}>
              <h4 style={sectionTitle}>Year Split ({year})</h4>
              {pieData.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: c.faint, fontSize: "0.85rem" }}>
                  No classes held in {year}.
                </div>
              ) : (
                <div style={{ width: "100%", height: 220, fontSize: "0.75rem" }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={78} paddingAngle={2}>
                        {pieData.map((d) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<AttTooltip dark={dark} />} />
                      <Legend verticalAlign="bottom" height={28} wrapperStyle={{ fontSize: "0.72rem" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div style={cardStyle}>
              <h4 style={sectionTitle}>Attendance Rate Trend</h4>
              <div style={{ width: "100%", height: 220, fontSize: "0.75rem" }}>
                <ResponsiveContainer>
                  <AreaChart data={monthly} margin={{ top: 10, right: 6, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="aaRateGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0f766e" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.grid} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: c.faint, fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} width={38} unit="%" domain={[0, 100]} tick={{ fill: c.faint, fontSize: 11 }} />
                    <Tooltip content={<AttTooltip dark={dark} />} />
                    <Area type="monotone" dataKey="rate" name="Rate %" stroke="#0f766e" strokeWidth={2.5} fillOpacity={1} fill="url(#aaRateGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* MONTHLY BREAKDOWN TABLE */}
          <StickyTable
            dark={dark}
            columns={["Month", "Present", "Absent", "Missed", "Held", "Rate"]}
            rows={monthly.map((r) => ({
              key: r.monthStr,
              dim: r.held === 0,
              cells: [
                { v: r.name, bold: true },
                { v: r.present, color: ATT_COLORS.Present, bold: true },
                { v: r.absent, color: ATT_COLORS.Absent, bold: true },
                { v: r.missed, color: ATT_COLORS.Missed, bold: true },
                { v: r.held, color: c.muted },
                { v: r.held > 0 ? `${r.rate}%` : "—", color: rateColor(r.held, r.rate), bold: true },
              ],
            }))}
            totalsRow={[
              { v: "Total" },
              { v: totalPresent, color: ATT_COLORS.Present },
              { v: totalAbsent, color: ATT_COLORS.Absent },
              { v: totalMissed, color: ATT_COLORS.Missed },
              { v: totalHeld, color: c.muted },
              { v: `${overallRate}%` },
            ]}
          />

          {bestMonth && worstMonth && (
            <p style={{ margin: "12px 2px 0", fontSize: "0.8rem", color: c.faint }}>
              Best month: <strong style={{ color: "#16a34a" }}>{bestMonth.nameLong}</strong> ({bestMonth.rate}
              %). Lowest: <strong style={{ color: "#dc2626" }}>{worstMonth.nameLong}</strong> (
              {worstMonth.rate}%).
            </p>
          )}

          {typeof renderExtra === "function" && renderExtra(year, { dark })}
        </>
      )}
    </div>
  );
};

// Fetches every attendance record for one student.
export const StudentAttendanceAnalysis = ({
  studentId,
  studentName,
  parentName,
  parentPhone,
  exportable = false,
  dark,
}) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);
    axios
      .get(`${API}/api/attendance/student/${studentId}`)
      .then((res) => {
        if (alive) setRecords(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (alive) setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [studentId]);

  return (
    <AttendanceAnalysisPanel
      records={records}
      loading={loading}
      error={error}
      dark={dark}
      emptyLabel={
        studentName ? `No attendance records for ${studentName}.` : "No attendance records found."
      }
      exportTitle={
        exportable
          ? `${studentName || "Student"} — Attendance`
          : undefined
      }
      shareTargets={
        exportable
          ? [
              {
                id: String(studentId),
                label: studentName || "Student",
                child: studentName || "Student",
                parent: parentName || "",
                phone: parentPhone || "",
              },
            ]
          : []
      }
    />
  );
};

// Fetches every attendance record for a whole class and adds a per-student table.
export const ClassAttendanceAnalysis = ({ classId, className, students = [], dark }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);
    axios
      .get(`${API}/api/attendance/class/${classId}`)
      .then((res) => {
        if (alive) setRecords(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (alive) setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [classId]);

  const renderPerStudent = (year, { dark: d }) => {
    const rows = students
      .map((s) => {
        const sid = String(s._id || s);
        const recs = records.filter(
          (r) => String(r.studentId) === sid && String(r.date || "").slice(0, 4) === String(year),
        );
        const present = recs.filter((r) => r.status === "Present").length;
        const absent = recs.filter((r) => r.status === "Absent").length;
        const missed = recs.filter((r) => r.status === "Missed").length;
        const held = present + absent + missed;
        return {
          id: sid,
          name: s.childName || s.fullName || s.username || "Unknown",
          present,
          absent,
          missed,
          held,
          rate: held > 0 ? Math.round((present / held) * 100) : 0,
        };
      })
      .sort((a, b) => b.rate - a.rate || b.held - a.held);

    return (
      <div style={{ marginTop: 22 }}>
        <h4 style={{ margin: "0 0 10px", fontSize: "0.9rem", fontWeight: 700, color: palette(d).text }}>
          Per-Student Attendance ({year})
        </h4>
        <StickyTable
          dark={d}
          emptyText="No students enrolled."
          columns={["Student", "Present", "Absent", "Missed", "Held", "Rate"]}
          rows={rows.map((r) => ({
            key: r.id,
            dim: r.held === 0,
            cells: [
              { v: r.name, bold: true },
              { v: r.present, color: ATT_COLORS.Present, bold: true },
              { v: r.absent, color: ATT_COLORS.Absent, bold: true },
              { v: r.missed, color: ATT_COLORS.Missed, bold: true },
              { v: r.held, color: palette(d).muted },
              { v: r.held > 0 ? `${r.rate}%` : "—", color: rateColor(r.held, r.rate), bold: true },
            ],
          }))}
        />
      </div>
    );
  };

  const shareTargets = students.map((s) => ({
    id: String(s._id || s),
    label: s.childName || s.fullName || s.username || "Student",
    child: s.childName || s.fullName || s.username || "Student",
    parent: s.fullName || "",
    phone: s.phone || "",
  }));

  return (
    <AttendanceAnalysisPanel
      records={records}
      loading={loading}
      error={error}
      dark={dark}
      emptyLabel="No attendance records for this class yet."
      renderExtra={renderPerStudent}
      exportTitle={className ? `${className} — Class Attendance` : "Class Attendance"}
      shareTargets={shareTargets}
    />
  );
};
