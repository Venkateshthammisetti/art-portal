// Shared artwork viewer + gallery thumbnail, used by the Admin, Teacher and
// Parent galleries.
//
// ArtworkViewer — full-screen, photo-app style:
//   • swipe left/right: the artwork follows the finger and glides to the next one
//   • swipe down: dismiss
//   • pinch or double-tap: zoom (anchored where you touch); drag to pan when zoomed
//   • single tap: hide / show the controls
//   • keyboard: ← → move, Esc closes, + / − / 0 zoom
//   • the small grid thumbnail shows instantly, the sharp copy fades in over it,
//     and neighbouring artworks are loaded ahead of time.
// The caller owns the list and the open index; actions (download, share,
// delete…) are passed in through renderActions, so each role keeps its own.
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./ArtworkViewer.css";
import { cldUrl, THUMB_WIDTH, VIEW_WIDTH } from "../cloudinaryImage";
import { IconX, IconChevronLeft, IconChevronRight, IconZoomIn, IconZoomOut } from "./Icons";

const MAX_ZOOM = 5;
const DOUBLE_TAP_ZOOM = 2.5;
const DOUBLE_TAP_MS = 260;

const formatArtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// ---------------------------------------------------------------------------
// Grid thumbnail: small Cloudinary copy, lazy-loaded, fades in when ready.
// Falls back to the original image if the resized copy can't be loaded.
// ---------------------------------------------------------------------------
export const ArtThumb = ({ src, alt, className = "", style }) => {
  const [useOriginal, setUseOriginal] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      src={useOriginal ? src : cldUrl(src, THUMB_WIDTH)}
      alt={alt || "Artwork"}
      loading="lazy"
      decoding="async"
      draggable="false"
      className={`${className} av-thumb${loaded ? " is-loaded" : ""}`}
      style={style}
      onLoad={() => setLoaded(true)}
      onError={() => (useOriginal ? setLoaded(true) : setUseOriginal(true))}
    />
  );
};

// ---------------------------------------------------------------------------
// Render a long grid in batches: the first `step` tiles, then more as the user
// scrolls near the end (via <GridSentinel>). Starts over when the list changes
// (e.g. a filter), so switching filters is instant even with 1,000+ artworks.
// ---------------------------------------------------------------------------
export const useIncrementalList = (items, step = 48) => {
  const resetKey = `${items.length}:${items[0]?._id || ""}`;
  const [count, setCount] = useState(step);
  useEffect(() => setCount(step), [resetKey, step]);
  return {
    visible: items.slice(0, count),
    hasMore: count < items.length,
    showMore: () => setCount((c) => c + step),
  };
};

export const GridSentinel = ({ onVisible }) => {
  const ref = useRef(null);
  const cb = useRef(onVisible);
  cb.current = onVisible;
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      cb.current();
      return undefined;
    }
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && cb.current(), {
      rootMargin: "900px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className="av-grid-sentinel" aria-hidden="true" />;
};

// One slide: thumbnail underneath (already cached from the grid), sharp copy on top.
const Slide = ({ art, active, zoom, zoomRef }) => {
  const [fullSrc, setFullSrc] = useState(() => cldUrl(art.imageUrl, VIEW_WIDTH));
  const [fullLoaded, setFullLoaded] = useState(false);
  const [thumbGone, setThumbGone] = useState(false); // removed after the sharp copy has faded in
  const onFullReady = () => {
    setFullLoaded(true);
    setTimeout(() => setThumbGone(true), 320);
  };
  return (
    <div className="av-slide-inner">
      <div
        ref={active ? zoomRef : undefined}
        className="av-zoom"
        style={
          active
            ? { transform: `translate3d(${zoom.x}px, ${zoom.y}px, 0) scale(${zoom.s})` }
            : undefined
        }
      >
        {!thumbGone && (
        <img
          className="av-img av-img-thumb"
          src={cldUrl(art.imageUrl, THUMB_WIDTH)}
          alt=""
          aria-hidden="true"
          draggable="false"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
        )}
        <img
          className={`av-img av-img-full${fullLoaded ? " is-loaded" : ""}`}
          src={fullSrc}
          alt={art.title || "Artwork"}
          draggable="false"
          decoding="async"
          onLoad={onFullReady}
          onError={() => {
            if (fullSrc !== art.imageUrl) setFullSrc(art.imageUrl);
            else onFullReady();
          }}
        />
        {!fullLoaded && <span className="av-spinner" aria-hidden="true" />}
      </div>
    </div>
  );
};

export const ArtworkViewer = ({
  items,
  index,
  onIndexChange,
  onClose,
  renderActions,
  showStudent = false,
}) => {
  const stageRef = useRef(null);
  const trackRef = useRef(null);
  const backdropRef = useRef(null);
  const zoomRef = useRef(null);
  const closeBtnRef = useRef(null);

  const [zoom, setZoom] = useState({ s: 1, x: 0, y: 0 });
  const zoomStateRef = useRef(zoom);
  zoomStateRef.current = zoom;
  const [chrome, setChrome] = useState(true);

  const count = items.length;
  const art = items[index];
  const hasPrev = index > 0;
  const hasNext = index < count - 1;

  // ---- track position (written straight to the DOM so drags stay at 60fps) ----
  const applyTrack = (i, dx = 0, animate = true) => {
    const el = trackRef.current;
    if (!el) return;
    el.style.transition = animate && !prefersReducedMotion() ? "transform 0.32s cubic-bezier(0.22, 0.8, 0.2, 1)" : "none";
    el.style.transform = `translate3d(calc(${-i * 100}% + ${dx}px), 0, 0)`;
  };
  const firstLayout = useRef(true);
  useLayoutEffect(() => {
    applyTrack(index, 0, !firstLayout.current);
    firstLayout.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // iOS Safari: stop its own page pinch-zoom so the viewer's pinch wins
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const block = (e) => e.preventDefault();
    stage.addEventListener("gesturestart", block, { passive: false });
    stage.addEventListener("gesturechange", block, { passive: false });
    return () => {
      stage.removeEventListener("gesturestart", block);
      stage.removeEventListener("gesturechange", block);
    };
  }, []);

  // New artwork: reset zoom
  useEffect(() => {
    setZoom({ s: 1, x: 0, y: 0 });
  }, [index]);

  // List shrank (e.g. an artwork was deleted from inside the viewer)
  useEffect(() => {
    if (count === 0) onClose();
    else if (index > count - 1) onIndexChange(count - 1);
  }, [count, index, onClose, onIndexChange]);

  // Preload the artworks two steps away (±1 are rendered, so already loading)
  useEffect(() => {
    [index - 2, index + 2].forEach((i) => {
      if (items[i]) {
        const img = new Image();
        img.src = cldUrl(items[i].imageUrl, VIEW_WIDTH);
      }
    });
  }, [index, items]);

  const go = (dir) => {
    const next = index + dir;
    if (next < 0 || next > count - 1) {
      applyTrack(index, 0, true); // nothing there — spring back
      return;
    }
    onIndexChange(next);
  };

  // ---- focus, keyboard ----
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    closeBtnRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "+" || e.key === "=") zoomBy(1);
      else if (e.key === "-") zoomBy(-1);
      else if (e.key === "0") setZoom({ s: 1, x: 0, y: 0 });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  // ---- zoom helpers ----
  const clampPan = (s, x, y) => {
    const stage = stageRef.current;
    if (!stage || s <= 1) return { s: Math.max(1, s), x: 0, y: 0 };
    const maxX = ((s - 1) * stage.clientWidth) / 2;
    const maxY = ((s - 1) * stage.clientHeight) / 2;
    return { s, x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  };
  // Point (client coords) relative to the stage centre
  const fromCentre = (cx, cy) => {
    const r = stageRef.current.getBoundingClientRect();
    return { px: cx - (r.left + r.width / 2), py: cy - (r.top + r.height / 2) };
  };
  const zoomBy = (dir) => {
    setZoom((z) => {
      const s = Math.min(MAX_ZOOM, Math.max(1, z.s + dir * 0.75));
      return clampPan(s, (z.x * s) / z.s, (z.y * s) / z.s);
    });
  };

  // ---- gestures ----
  const g = useRef({});
  const lastTap = useRef({ t: 0, x: 0, y: 0 });
  const tapTimer = useRef(null);
  const lastTouchEnd = useRef(0);

  const setDismiss = (dy, animate) => {
    const t = animate && !prefersReducedMotion() ? "transform 0.25s ease, opacity 0.25s ease" : "none";
    if (zoomRef.current) {
      zoomRef.current.style.transition = t;
      zoomRef.current.style.transform = dy
        ? `translate3d(0, ${dy}px, 0) scale(${Math.max(0.85, 1 - Math.abs(dy) / 1500)})`
        : "";
    }
    if (backdropRef.current) {
      backdropRef.current.style.transition = t;
      backdropRef.current.style.opacity = String(Math.max(0.25, 1 - Math.abs(dy) / 450));
    }
  };

  const onTouchStart = (e) => {
    const z = zoomStateRef.current;
    if (e.touches.length === 2) {
      const [a, b] = e.touches;
      const m = fromCentre((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
      g.current = {
        mode: "pinch",
        d0: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        z0: z,
        m,
      };
      return;
    }
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    g.current = {
      mode: z.s > 1 ? "pan" : "pending",
      x0: t.clientX,
      y0: t.clientY,
      t0: Date.now(),
      z0: z,
      dx: 0,
      dy: 0,
      moved: false,
    };
  };

  const onTouchMove = (e) => {
    const s = g.current;
    if (!s.mode) return;
    if (s.mode === "pinch" && e.touches.length === 2) {
      const [a, b] = e.touches;
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const scale = Math.min(MAX_ZOOM, Math.max(1, s.z0.s * (d / s.d0)));
      const ratio = scale / s.z0.s;
      // keep the point between the fingers where it is
      setZoom(clampPan(scale, s.m.px - (s.m.px - s.z0.x) * ratio, s.m.py - (s.m.py - s.z0.y) * ratio));
      return;
    }
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x0;
    const dy = t.clientY - s.y0;
    s.dx = dx;
    s.dy = dy;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) s.moved = true;

    if (s.mode === "pan") {
      setZoom(clampPan(s.z0.s, s.z0.x + dx, s.z0.y + dy));
      return;
    }
    if (s.mode === "pending" && s.moved) {
      s.mode = Math.abs(dx) >= Math.abs(dy) ? "swipe" : dy > 0 ? "dismiss" : "none";
    }
    if (s.mode === "swipe") {
      // resist at the ends
      const edge = (dx > 0 && !hasPrev) || (dx < 0 && !hasNext);
      applyTrack(index, edge ? dx / 3 : dx, false);
    } else if (s.mode === "dismiss") {
      setDismiss(Math.max(0, dy), false);
    }
  };

  const onTouchEnd = (e) => {
    const s = g.current;
    lastTouchEnd.current = Date.now();
    if (s.mode === "pinch") {
      if (e.touches.length === 0) g.current = {};
      return;
    }
    const dt = Math.max(1, Date.now() - (s.t0 || 0));
    if (s.mode === "swipe") {
      const width = stageRef.current?.clientWidth || window.innerWidth;
      const fast = Math.abs(s.dx) / dt > 0.45;
      if ((Math.abs(s.dx) > width * 0.18 || fast) && Math.abs(s.dx) > 20) go(s.dx < 0 ? 1 : -1);
      else applyTrack(index, 0, true);
    } else if (s.mode === "dismiss") {
      if (s.dy > 110 || s.dy / dt > 0.5) onClose();
      else setDismiss(0, true);
    } else if (!s.moved && e.changedTouches?.length) {
      handleTap(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    }
    g.current = {};
  };

  // Double tap = zoom at that point; single tap (after a short wait) = toggle controls
  const handleTap = (cx, cy) => {
    const now = Date.now();
    const prev = lastTap.current;
    if (now - prev.t < DOUBLE_TAP_MS && Math.hypot(cx - prev.x, cy - prev.y) < 40) {
      clearTimeout(tapTimer.current);
      lastTap.current = { t: 0, x: 0, y: 0 };
      const z = zoomStateRef.current;
      if (z.s > 1) setZoom({ s: 1, x: 0, y: 0 });
      else {
        const { px, py } = fromCentre(cx, cy);
        setZoom(clampPan(DOUBLE_TAP_ZOOM, px * (1 - DOUBLE_TAP_ZOOM), py * (1 - DOUBLE_TAP_ZOOM)));
      }
      return;
    }
    lastTap.current = { t: now, x: cx, y: cy };
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => setChrome((c) => !c), DOUBLE_TAP_MS);
  };
  useEffect(() => () => clearTimeout(tapTimer.current), []);

  // Mouse: click outside the artwork closes; double-click zooms
  const onStageClick = (e) => {
    if (Date.now() - lastTouchEnd.current < 600) return; // the click that follows a tap
    if (e.target.classList.contains("av-img")) return;
    onClose();
  };
  const onStageDoubleClick = (e) => {
    if (Date.now() - lastTouchEnd.current < 600) return;
    const z = zoomStateRef.current;
    if (z.s > 1) setZoom({ s: 1, x: 0, y: 0 });
    else {
      const { px, py } = fromCentre(e.clientX, e.clientY);
      setZoom(clampPan(DOUBLE_TAP_ZOOM, px * (1 - DOUBLE_TAP_ZOOM), py * (1 - DOUBLE_TAP_ZOOM)));
    }
  };

  if (!art) return null;

  // Only the current artwork and its neighbours are rendered with images.
  const slides = items.map((it, i) => {
    const near = Math.abs(i - index) <= 1;
    return (
      <div key={it._id || i} className="av-slide" style={{ left: `${i * 100}%` }} aria-hidden={i !== index}>
        {near && (
          <Slide
            art={it}
            active={i === index}
            zoom={i === index ? zoom : { s: 1, x: 0, y: 0 }}
            zoomRef={zoomRef}
          />
        )}
      </div>
    );
  });

  return createPortal(
    <div
      className={`av-root${chrome ? "" : " av-chrome-hidden"}${zoom.s > 1 ? " is-zoomed" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Artwork viewer"
    >
      <div ref={backdropRef} className="av-backdrop" />

      <div
        ref={stageRef}
        className="av-stage"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onClick={onStageClick}
        onDoubleClick={onStageDoubleClick}
      >
        <div ref={trackRef} className="av-track">
          {slides}
        </div>
      </div>

      <div className="av-topbar">
        <span className="av-counter" aria-live="polite">
          {index + 1} / {count}
        </span>
        <div className="av-topbar-actions">
          <button type="button" className="av-icon-btn av-zoom-btn" onClick={() => zoomBy(-1)} disabled={zoom.s <= 1} aria-label="Zoom out">
            <IconZoomOut size={20} />
          </button>
          <button type="button" className="av-icon-btn av-zoom-btn" onClick={() => zoomBy(1)} disabled={zoom.s >= MAX_ZOOM} aria-label="Zoom in">
            <IconZoomIn size={20} />
          </button>
          <button ref={closeBtnRef} type="button" className="av-icon-btn" onClick={onClose} aria-label="Close viewer">
            <IconX size={22} />
          </button>
        </div>
      </div>

      {hasPrev && (
        <button type="button" className="av-nav av-nav-prev" onClick={() => go(-1)} aria-label="Previous artwork">
          <IconChevronLeft size={28} />
        </button>
      )}
      {hasNext && (
        <button type="button" className="av-nav av-nav-next" onClick={() => go(1)} aria-label="Next artwork">
          <IconChevronRight size={28} />
        </button>
      )}

      <div className="av-bottombar">
        <div className="av-caption">
          {showStudent && art.studentId?.childName && <p className="av-caption-student">{art.studentId.childName}</p>}
          <p className="av-caption-title">{art.title || "Untitled"}</p>
          <p className="av-caption-sub">
            {[art.medium, formatArtDate(art.dateCreated)].filter(Boolean).join(" · ")}
          </p>
        </div>
        {renderActions && <div className="av-actions">{renderActions(art)}</div>}
      </div>
    </div>,
    document.body,
  );
};

export default ArtworkViewer;
