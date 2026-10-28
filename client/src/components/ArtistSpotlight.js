// Posters — admin-published Artist Spotlights, festival greetings and announcements.
// Admin-only: SpotlightPublishTab (form) and SpotlightHistoryTab (published list,
// with WhatsApp sharing). Shared by every role: SpotlightViewer (full poster modal,
// opened from the bell), where parents and teachers can react.
import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import imageCompression from "browser-image-compression";
import "./ArtistSpotlight.css";
import {
  IconTrophy,
  IconCelebrate,
  IconAnnounce,
  IconUpload,
  IconTrash,
  IconX,
  IconEye,
  IconSearch,
  IconCalendar,
  IconBell,
  IconSuccess,
  IconError,
  IconPlus,
  IconClock,
  IconImage,
  IconWhatsApp,
} from "./Icons";

const API = "https://art-portal-7n6r.onrender.com/api/spotlights";

const TITLE_MAX = 80;
const DESCRIPTION_MAX = 600;
const POSTER_MAX_MB = 15;
const POSTER_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Poster types. `tone` picks the badge/icon colour; field copy changes per type.
export const CATEGORIES = {
  artist_spotlight: {
    label: "Artist Spotlight",
    Icon: IconTrophy,
    tone: "amber",
    emoji: "🌟",
    heading: "New Artist Spotlight",
    intro: "Celebrate a student's achievement with a poster for the whole academy.",
    needsStudent: true,
    titleLabel: "Achievement title",
    titlePlaceholder: "e.g. 1st Prize, District Drawing Competition",
    descLabel: "Description",
    descPlaceholder: "What did they achieve, and where?",
    descRequired: true,
  },
  festival_greeting: {
    label: "Festival Greeting",
    Icon: IconCelebrate,
    tone: "rose",
    emoji: "🎉",
    heading: "New Festival Greeting",
    intro: "Send festival wishes with a poster to every family and teacher.",
    needsStudent: false,
    titleLabel: "Greeting",
    titlePlaceholder: "e.g. Happy Diwali!",
    descLabel: "Message",
    descPlaceholder: "A short wish for families (optional)",
    descRequired: false,
  },
  announcement: {
    label: "Announcement",
    Icon: IconAnnounce,
    tone: "blue",
    emoji: "📢",
    heading: "New Announcement",
    intro: "Share important news — holidays, events or schedule changes — with everyone.",
    needsStudent: false,
    titleLabel: "Announcement title",
    titlePlaceholder: "e.g. Academy closed on 2 November",
    descLabel: "Message",
    descPlaceholder: "What do families and teachers need to know?",
    descRequired: true,
  },
};
const CATEGORY_KEYS = Object.keys(CATEGORIES);

export const categoryOf = (sp) => CATEGORIES[sp?.category] || CATEGORIES.artist_spotlight;
const isSpotlight = (sp) => categoryOf(sp) === CATEGORIES.artist_spotlight;
// Main line for a poster: the student for a spotlight, otherwise its title.
export const posterHeadline = (sp) => (isSpotlight(sp) ? sp.studentName : sp.achievementTitle);

export const REACTIONS = [
  { emoji: "❤️", label: "Love" },
  { emoji: "👏", label: "Applause" },
  { emoji: "🎉", label: "Celebrate" },
  { emoji: "🌟", label: "Star" },
  { emoji: "😍", label: "Amazing" },
];

export const formatPublishedAt = (date) =>
  new Date(date).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

// Modals render in a portal on <body>, outside the dashboard's theme container,
// so read the theme from where they were opened.
export const isDarkContext = (el) =>
  document.body.classList.contains("dark") || !!el?.closest('[data-theme="dark"]');

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

export const CategoryBadge = ({ spotlight, category }) => {
  const c = category ? CATEGORIES[category] : categoryOf(spotlight);
  return (
    <span className={`spot-badge tone-${c.tone}`}>
      <c.Icon /> {c.label}
    </span>
  );
};

// ---------------------------------------------------------------------------
// WhatsApp sharing (Admin). On phones the share sheet sends the poster image
// itself (pick WhatsApp, then the group); elsewhere WhatsApp opens with the
// text and a poster link.
// ---------------------------------------------------------------------------
const posterFiles = new Map(); // posterUrl -> File (ready to share)
const posterFetches = new Map(); // posterUrl -> Promise<File|null>

const preparePosterFile = (url) => {
  if (!url) return Promise.resolve(null);
  if (posterFiles.has(url)) return Promise.resolve(posterFiles.get(url));
  if (!posterFetches.has(url)) {
    posterFetches.set(
      url,
      fetch(url)
        .then((r) => (r.ok ? r.blob() : null))
        .then((blob) => {
          if (!blob) return null;
          const ext = blob.type === "image/png" ? "png" : "jpg";
          const file = new File([blob], `poster.${ext}`, { type: blob.type || "image/jpeg" });
          posterFiles.set(url, file);
          return file;
        })
        .catch(() => null),
    );
  }
  return posterFetches.get(url);
};

const shareText = (sp) => {
  const c = categoryOf(sp);
  const lines = isSpotlight(sp)
    ? [`${c.emoji} *Artist Spotlight*`, "", `*${sp.studentName}*`, sp.achievementTitle]
    : [`${c.emoji} *${c === CATEGORIES.announcement ? `Announcement: ${sp.achievementTitle}` : sp.achievementTitle}*`];
  if (sp.description) lines.push("", sp.description);
  lines.push("", "— Thevenkyart Art Academy");
  return lines.join("\n");
};

const openWhatsAppLink = (sp) => {
  const text = `${shareText(sp)}\n\n${sp.posterUrl}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
};

const sharePosterOnWhatsApp = async (sp) => {
  const text = shareText(sp);
  let file = posterFiles.get(sp.posterUrl);
  if (!file) file = await preparePosterFile(sp.posterUrl);
  if (file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return;
    } catch (err) {
      if (err?.name === "AbortError") return; // user closed the share sheet
    }
  }
  openWhatsAppLink(sp);
};

export const WhatsAppShareButton = ({ spotlight, className = "" }) => {
  const warm = () => preparePosterFile(spotlight.posterUrl);
  return (
    <button
      type="button"
      className={`spot-btn spot-btn-whatsapp ${className}`}
      onPointerEnter={warm}
      onTouchStart={warm}
      onFocus={warm}
      onClick={() => sharePosterOnWhatsApp(spotlight)}
    >
      <IconWhatsApp /> Share on WhatsApp
    </button>
  );
};

// Shared modal shell: Escape / backdrop close, focus moved in and restored, scroll lock.
const Modal = ({ labelledBy, dark, onClose, className = "", children, initialFocusRef }) => {
  const dialogRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    (initialFocusRef?.current || dialogRef.current)?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div
      className={`spot-scope spot-modal-backdrop${dark ? " spot-dark" : ""}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={`spot-modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
};

const ConfirmDialog = ({ title, message, confirmLabel, tone = "primary", busy, dark, onConfirm, onCancel }) => {
  const cancelRef = useRef(null);
  return (
    <Modal labelledBy="spot-confirm-title" dark={dark} onClose={busy ? () => {} : onCancel} className="spot-confirm" initialFocusRef={cancelRef}>
      <h3 id="spot-confirm-title" className="spot-confirm-title">{title}</h3>
      <p className="spot-confirm-message">{message}</p>
      <div className="spot-confirm-actions">
        <button ref={cancelRef} type="button" className="spot-btn spot-btn-ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className={`spot-btn ${tone === "danger" ? "spot-btn-danger" : "spot-btn-primary"}`}
          onClick={onConfirm}
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? <span className="spot-spinner" aria-hidden="true" /> : null}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// REACTIONS
// ---------------------------------------------------------------------------
const reactionCounts = (reactions = []) =>
  REACTIONS.map((r) => ({ ...r, count: reactions.filter((x) => x.emoji === r.emoji).length }));

// Compact "❤️ 3  👏 2" summary for cards; nothing when there are no reactions.
export const ReactionSummary = ({ reactions = [] }) => {
  const counts = reactionCounts(reactions).filter((r) => r.count > 0);
  if (counts.length === 0) return null;
  return (
    <p className="spot-reaction-summary" aria-label={`${reactions.length} reaction${reactions.length === 1 ? "" : "s"}`}>
      {counts.map((r) => (
        <span key={r.emoji} aria-hidden="true">
          {r.emoji} {r.count}
        </span>
      ))}
    </p>
  );
};

// Parents and teachers tap to react (tap again to remove); admins see who reacted.
const ReactionBar = ({ spotlight, onUpdate }) => {
  const me = getStoredUser();
  const canReact = me?.role === "parent" || me?.role === "teacher";
  const [reactions, setReactions] = useState(spotlight.reactions || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setReactions(spotlight.reactions || []), [spotlight]);

  const mine = canReact ? reactions.find((r) => String(r.userId) === String(me._id))?.emoji : null;
  const counts = reactionCounts(reactions);

  const react = async (emoji) => {
    if (!canReact || saving) return;
    const previous = reactions;
    const others = reactions.filter((r) => String(r.userId) !== String(me._id));
    const optimistic = mine === emoji ? others : [...others, { userId: me._id, emoji, role: me.role, name: "" }];
    setReactions(optimistic);
    setSaving(true);
    setError("");
    try {
      const res = await axios.post(`${API}/${spotlight._id}/react`, { userId: me._id, emoji });
      setReactions(res.data.reactions);
      onUpdate?.({ ...spotlight, reactions: res.data.reactions });
    } catch {
      setReactions(previous);
      setError("Couldn't save your reaction. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!canReact) {
    return (
      <div className="spot-reactions">
        <p className="spot-reactions-label">
          {reactions.length === 0 ? "No reactions yet" : `${reactions.length} reaction${reactions.length === 1 ? "" : "s"}`}
        </p>
        {reactions.length > 0 && (
          <>
            <div className="spot-reaction-row">
              {counts.filter((r) => r.count > 0).map((r) => (
                <span key={r.emoji} className="spot-reaction-chip is-static">
                  <span aria-hidden="true">{r.emoji}</span> {r.count}
                  <span className="spot-visually-hidden"> {r.label}</span>
                </span>
              ))}
            </div>
            <details className="spot-reactors">
              <summary>See who reacted</summary>
              <ul>
                {reactions.map((r) => (
                  <li key={`${r.userId}`}>
                    <span aria-hidden="true">{r.emoji}</span> {r.name || "Someone"}
                    <span className="spot-reactor-role">{r.role === "teacher" ? "Teacher" : "Parent"}</span>
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="spot-reactions">
      <p className="spot-reactions-label" id={`spot-react-label-${spotlight._id}`}>
        {mine ? "You reacted — tap again to remove" : "React to this post"}
      </p>
      <div className="spot-reaction-row" role="group" aria-labelledby={`spot-react-label-${spotlight._id}`}>
        {counts.map((r) => (
          <button
            key={r.emoji}
            type="button"
            className={`spot-reaction-chip${mine === r.emoji ? " is-mine" : ""}`}
            aria-pressed={mine === r.emoji}
            aria-label={`${r.label}${r.count ? `, ${r.count}` : ""}`}
            onClick={() => react(r.emoji)}
            disabled={saving}
          >
            <span aria-hidden="true">{r.emoji}</span>
            {r.count > 0 && <span className="spot-reaction-count" aria-hidden="true">{r.count}</span>}
          </button>
        ))}
      </div>
      {error && <p className="spot-error" role="alert"><IconError /> {error}</p>}
    </div>
  );
};

// Full poster view — used by the history tab and by the notification bell on every
// dashboard. `onUpdate` receives the poster with fresh reactions.
export const SpotlightViewer = ({ spotlight, dark, onClose, onUpdate, showShare = false }) => {
  const closeRef = useRef(null);
  if (!spotlight) return null;
  const spot = isSpotlight(spotlight);
  return (
    <Modal labelledBy="spot-viewer-name" dark={dark} onClose={onClose} className="spot-viewer" initialFocusRef={closeRef}>
      <button ref={closeRef} type="button" className="spot-viewer-close" onClick={onClose} aria-label="Close poster">
        <IconX size={22} />
      </button>
      <div className="spot-viewer-poster">
        <img src={spotlight.posterUrl} alt={`Poster: ${posterHeadline(spotlight)}`} />
      </div>
      <div className="spot-viewer-body">
        <CategoryBadge spotlight={spotlight} />
        <h2 id="spot-viewer-name" className="spot-viewer-name">{posterHeadline(spotlight)}</h2>
        {spot && <p className="spot-viewer-title">{spotlight.achievementTitle}</p>}
        {spotlight.description && <p className="spot-viewer-desc">{spotlight.description}</p>}
        <p className="spot-meta">
          <IconCalendar /> Published {formatPublishedAt(spotlight.publishedAt)}
        </p>
        <ReactionBar spotlight={spotlight} onUpdate={onUpdate} />
        {showShare && <WhatsAppShareButton spotlight={spotlight} className="spot-btn-block" />}
      </div>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// PUBLISH TAB (Admin)
// ---------------------------------------------------------------------------
const emptyForm = { category: "artist_spotlight", studentName: "", achievementTitle: "", description: "" };

export const SpotlightPublishTab = ({ students = [], onViewHistory }) => {
  const rootRef = useRef(null);
  const categoryRef = useRef(null);
  const nameRef = useRef(null);
  const titleRef = useRef(null);
  const descRef = useRef(null);
  const posterRef = useRef(null);
  const dropzoneRef = useRef(null);

  const [form, setForm] = useState(emptyForm);
  const [posterFile, setPosterFile] = useState(null);
  const [posterPreview, setPosterPreview] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | preparing | publishing
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState(null);

  const cat = CATEGORIES[form.category];

  const studentOptions = useMemo(
    () =>
      students
        .filter((s) => s.role === "parent" && s.isActive !== false && (s.childName || s.fullName))
        .map((s) => ({ id: s._id, name: (s.childName || s.fullName).trim() }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [students],
  );

  useEffect(() => () => posterPreview && URL.revokeObjectURL(posterPreview), [posterPreview]);

  const setField = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (errors[name]) setErrors((er) => ({ ...er, [name]: "" }));
  };

  const setCategory = (e) => {
    setForm((f) => ({ ...f, category: e.target.value }));
    setErrors({});
  };

  const pickPoster = (file) => {
    if (!file) return;
    if (!POSTER_TYPES.includes(file.type)) {
      setErrors((er) => ({ ...er, poster: "Choose a JPG, PNG or WebP image." }));
      return;
    }
    if (file.size > POSTER_MAX_MB * 1024 * 1024) {
      setErrors((er) => ({ ...er, poster: `Poster must be under ${POSTER_MAX_MB} MB.` }));
      return;
    }
    setPosterFile(file);
    setPosterPreview(URL.createObjectURL(file));
    setErrors((er) => ({ ...er, poster: "" }));
  };

  const removePoster = () => {
    setPosterFile(null);
    setPosterPreview("");
    if (posterRef.current) posterRef.current.value = "";
  };

  const validate = () => {
    const next = {};
    if (cat.needsStudent && !form.studentName.trim()) next.studentName = "Enter the student's name.";
    if (!form.achievementTitle.trim()) next.achievementTitle = `Enter the ${cat.titleLabel.toLowerCase()}.`;
    if (cat.descRequired && !form.description.trim()) next.description = `Enter the ${cat.descLabel.toLowerCase()}.`;
    if (!posterFile) next.poster = "Upload a poster image.";
    setErrors(next);
    const firstInvalid = [
      ["studentName", nameRef],
      ["achievementTitle", titleRef],
      ["description", descRef],
      ["poster", dropzoneRef],
    ].find(([key]) => next[key]);
    if (firstInvalid) firstInvalid[1].current?.focus();
    return !firstInvalid;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitError("");
    if (validate()) setConfirmOpen(true);
  };

  const publish = async () => {
    setSubmitError("");
    try {
      setStatus("preparing");
      const compressed = await imageCompression(posterFile, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        // Cloudinary only accepts jpg/png here; keep PNG transparency, convert the rest
        fileType: posterFile.type === "image/png" ? "image/png" : "image/jpeg",
      });

      setStatus("publishing");
      const data = new FormData();
      data.append("category", form.category);
      if (cat.needsStudent) {
        data.append("studentName", form.studentName.trim());
        const match = studentOptions.find(
          (s) => s.name.toLowerCase() === form.studentName.trim().toLowerCase(),
        );
        if (match) data.append("studentId", match.id);
      }
      data.append("achievementTitle", form.achievementTitle.trim());
      data.append("description", form.description.trim());
      const me = getStoredUser();
      data.append("publishedBy", me?.fullName || me?.username || "");
      data.append("poster", compressed, posterFile.type === "image/png" ? "poster.png" : "poster.jpg");

      const res = await axios.post(API, data);
      setResult({ spotlight: res.data.spotlight, pushSent: res.data.pushSent || 0 });
      preparePosterFile(res.data.spotlight?.posterUrl); // ready for WhatsApp sharing
      setForm((f) => ({ ...emptyForm, category: f.category }));
      removePoster();
      setConfirmOpen(false);
    } catch (err) {
      setConfirmOpen(false);
      setSubmitError(err.response?.data?.message || "Couldn't publish the poster. Check your connection and try again.");
    } finally {
      setStatus("idle");
    }
  };

  const busy = status !== "idle";

  if (result) {
    const sp = result.spotlight;
    return (
      <div className="spot-scope" ref={rootRef}>
        <div className="spot-card spot-success" role="status">
          <span className="spot-success-icon"><IconSuccess size={36} /></span>
          <h3>{categoryOf(sp).label} published</h3>
          <p>
            <strong>{posterHeadline(sp)}</strong> is now live.{" "}
            {result.pushSent > 0
              ? `Push notification sent to ${result.pushSent} device${result.pushSent === 1 ? "" : "s"}.`
              : "No devices have alerts turned on yet."}{" "}
            It also appears in everyone's notification bell.
          </p>
          <WhatsAppShareButton spotlight={sp} />
          <div className="spot-success-actions">
            <button type="button" className="spot-btn spot-btn-ghost" onClick={onViewHistory}>
              <IconClock /> View history
            </button>
            <button type="button" className="spot-btn spot-btn-primary" onClick={() => setResult(null)}>
              <IconPlus /> Publish another
            </button>
          </div>
        </div>
      </div>
    );
  }

  const fieldProps = (name) => ({
    id: `spot-${name}`,
    name,
    value: form[name],
    onChange: setField,
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `spot-${name}-error` : `spot-${name}-hint`,
    disabled: busy,
  });

  return (
    <div className="spot-scope" ref={rootRef}>
      <div className="spot-publish">
        <form className="spot-card spot-form" onSubmit={handleSubmit} noValidate>
          <div className="spot-form-head">
            <span className={`spot-form-icon tone-${cat.tone}`}><cat.Icon size={22} /></span>
            <div>
              <h3>{cat.heading}</h3>
              <p>{cat.intro}</p>
            </div>
          </div>

          <div className="spot-field">
            <label htmlFor="spot-category">Poster type</label>
            <div className="spot-select">
              <select ref={categoryRef} id="spot-category" name="category" value={form.category} onChange={setCategory} disabled={busy}>
                {CATEGORY_KEYS.map((key) => (
                  <option key={key} value={key}>{CATEGORIES[key].label}</option>
                ))}
              </select>
            </div>
          </div>

          {cat.needsStudent && (
            <div className="spot-field">
              <label htmlFor="spot-studentName">Student name <span className="spot-req" aria-hidden="true">*</span></label>
              <input ref={nameRef} {...fieldProps("studentName")} list="spot-student-list" autoComplete="off" maxLength={80} required />
              <datalist id="spot-student-list">
                {studentOptions.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
              {errors.studentName ? (
                <p id="spot-studentName-error" className="spot-error"><IconError /> {errors.studentName}</p>
              ) : (
                <p id="spot-studentName-hint" className="spot-hint">Start typing to pick an academy student.</p>
              )}
            </div>
          )}

          <div className="spot-field">
            <label htmlFor="spot-achievementTitle">{cat.titleLabel} <span className="spot-req" aria-hidden="true">*</span></label>
            <input ref={titleRef} {...fieldProps("achievementTitle")} maxLength={TITLE_MAX} required placeholder={cat.titlePlaceholder} />
            {errors.achievementTitle ? (
              <p id="spot-achievementTitle-error" className="spot-error"><IconError /> {errors.achievementTitle}</p>
            ) : (
              <p id="spot-achievementTitle-hint" className="spot-hint spot-hint-row">
                <span>Shown in the notification.</span>
                <span>{form.achievementTitle.length}/{TITLE_MAX}</span>
              </p>
            )}
          </div>

          <div className="spot-field">
            <label htmlFor="spot-description">
              {cat.descLabel}{" "}
              {cat.descRequired ? <span className="spot-req" aria-hidden="true">*</span> : <span className="spot-optional">(optional)</span>}
            </label>
            <textarea ref={descRef} {...fieldProps("description")} rows={5} maxLength={DESCRIPTION_MAX} required={cat.descRequired} placeholder={cat.descPlaceholder} />
            {errors.description ? (
              <p id="spot-description-error" className="spot-error"><IconError /> {errors.description}</p>
            ) : (
              <p id="spot-description-hint" className="spot-hint spot-hint-row">
                <span>Visible to parents, teachers and admins.</span>
                <span>{form.description.length}/{DESCRIPTION_MAX}</span>
              </p>
            )}
          </div>

          <div className="spot-field">
            <span className="spot-label">Poster <span className="spot-req" aria-hidden="true">*</span></span>
            {posterPreview ? (
              <div className="spot-poster-chosen">
                <img src={posterPreview} alt="Selected poster preview" />
                <div className="spot-poster-chosen-info">
                  <span className="spot-poster-name">{posterFile?.name}</span>
                  <span className="spot-hint">{(posterFile.size / (1024 * 1024)).toFixed(1)} MB · resized before upload</span>
                  <div className="spot-poster-chosen-actions">
                    <button type="button" className="spot-btn spot-btn-ghost spot-btn-sm" onClick={() => posterRef.current?.click()} disabled={busy}>
                      <IconUpload /> Replace
                    </button>
                    <button type="button" className="spot-btn spot-btn-ghost spot-btn-sm" onClick={removePoster} disabled={busy}>
                      <IconTrash /> Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                ref={dropzoneRef}
                aria-label="Choose poster image"
                onClick={() => posterRef.current?.click()}
                disabled={busy}
                aria-describedby={errors.poster ? "spot-poster-error" : "spot-poster-hint"}
                className={`spot-dropzone${dragOver ? " is-dragover" : ""}${errors.poster ? " is-invalid" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  pickPoster(e.dataTransfer.files?.[0]);
                }}
              >
                <IconUpload size={26} />
                <span className="spot-dropzone-main">Tap to choose a poster</span>
                <span id="spot-poster-hint" className="spot-hint">or drag and drop · JPG, PNG or WebP, up to {POSTER_MAX_MB} MB</span>
              </button>
            )}
            <input
              ref={posterRef}
              id="spot-poster"
              type="file"
              accept={POSTER_TYPES.join(",")}
              className="spot-visually-hidden"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => pickPoster(e.target.files?.[0])}
              disabled={busy}
            />
            {errors.poster && (
              <p id="spot-poster-error" className="spot-error"><IconError /> {errors.poster}</p>
            )}
          </div>

          {submitError && (
            <p className="spot-error spot-submit-error" role="alert"><IconError /> {submitError}</p>
          )}

          <button type="submit" className="spot-btn spot-btn-primary spot-btn-block" disabled={busy} aria-busy={busy}>
            {busy ? (
              <>
                <span className="spot-spinner" aria-hidden="true" />
                {status === "preparing" ? "Preparing poster…" : "Publishing…"}
              </>
            ) : (
              <>
                <IconBell /> Publish {cat.label.toLowerCase()}
              </>
            )}
          </button>
        </form>

        <aside className="spot-card spot-preview" aria-label="Poster preview">
          <p className="spot-preview-label">Preview</p>
          <div className="spot-preview-poster">
            {posterPreview ? (
              <img src={posterPreview} alt="" />
            ) : (
              <span className="spot-preview-placeholder"><IconImage size={32} /> Poster appears here</span>
            )}
          </div>
          <CategoryBadge category={form.category} />
          <h4 className="spot-preview-name">
            {cat.needsStudent ? form.studentName.trim() || "Student name" : form.achievementTitle.trim() || cat.titleLabel}
          </h4>
          {cat.needsStudent && (
            <p className="spot-preview-title">{form.achievementTitle.trim() || cat.titleLabel}</p>
          )}
          {(form.description.trim() || cat.descRequired) && (
            <p className="spot-preview-desc">{form.description.trim() || `The ${cat.descLabel.toLowerCase()} shows here.`}</p>
          )}
        </aside>
      </div>

      {confirmOpen && (
        <ConfirmDialog
          title={`Publish this ${cat.label.toLowerCase()}?`}
          message={`“${cat.needsStudent ? form.studentName.trim() : form.achievementTitle.trim()}” will be sent to all parents, teachers and admins as a notification. Push alerts can't be recalled once sent.`}
          confirmLabel={status === "preparing" ? "Preparing…" : status === "publishing" ? "Publishing…" : "Publish"}
          busy={busy}
          dark={isDarkContext(rootRef.current)}
          onConfirm={publish}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// HISTORY TAB (Admin)
// ---------------------------------------------------------------------------
export const SpotlightHistoryTab = ({ onCreate }) => {
  const rootRef = useRef(null);
  const [spotlights, setSpotlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [viewing, setViewing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);

  const load = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await axios.get(API);
      setSpotlights(res.data || []);
    } catch {
      setLoadError("Couldn't load posters.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return spotlights.filter((s) => {
      if (typeFilter !== "all" && (s.category || "artist_spotlight") !== typeFilter) return false;
      if (!q) return true;
      return (
        (s.studentName || "").toLowerCase().includes(q) ||
        s.achievementTitle.toLowerCase().includes(q) ||
        (s.description || "").toLowerCase().includes(q)
      );
    });
  }, [spotlights, query, typeFilter]);

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await axios.delete(`${API}/${toDelete._id}`);
      setSpotlights((list) => list.filter((s) => s._id !== toDelete._id));
      setToast({ type: "success", message: "Poster deleted." });
      setToDelete(null);
    } catch {
      setToast({ type: "error", message: "Couldn't delete the poster." });
    } finally {
      setDeleting(false);
    }
  };

  const dark = () => isDarkContext(rootRef.current);
  const narrowed = query.trim() || typeFilter !== "all";

  return (
    <div className="spot-scope" ref={rootRef}>
      <div className="spot-history-toolbar">
        <div>
          <h3 className="spot-history-heading">Poster History</h3>
          <p className="spot-hint" aria-live="polite">
            {loading
              ? "Loading…"
              : narrowed
                ? `${filtered.length} of ${spotlights.length} poster${spotlights.length === 1 ? "" : "s"}`
                : `${spotlights.length} poster${spotlights.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="spot-history-actions">
          <label className="spot-search">
            <IconSearch />
            <span className="spot-visually-hidden">Search posters</span>
            <input type="search" placeholder="Search posters" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <button type="button" className="spot-btn spot-btn-primary" onClick={onCreate}>
            <IconPlus /> New poster
          </button>
        </div>
      </div>

      <div className="spot-filter-chips" role="group" aria-label="Filter by poster type">
        {["all", ...CATEGORY_KEYS].map((key) => (
          <button
            key={key}
            type="button"
            className={`spot-chip${typeFilter === key ? " is-active" : ""}`}
            aria-pressed={typeFilter === key}
            onClick={() => setTypeFilter(key)}
          >
            {key === "all" ? "All" : CATEGORIES[key].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="spot-grid" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="spot-card spot-history-card spot-skeleton">
              <div className="spot-history-poster" />
              <div className="spot-history-body">
                <span className="spot-skel-line" />
                <span className="spot-skel-line short" />
              </div>
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="spot-card spot-empty" role="alert">
          <IconError size={28} />
          <p>{loadError}</p>
          <button type="button" className="spot-btn spot-btn-ghost" onClick={load}>Try again</button>
        </div>
      ) : spotlights.length === 0 ? (
        <div className="spot-card spot-empty">
          <span className="spot-form-icon tone-amber"><IconTrophy size={26} /></span>
          <h4>No posters yet</h4>
          <p>Publish an Artist Spotlight, festival greeting or announcement.</p>
          <button type="button" className="spot-btn spot-btn-primary" onClick={onCreate}>
            <IconPlus /> Create a poster
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="spot-card spot-empty">
          <p>No posters match these filters.</p>
          <button
            type="button"
            className="spot-btn spot-btn-ghost"
            onClick={() => {
              setQuery("");
              setTypeFilter("all");
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="spot-grid" aria-label="Published posters">
          {filtered.map((s) => (
            <li key={s._id} className="spot-card spot-history-card">
              <button type="button" className="spot-history-poster" onClick={() => setViewing(s)} aria-label={`View poster: ${posterHeadline(s)}`}>
                <img src={s.posterUrl} alt="" loading="lazy" />
              </button>
              <div className="spot-history-body">
                <CategoryBadge spotlight={s} />
                <h4 className="spot-history-name">{posterHeadline(s)}</h4>
                {isSpotlight(s) && <p className="spot-history-title">{s.achievementTitle}</p>}
                {s.description && <p className="spot-history-desc">{s.description}</p>}
                <p className="spot-meta"><IconCalendar /> Published {formatPublishedAt(s.publishedAt)}</p>
                <p className="spot-meta"><IconBell /> Push sent to {s.pushSentCount || 0} device{s.pushSentCount === 1 ? "" : "s"}</p>
                <ReactionSummary reactions={s.reactions} />
                <div className="spot-history-card-actions">
                  <WhatsAppShareButton spotlight={s} className="spot-btn-sm spot-btn-block" />
                  <button type="button" className="spot-btn spot-btn-ghost spot-btn-sm" onClick={() => setViewing(s)}>
                    <IconEye /> View
                  </button>
                  <button type="button" className="spot-btn spot-btn-ghost spot-btn-sm spot-btn-danger-text" onClick={() => setToDelete(s)}>
                    <IconTrash /> Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {viewing && (
        <SpotlightViewer
          spotlight={viewing}
          dark={dark()}
          showShare
          onClose={() => setViewing(null)}
        />
      )}
      {toDelete && (
        <ConfirmDialog
          title="Delete this poster?"
          message={`“${posterHeadline(toDelete)}” will be removed from history and from everyone's notification bell. This can't be undone.`}
          confirmLabel={deleting ? "Deleting…" : "Delete"}
          tone="danger"
          busy={deleting}
          dark={dark()}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
      {toast && (
        <div className={`spot-toast spot-toast-${toast.type}`} role="status">
          {toast.type === "success" ? <IconSuccess /> : <IconError />} {toast.message}
        </div>
      )}
    </div>
  );
};
