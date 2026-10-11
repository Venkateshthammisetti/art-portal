import { useEffect } from "react";

// On phones, `.custom-table` rows are restyled as stacked cards (see
// AdminDashboard.css). Each cell shows its column name through
// `td::before { content: attr(data-label) }`, so this hook copies the
// <thead> header text onto every body cell as `data-label` — including
// rows that React renders later (tab switches, filters, fetches).
const SELECTOR = "table.custom-table";

const labelTable = (table) => {
  const headRow = table.tHead && table.tHead.rows[0];
  if (!headRow) return;

  // Expand header colSpans so cell index → header text stays aligned
  const labels = [];
  Array.from(headRow.cells).forEach((th) => {
    const text = th.textContent.trim();
    for (let i = 0; i < (th.colSpan || 1); i++) labels.push(text);
  });

  Array.from(table.tBodies).forEach((tbody) => {
    Array.from(tbody.rows).forEach((row) => {
      let col = 0;
      Array.from(row.cells).forEach((cell) => {
        const label = labels[col] || "";
        if (cell.getAttribute("data-label") !== label) cell.setAttribute("data-label", label);
        col += cell.colSpan || 1;
      });
    });
  });
};

const labelAll = () => document.querySelectorAll(SELECTOR).forEach(labelTable);

export const useMobileTableLabels = () => {
  useEffect(() => {
    if (typeof MutationObserver === "undefined") return undefined;
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        labelAll();
      });
    };
    labelAll();
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      mo.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
};
