import { useEffect, useRef } from 'react';
import './SplashScreen.css';

/*
 * Launch animation — "burst and reassemble":
 *   1. intro    the logo and name settle in, then hold
 *   2. burst    the logo collapses to a point; a shockwave, brush streaks and
 *               paint drops fly out of the centre
 *   3. scatter  art-tool icons burst outward, rotate, and drift
 *   4. implode  the icons spiral back in, accelerating into the centre
 *   5. reform   a paint splat lands, hardens into the logo tile, the name
 *               writes itself in and a brush stroke underlines it
 *   6. loader   three paint drops pulse until the app takes over
 * Everything is transform/opacity (GPU-composited). Tap anywhere to skip.
 */

// ---------- art-tool line icons (48×48, stroke = currentColor) ----------
const ICONS = {
  palette: (
    <>
      <path d="M24 6C13 6 5 13.5 5 23c0 9.5 8 18 18 18 3 0 4-1.8 4-3.5 0-1-.5-1.8-1-2.5-.6-.8-1-1.6-1-2.5 0-2 1.6-3.5 3.5-3.5H33c5.5 0 10-4.5 10-10C43 12 34.5 6 24 6z" />
      <circle cx="14.5" cy="22" r="2.6" /><circle cx="20" cy="14" r="2.6" /><circle cx="29.5" cy="13" r="2.6" /><circle cx="36" cy="19.5" r="2.6" />
    </>
  ),
  brush: (
    <>
      <path d="M41.6 6.4a2.4 2.4 0 0 1 0 3.4L28.5 23l-3.4-3.4L38.2 6.4a2.4 2.4 0 0 1 3.4 0z" />
      <path d="M25.1 19.6l3.4 3.4-2.6 2.6-3.4-3.4z" />
      <path d="M22.5 22.2c-3.2-.4-6.3 1.2-7.3 4.6-1 3.4-2.4 6.1-7.2 8.2 6.4 2.1 12.4 0 15-3.6 1.4-2 1.9-4.2 1.8-6.4" />
      <path d="M10 41.5a1.5 1.5 0 1 0 3 0c0-1-1.5-3-1.5-3s-1.5 2-1.5 3z" />
    </>
  ),
  easel: (
    <>
      <path d="M24 3v3" />
      <rect x="9" y="6" width="30" height="21" rx="1.5" />
      <path d="M13 23l6-6 4.5 4.5 3.5-3.5L35 24" />
      <circle cx="31" cy="12" r="2.2" />
      <path d="M17 27l-5.5 17M31 27l5.5 17M24 27v15M14 36h20" />
    </>
  ),
  canvas: (
    <>
      <rect x="6" y="9" width="36" height="30" rx="2" />
      <rect x="10.5" y="13.5" width="27" height="21" rx="1" />
      <path d="M10.5 31l8-8 6 6 4-4 9 8" />
      <circle cx="30" cy="20" r="2.4" />
    </>
  ),
  pencil: (
    <>
      <path d="M33 7l8 8-23 23-10 2 2-10z" />
      <path d="M29 11l8 8M10 30l8 8M8 40l3.5-.7-2.8-2.8z" />
    </>
  ),
  paper: (
    <>
      <path d="M13 5h15l9 9v27a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
      <path d="M28 5v9h9" />
      <path d="M16 31c3-4.5 5 2 8-2s5 1.5 8.5-3M16 37h10" />
    </>
  ),
  knife: (
    <>
      <path d="M5.6 40.4l8-8 3 3-8 8a2.1 2.1 0 0 1-3-3z" />
      <path d="M16.6 35.4L20 31l2-1" />
      <path d="M21.5 29.5C25 22.5 33 11 41 7c-2 7.5-12 16.8-19.5 22.5z" />
    </>
  ),
  tube: (
    <>
      <rect x="20" y="3.5" width="8" height="5" rx="1" />
      <path d="M19 8.5h10l-1 4h-8z" />
      <path d="M16.5 12.5h15V35l-2 6.5h-11l-2-6.5z" />
      <path d="M17.5 38h13M21 20h6M21 25.5h6" />
    </>
  ),
  jar: (
    <>
      <path d="M8 17h32" />
      <path d="M10 17h28l-2.8 23.4a3 3 0 0 1-3 2.6H15.8a3 3 0 0 1-3-2.6z" />
      <path d="M15 17v6a2 2 0 0 0 4 0v-2.5M29 17v8.5a2 2 0 0 0 4 0V17" />
      <path d="M26 17l7-12.5" />
    </>
  ),
  painter: (
    <>
      <circle cx="24" cy="21" r="7" />
      <path d="M15.5 15.5c1-5 6-8.5 11-8.5 4.4 0 7.5 2 7.5 4.6 0 1.6-1.6 2.7-4.3 3.2M27 7.2l1-3" />
      <path d="M9 43c1.2-8 7.2-13 15-13s13.8 5 15 13" />
      <path d="M33 34l6-9" />
    </>
  ),
};

// angle (deg, 0 = up, clockwise), distance (× radius), spin (deg), size (px)
const LAYOUT = [
  ['palette', 328, 0.98, -18, 54],
  ['brush', 28, 0.88, 26, 48],
  ['easel', 84, 0.95, -8, 52],
  ['pencil', 128, 0.8, 34, 42],
  ['canvas', 168, 1.0, 10, 52],
  ['tube', 212, 0.82, -28, 44],
  ['knife', 252, 0.94, 22, 46],
  ['paper', 292, 0.72, -12, 42],
  ['jar', 2, 0.55, 8, 40],
  ['painter', 190, 0.46, -6, 40],
];

const PAINT = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899'];
const STREAKS = 14;
const DROPS = 18;
const NAME = 'Thevenkyart';

// Organic paint splash: an irregular blob (smooth Catmull-Rom curve through
// uneven radii) plus a few satellite drops, centred in a 200×200 box.
const SPLAT = (() => {
  const n = 40;
  const spikes = { 3: 18, 9: 11, 14: 22, 20: 9, 26: 17, 31: 12, 36: 20 };
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const r = 60 + 4 * Math.sin(4 * a + 0.5) + 3 * Math.sin(7 * a + 1.3) + (spikes[i] || 0);
    return [100 + Math.cos(a) * r, 100 + Math.sin(a) * r];
  });
  const f = (v) => v.toFixed(1);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  const drops = [[40, 92, 6], [62, 84, 3.5], [150, 94, 5.5], [200, 88, 3.5], [250, 92, 6], [300, 86, 4]].map(([deg, r, size]) => {
    const a = (deg * Math.PI) / 180;
    return [100 + Math.cos(a) * r, 100 + Math.sin(a) * r, size];
  });
  return { d: d + 'Z', drops };
})();

// Timeline (ms from mount)
const T = {
  introEnd: 260,
  collapse: 560,
  burst: 720,
  iconsIn: 1500,
  splat: 1800,
  tile: 2040,
  name: 2180,
  stroke: 2380,
  loader: 2650,
  exit: 3050,
  exitDur: 320,
};

// deterministic pseudo-random so the choreography is the same every launch
const rand = (i, salt = 1) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const polar = (deg, r) => {
  const a = (deg * Math.PI) / 180;
  return [Math.sin(a) * r, -Math.cos(a) * r];
};

const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
const EASE_IN = 'cubic-bezier(0.55, 0, 1, 0.45)';
const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

const SplashScreen = ({ onComplete }) => {
  const root = useRef(null);
  const done = useRef(onComplete);
  done.current = onComplete;

  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const anims = [];
    const timers = [];
    let finished = false;
    const $ = (s) => el.querySelector(s);
    const $$ = (s) => Array.from(el.querySelectorAll(s));
    const play = (node, frames, opts) => {
      if (!node || typeof node.animate !== 'function') return null;
      const a = node.animate(frames, { fill: 'both', ...opts });
      anims.push(a);
      return a;
    };
    const finish = () => {
      if (finished) return;
      finished = true;
      done.current?.();
    };
    const exit = () => {
      timers.forEach(clearTimeout);
      // fade the artwork, keep the dark blue to the last frame (no white flash)
      const a = play($('.sp-stage'), [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.06)', opacity: 0 }], { duration: T.exitDur, easing: EASE_IN });
      if (a) a.onfinish = finish;
      else finish();
    };

    // No Web Animations API (very old browsers / tests): show the static logo briefly
    if (typeof el.animate !== 'function') {
      el.classList.add('sp-static');
      timers.push(setTimeout(finish, 1200));
      return () => timers.forEach(clearTimeout);
    }

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const tile = $('.sp-tile');
    const letters = $$('.sp-letter');
    const sub = $('.sp-sub');

    if (reduce) {
      el.classList.add('sp-static');
      play($('.sp-brand-group'), [{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' });
      timers.push(setTimeout(exit, 1300));
    } else {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const R = Math.max(120, Math.min(w * 0.42, h * 0.3, 260));
      const k = Math.min(1.35, Math.max(1, R / 170)); // bigger icons on big screens

      // 1–2. intro, hold, collapse ... and re-emerge from the splat later
      const tileTotal = T.tile + 520;
      play(tile, [
        { offset: 0, transform: 'scale(0.86)', opacity: 0, easing: EASE_OUT },
        { offset: T.introEnd / tileTotal, transform: 'scale(1)', opacity: 1 },
        { offset: T.collapse / tileTotal, transform: 'scale(1)', opacity: 1, easing: EASE_IN },
        { offset: T.burst / tileTotal, transform: 'scale(0) rotate(-25deg)', opacity: 0 },
        { offset: T.tile / tileTotal, transform: 'scale(0.55) rotate(-12deg)', opacity: 0, easing: SPRING },
        { offset: 1, transform: 'scale(1) rotate(0deg)', opacity: 1 },
      ], { duration: tileTotal });

      // name: collapse from the middle outwards, then write back in left → right
      const mid = (letters.length - 1) / 2;
      const nameTotal = T.name + 40 * letters.length + 520;
      letters.forEach((l, i) => {
        const outAt = T.collapse - 60 + (mid - Math.abs(i - mid)) * -14 + 70;
        const inAt = T.name + i * 40;
        play(l, [
          { offset: 0, opacity: 0, transform: 'translateY(8px)', easing: EASE_OUT },
          { offset: T.introEnd / nameTotal, opacity: 1, transform: 'translateY(0)' },
          { offset: outAt / nameTotal, opacity: 1, transform: 'translateY(0) scale(1)', easing: EASE_IN },
          { offset: (outAt + 150) / nameTotal, opacity: 0, transform: 'translateY(-6px) scale(0.6)' },
          { offset: inAt / nameTotal, opacity: 0, transform: 'translateY(16px) scale(1)', easing: EASE_OUT },
          { offset: (inAt + 520) / nameTotal, opacity: 1, transform: 'translateY(0) scale(1)' },
          { offset: 1, opacity: 1, transform: 'translateY(0) scale(1)' },
        ], { duration: nameTotal });
      });
      const subTotal = T.name + 900;
      play(sub, [
        { offset: 0, opacity: 0, transform: 'translateY(6px)', easing: EASE_OUT },
        { offset: T.introEnd / subTotal, opacity: 1, transform: 'translateY(0)' },
        { offset: T.collapse / subTotal, opacity: 1, transform: 'translateY(0)', easing: EASE_IN },
        { offset: (T.collapse + 140) / subTotal, opacity: 0, transform: 'translateY(4px)' },
        { offset: (T.name + 300) / subTotal, opacity: 0, transform: 'translateY(8px)', easing: EASE_OUT },
        { offset: 1, opacity: 1, transform: 'translateY(0)' },
      ], { duration: subTotal });

      // burst: flash + shockwave rings
      play($('.sp-flash'), [
        { transform: 'scale(0.2)', opacity: 0 },
        { transform: 'scale(1)', opacity: 0.9, offset: 0.25 },
        { transform: 'scale(1.6)', opacity: 0 },
      ], { duration: 420, delay: T.burst - 60, easing: 'ease-out' });
      $$('.sp-ring').forEach((r, i) => play(r, [
        { transform: 'scale(0.1)', opacity: 0.7 },
        { transform: `scale(${(R * (1.5 + i * 0.6)) / 50})`, opacity: 0 },
      ], { duration: 700 + i * 200, delay: T.burst - 20 + i * 90, easing: EASE_OUT }));

      // brush streaks radiating out
      $$('.sp-streak').forEach((s, i) => {
        const ang = (360 / STREAKS) * i + rand(i, 2) * 14;
        const len = 0.6 + rand(i, 3) * 0.5;
        play(s, [
          { transform: `rotate(${ang}deg) translateY(-${R * 0.12}px) scaleY(0.2)`, opacity: 0 },
          { transform: `rotate(${ang}deg) translateY(-${R * 0.45}px) scaleY(1)`, opacity: 1, offset: 0.3 },
          { transform: `rotate(${ang}deg) translateY(-${R * (0.95 + len * 0.4)}px) scaleY(0.25)`, opacity: 0 },
        ], { duration: 620 + rand(i, 4) * 160, delay: T.burst + rand(i, 5) * 70, easing: EASE_OUT });
      });

      // paint drops: fling out, float, fade
      $$('.sp-drop').forEach((d, i) => {
        const ang = rand(i, 6) * 360;
        const dist = R * (0.45 + rand(i, 7) * 0.75);
        const [x, y] = polar(ang, dist);
        const [x2, y2] = polar(ang + 8, dist * 1.12);
        play(d, [
          { transform: 'translate(0,0) scale(0)', opacity: 0, easing: EASE_OUT },
          { transform: `translate(${x}px,${y}px) scale(1)`, opacity: 1, offset: 0.4 },
          { transform: `translate(${x2}px,${y2 + 14}px) scale(0.6)`, opacity: 0 },
        ], { duration: 1100 + rand(i, 8) * 500, delay: T.burst + 30 + rand(i, 9) * 120 });
      });

      // 3–4. icons: burst out, drift, spiral back in (accelerating)
      $$('.sp-icon').forEach((ic, i) => {
        const [, ang, dist, spin] = LAYOUT[i];
        const r = R * dist;
        const stagger = rand(i, 10) * 90;
        const start = T.burst + 10 + stagger * 0.6;
        const end = T.iconsIn + 330 + stagger;
        const total = end - start;
        const at = (t) => Math.min(1, Math.max(0, (t - start) / total));
        const P = (a, rr, rot, sc) => {
          const [x, y] = polar(a, rr);
          return `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${rot}deg) scale(${(sc * k).toFixed(3)})`;
        };
        play(ic, [
          { offset: 0, transform: P(ang, 0, 0, 0.25), easing: EASE_OUT },
          { offset: at(T.burst + 470), transform: P(ang, r, spin, 1) },
          { offset: at(T.iconsIn - 20), transform: P(ang + 7, r * 1.1, spin * 1.35, 1.04) },
          { offset: at(T.iconsIn + 120), transform: P(ang + 30, r * 0.74, spin * 1.8, 0.86) },
          { offset: at(T.iconsIn + 210), transform: P(ang + 55, r * 0.42, spin * 2.3 + 40, 0.62) },
          { offset: at(T.iconsIn + 270), transform: P(ang + 75, r * 0.16, spin * 2.8 + 90, 0.38) },
          { offset: 1, transform: P(ang + 90, 0, spin * 3 + 140, 0.12) },
        ], { duration: total, delay: start });
        play(ic, [
          { opacity: 0 },
          { opacity: 1, offset: 0.06 },
          { opacity: 1, offset: 0.88 },
          { opacity: 0 },
        ], { duration: total, delay: start, composite: 'replace' });
      });

      // 5. paint splat lands, then hardens into the tile
      play($('.sp-splat'), [
        { offset: 0, transform: 'scale(0) rotate(-40deg)', opacity: 0, easing: SPRING },
        { offset: 0.42, transform: 'scale(1.12) rotate(4deg)', opacity: 1, easing: 'ease-in-out' },
        { offset: 0.62, transform: 'scale(0.96) rotate(0deg)', opacity: 1, easing: EASE_IN },
        { offset: 1, transform: 'scale(0.62) rotate(-6deg)', opacity: 0 },
      ], { duration: T.tile + 180 - T.splat, delay: T.splat });
      $$('.sp-spatter').forEach((s, i) => {
        const ang = 20 + i * (360 / 7) + rand(i, 11) * 20;
        const [x, y] = polar(ang, 62 + rand(i, 12) * 26);
        play(s, [
          { transform: 'translate(0,0) scale(0)', opacity: 0, easing: EASE_OUT },
          { transform: `translate(${x}px,${y}px) scale(1)`, opacity: 1, offset: 0.35 },
          { transform: `translate(${x * 1.15}px,${y * 1.15}px) scale(0)`, opacity: 0 },
        ], { duration: 650, delay: T.splat + 40 + i * 12 });
      });
      play($('.sp-glow'), [
        { opacity: 0, transform: 'scale(0.6)' },
        { opacity: 1, transform: 'scale(1)' },
      ], { duration: 700, delay: T.tile - 100, easing: EASE_OUT });

      // brush stroke under the name draws itself
      const stroke = $('.sp-stroke path');
      if (stroke) {
        const len = stroke.getTotalLength ? stroke.getTotalLength() : 220;
        stroke.style.strokeDasharray = `${len}`;
        play(stroke, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 520, delay: T.stroke, easing: EASE_OUT });
      }

      // 6. loader
      play($('.sp-loader'), [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 300, delay: T.loader, easing: EASE_OUT });

      timers.push(setTimeout(exit, T.exit));
    }

    const skip = () => { if (!finished) exit(); };
    el.addEventListener('pointerdown', skip);
    return () => {
      el.removeEventListener('pointerdown', skip);
      timers.forEach(clearTimeout);
      anims.forEach((a) => { a.onfinish = null; a.cancel(); });
    };
  }, []);

  return (
    <div ref={root} className="splash-container" role="img" aria-label="Thevenkyart Art Academy">
      <div className="sp-bg" aria-hidden="true" />
      <div className="sp-stage" aria-hidden="true">
        <div className="sp-fx">
          <div className="sp-flash" />
          <div className="sp-ring" /><div className="sp-ring" />
          {Array.from({ length: STREAKS }, (_, i) => <span key={`s${i}`} className="sp-streak" />)}
          {Array.from({ length: DROPS }, (_, i) => (
            <span key={`d${i}`} className="sp-drop" style={{ background: PAINT[i % PAINT.length], width: 4 + Math.round(rand(i, 13) * 6), height: 4 + Math.round(rand(i, 13) * 6) }} />
          ))}
          {LAYOUT.map(([name, , , , size]) => (
            <svg key={name} className="sp-icon" width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: -size / 2, marginTop: -size / 2 }}>
              {ICONS[name]}
            </svg>
          ))}
          <svg className="sp-splat" viewBox="0 0 200 200" width="150" height="150">
            <defs>
              <linearGradient id="spPaint" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#3b82f6" /><stop offset="1" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
            <path fill="url(#spPaint)" d={SPLAT.d} />
            {SPLAT.drops.map(([cx, cy, r]) => <circle key={`${cx}`} cx={cx} cy={cy} r={r} fill="url(#spPaint)" />)}
          </svg>
          {Array.from({ length: 7 }, (_, i) => <span key={`p${i}`} className="sp-spatter" style={{ background: i % 2 ? '#7c3aed' : '#3b82f6' }} />)}
        </div>

        <div className="sp-brand-group">
          <div className="sp-logo">
            <div className="sp-glow" />
            <div className="sp-tile"><img src="/new-logo1.png" alt="" className="sp-logo-img" /></div>
          </div>
          <div className="sp-brand">
            <span className="sp-name">
              {NAME.split('').map((ch, i) => <span key={i} className="sp-letter">{ch}</span>)}
            </span>
            <svg className="sp-stroke" viewBox="0 0 220 16" preserveAspectRatio="none">
              <defs>
                <linearGradient id="spStroke" x1="0" x2="1">
                  <stop offset="0" stopColor="#3b82f6" /><stop offset="0.55" stopColor="#8b5cf6" /><stop offset="1" stopColor="#f59e0b" />
                </linearGradient>
              </defs>
              <path d="M6 10c30-6 62-7 96-4.5 32 2.3 72 3 112-3.5" fill="none" stroke="url(#spStroke)" strokeWidth="4" strokeLinecap="round" />
            </svg>
            <span className="sp-sub">Art Academy</span>
          </div>
          <div className="sp-loader"><i /><i /><i /></div>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
