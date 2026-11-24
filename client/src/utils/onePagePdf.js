// Report Maker: the monthly report is always one A4 page.
// - The preview is always laid out as an A4 page (210 mm wide), on phones too,
//   and shown scaled down to fit the screen (usePageFit).
// - The PDF is captured with the desktop layout, and if the report is longer
//   than one page it is shrunk to fit on a single page instead of spilling
//   onto a second one (makeOnePagePdf).
import { useEffect, useState } from "react";

const MM = 96 / 25.4; // CSS px per mm
export const A4_W_PX = 210 * MM; // ≈ 794
export const A4_H_PX = 297 * MM; // ≈ 1123

// How much the page has to shrink to fit one A4 page (1 = fits as it is)
export const fitRatio = (heightPx) => (heightPx > A4_H_PX + 1 ? A4_H_PX / heightPx : 1);

// Build the PDF with html2pdf (loaded from the CDN) and keep it to one page.
// Returns the jsPDF document: .save(name) or .output("blob").
export const makeOnePagePdf = async (html2pdf, element, opt) => {
  const worker = html2pdf()
    .set({ ...opt, html2canvas: { ...(opt.html2canvas || {}), windowWidth: 1280 } })
    .from(element)
    .toPdf();
  const pdf = await worker.get("pdf");
  const pages = pdf.getNumberOfPages();
  if (pages <= 1) return pdf;

  const canvas = await worker.get("canvas");
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const fullH = (canvas.height / canvas.width) * pageW;
  const h = Math.min(pageH, fullH);
  const w = h === fullH ? pageW : (canvas.width / canvas.height) * pageH;

  // Replace every page with one page holding the whole report, shrunk to fit
  pdf.addPage();
  for (let i = pages; i >= 1; i--) pdf.deletePage(i);
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", (pageW - w) / 2, 0, w, h);
  return pdf;
};

// Scale the A4 preview down to the space available, and report its length.
export const usePageFit = (panelRef, pageRef, deps = []) => {
  const [fit, setFit] = useState({ scale: 1, height: A4_H_PX });
  useEffect(() => {
    const panel = panelRef.current;
    const page = pageRef.current;
    if (!panel || !page) return undefined;
    const measure = () => {
      const cs = window.getComputedStyle(panel);
      const room = panel.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
      const scale = room > 0 ? Math.min(1, room / A4_W_PX) : 1;
      const height = page.offsetHeight || A4_H_PX;
      setFit((f) => (Math.abs(f.scale - scale) < 0.001 && Math.abs(f.height - height) < 1 ? f : { scale, height }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(panel);
    ro.observe(page);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return fit;
};
