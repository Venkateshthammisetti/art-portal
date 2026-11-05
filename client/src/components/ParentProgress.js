// Parent "progress" views: report ratings over time, attendance calendar and
// streak, and the gallery's first-vs-latest strip.
import React, { useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ymLabel = (ym, long = false) => {
  const [y, m] = String(ym || "").split("-").map(Number);
  if (!y || !m) return ym || "";
  return long ? new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" }) : `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`;
};

// ---------- report ratings over time ----------
export const RatingTrend = ({ reports, dark }) => {
  const data = useMemo(() => {
    const byMonth = new Map();
    (reports || []).forEach((r) => {
      const rating = Number(r.rating);
      if (!r.month || !rating) return;
      byMonth.set(r.month, rating); // one report per month; latest wins
    });
    return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, rating]) => ({ month, label: ymLabel(month), rating }));
  }, [reports]);

  if (data.length < 2) return null;
  const avg = data.reduce((s, d) => s + d.rating, 0) / data.length;
  const first = data[0].rating;
  const last = data[data.length - 1].rating;
  const trend = last > first ? "up" : last < first ? "down" : "steady";
  const stroke = dark ? "#93c5fd" : "#2563eb";
  const grid = dark ? "#334155" : "#e2e8f0";
  const tick = dark ? "#94a3b8" : "#64748b";

  return (
    <div className="pp-card rating-trend">
      <div className="pp-card-head">
        <div>
          <h4>Progress over time</h4>
          <p>Teacher's monthly rating, last {data.length} reports</p>
        </div>
        <div className="pp-stats">
          <span><strong>{avg.toFixed(1)}</strong> average</span>
          <span className={`pp-trend ${trend}`}>
            {trend === "up" ? `Up from ${first} to ${last}` : trend === "down" ? `Down from ${first} to ${last}` : `Steady at ${last}`}
          </span>
        </div>
      </div>
      <div className="pp-chart" role="img" aria-label={`Ratings from ${ymLabel(data[0].month, true)} to ${ymLabel(data[data.length - 1].month, true)}: ${data.map((d) => d.rating).join(", ")} out of 5`}>
        <ResponsiveContainer width="100%" height={170}>
          <LineChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -24 }}>
            <CartesianGrid stroke={grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: tick, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fill: tick, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => [`${v} / 5`, "Rating"]} labelFormatter={(_, p) => (p?.[0] ? ymLabel(p[0].payload.month, true) : "")} />
            <Line type="monotone" dataKey="rating" stroke={stroke} strokeWidth={2.5} dot={{ r: 4, fill: stroke }} activeDot={{ r: 6 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ---------- attendance ----------
const dayKey = (d) => String(d || "").slice(0, 10);

// Classes attended in a row, counting back from the most recent class
// (days without a class don't break the streak).
export const attendanceStreak = (records) => {
  const sorted = [...(records || [])].filter((r) => r.date && r.status).sort((a, b) => dayKey(b.date).localeCompare(dayKey(a.date)));
  let n = 0;
  for (const r of sorted) {
    if (r.status === "Present") n++;
    else break;
  }
  return n;
};

export const bestStreak = (records) => {
  const sorted = [...(records || [])].filter((r) => r.date && r.status).sort((a, b) => dayKey(a.date).localeCompare(dayKey(b.date)));
  let best = 0, cur = 0;
  sorted.forEach((r) => { cur = r.status === "Present" ? cur + 1 : 0; best = Math.max(best, cur); });
  return best;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const AttendanceCalendar = ({ month, records }) => {
  const [y, m] = month.split("-").map(Number);
  const byDay = useMemo(() => {
    const map = new Map();
    (records || []).forEach((r) => { if (dayKey(r.date).startsWith(month)) map.set(Number(dayKey(r.date).slice(8, 10)), r.status); });
    return map;
  }, [records, month]);
  const daysInMonth = new Date(y, m, 0).getDate();
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Monday first
  const todayKey = new Date().toISOString().slice(0, 10);
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const label = { Present: "Attended", Absent: "Absent", Missed: "Missed" };

  return (
    <div className="pp-card att-calendar">
      <div className="ac-grid" role="grid" aria-label={`Attendance calendar, ${ymLabel(month, true)}`}>
        {WEEKDAYS.map((d) => <span key={d} className="ac-wd" aria-hidden="true">{d.charAt(0)}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} className="ac-cell empty" aria-hidden="true" />;
          const status = byDay.get(d);
          const key = `${month}-${String(d).padStart(2, "0")}`;
          return (
            <span key={key} role="gridcell" className={`ac-cell${status ? ` ${status.toLowerCase()}` : ""}${key === todayKey ? " today" : ""}`}
              aria-label={`${d} ${ymLabel(month, true)}${status ? `: ${label[status] || status}` : ""}`}>
              {d}
            </span>
          );
        })}
      </div>
      <div className="ac-legend" aria-hidden="true">
        <span><i className="present" /> Attended</span>
        <span><i className="absent" /> Absent</span>
        <span><i className="missed" /> Missed</span>
      </div>
    </div>
  );
};

// ---------- gallery: first vs latest ----------
const artDate = (a) => a.dateCreated || a.createdAt;
export const GalleryProgress = ({ artwork, onOpen }) => {
  const info = useMemo(() => {
    const list = [...(artwork || [])].filter((a) => a.imageUrl && artDate(a)).sort((a, b) => String(artDate(a)).localeCompare(String(artDate(b))));
    if (list.length === 0) return null;
    const nowKey = new Date().toISOString().slice(0, 7);
    const thisMonth = list.filter((a) => String(artDate(a)).slice(0, 7) === nowKey).length;
    const media = new Map();
    list.forEach((a) => { if (a.medium) media.set(a.medium, (media.get(a.medium) || 0) + 1); });
    const topMedia = [...media.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    return { first: list[0], latest: list[list.length - 1], total: list.length, thisMonth, topMedia };
  }, [artwork]);
  if (!info) return null;
  const fmt = (a) => new Date(artDate(a)).toLocaleDateString("en-GB", { month: "short", year: "numeric" });

  return (
    <div className="pp-card gallery-progress">
      <div className="gp-stats">
        <div><strong>{info.total}</strong><span>artworks</span></div>
        <div><strong>{info.thisMonth}</strong><span>this month</span></div>
        {info.topMedia.length > 0 && (
          <div className="gp-media">
            <span>Favourite media</span>
            <ul>{info.topMedia.map(([m, n]) => <li key={m}>{m} <em>{n}</em></li>)}</ul>
          </div>
        )}
      </div>
      {info.total >= 2 && info.first._id !== info.latest._id && (
        <div className="gp-compare">
          {[["First artwork", info.first], ["Latest", info.latest]].map(([label, a]) => (
            <button key={label} type="button" className="gp-shot" onClick={() => onOpen(a)}>
              <img src={a.imageUrl} alt={`${label}: ${a.title || "Artwork"}`} loading="lazy" />
              <span><strong>{label}</strong> {fmt(a)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
