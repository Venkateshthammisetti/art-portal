// Artist Spotlight — admin-published posters celebrating a student's achievement.
// Admin-only: SpotlightPublishTab (form) and SpotlightHistoryTab (published list).
// Shared by every role: SpotlightViewer (full poster modal, opened from the bell).
import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import imageCompression from "browser-image-compression";
import "./ArtistSpotlight.css";
import {
  IconTrophy,
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
} from "./Icons";

const API = "https://art-portal-7n6r.onrender.com/api/spotlights";

const TITLE_MAX = 80;
const DESCRIPTION_MAX = 600;
const POSTER_MAX_MB = 15;
const POSTER_TYPES = ["image/jpeg", "image/png", "image/webp"];

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

const currentAdminName = () => {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    return u?.fullName || u?.username || "";
  } catch {
    return "";
  }
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

// Full poster view — used by the history tab and by the notification bell on every dashboard.
export const SpotlightViewer = ({ spotlight, dark, onClose }) => {
  const closeRef = useRef(null);
  if (!spotlight) return null;
  return (
    <Modal labelledBy="spot-viewer-name" dark={dark} onClose={onClose} className="spot-viewer" initialFocusRef={closeRef}>
      <button ref={closeRef} type="button" className="spot-viewer-close" onClick={onClose} aria-label="Close spotlight">
        <IconX size={22} />
      </button>
      <div className="spot-viewer-poster">
        <img src={spotlight.posterUrl} alt={`Spotlight poster for ${spotlight.studentName}`} />
      </div>
      <div className="spot-viewer-body">
        <span className="spot-badge"><IconTrophy /> Artist Spotlight</span>
        <h2 id="spot-viewer-name" className="spot-viewer-name">{spotlight.studentName}</h2>
        <p className="spot-viewer-title">{spotlight.achievementTitle}</p>
        <p className="spot-viewer-desc">{spotlight.description}</p>
        <p className="spot-meta">
          <IconCalendar /> Published {formatPublishedAt(spotlight.publishedAt)}
        </p>
      </div>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// PUBLISH TAB (Admin)
// ---------------------------------------------------------------------------
const emptyForm = { studentName: "", achievementTitle: "", description: "" };

export const SpotlightPublishTab = ({ students = [], onViewHistory }) => {
  const rootRef = useRef(null);
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
    if (!form.studentName.trim()) next.studentName = "Enter the student's name.";
    if (!form.achievementTitle.trim()) next.achievementTitle = "Enter the achievement title.";
    if (!form.description.trim()) next.description = "Describe the achievement.";
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
      const match = studentOptions.find(
        (s) => s.name.toLowerCase() === form.studentName.trim().toLowerCase(),
      );
      const data = new FormData();
      data.append("studentName", form.studentName.trim());
      if (match) data.append("studentId", match.id);
      data.append("achievementTitle", form.achievementTitle.trim());
      data.append("description", form.description.trim());
      data.append("publishedBy", currentAdminName());
      data.append("poster", compressed, posterFile.type === "image/png" ? "poster.png" : "poster.jpg");

      const res = await axios.post(API, data);
      setResult({ spotlight: res.data.spotlight, pushSent: res.data.pushSent || 0 });
      setForm(emptyForm);
      removePoster();
      setConfirmOpen(false);
    } catch (err) {
      setConfirmOpen(false);
      setSubmitError(err.response?.data?.message || "Couldn't publish the spotlight. Check your connection and try again.");
    } finally {
      setStatus("idle");
    }
  };

  const busy = status !== "idle";

  if (result) {
    return (
      <div className="spot-scope" ref={rootRef}>
        <div className="spot-card spot-success" role="status">
          <span className="spot-success-icon"><IconSuccess size={36} /></span>
          <h3>Spotlight published</h3>
          <p>
            <strong>{result.spotlight.studentName}</strong> is now in the Artist Spotlight.{" "}
            {result.pushSent > 0
              ? `Push notification sent to ${result.pushSent} device${result.pushSent === 1 ? "" : "s"}.`
              : "No devices have alerts turned on yet."}{" "}
            It also appears in everyone's notification bell.
          </p>
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
            <span className="spot-form-icon"><IconTrophy size={22} /></span>
            <div>
              <h3>New Artist Spotlight</h3>
              <p>Celebrate a student's achievement with a poster for the whole academy.</p>
            </div>
          </div>

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

          <div className="spot-field">
            <label htmlFor="spot-achievementTitle">Achievement title <span className="spot-req" aria-hidden="true">*</span></label>
            <input ref={titleRef} {...fieldProps("achievementTitle")} maxLength={TITLE_MAX} required placeholder="e.g. 1st Prize, District Drawing Competition" />
            {errors.achievementTitle ? (
              <p id="spot-achievementTitle-error" className="spot-error"><IconError /> {errors.achievementTitle}</p>
            ) : (
              <p id="spot-achievementTitle-hint" className="spot-hint spot-hint-row">
                <span>Shown as the notification text.</span>
                <span>{form.achievementTitle.length}/{TITLE_MAX}</span>
              </p>
            )}
          </div>

          <div className="spot-field">
            <label htmlFor="spot-description">Description <span className="spot-req" aria-hidden="true">*</span></label>
            <textarea ref={descRef} {...fieldProps("description")} rows={5} maxLength={DESCRIPTION_MAX} required placeholder="What did they achieve, and where?" />
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
                <IconBell /> Publish spotlight
              </>
            )}
          </button>
        </form>

        <aside className="spot-card spot-preview" aria-label="Spotlight preview">
          <p className="spot-preview-label">Preview</p>
          <div className="spot-preview-poster">
            {posterPreview ? (
              <img src={posterPreview} alt="" />
            ) : (
              <span className="spot-preview-placeholder"><IconImage size={32} /> Poster appears here</span>
            )}
          </div>
          <span className="spot-badge"><IconTrophy /> Artist Spotlight</span>
          <h4 className="spot-preview-name">{form.studentName.trim() || "Student name"}</h4>
          <p className="spot-preview-title">{form.achievementTitle.trim() || "Achievement title"}</p>
          <p className="spot-preview-desc">{form.description.trim() || "The description of the achievement shows here."}</p>
        </aside>
      </div>

      {confirmOpen && (
        <ConfirmDialog
          title="Publish this spotlight?"
          message={`${form.studentName.trim()}'s spotlight will be sent to all parents, teachers and admins as a notification. Push alerts can't be recalled once sent.`}
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
      setLoadError("Couldn't load spotlights.");
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
    if (!q) return spotlights;
    return spotlights.filter(
      (s) => s.studentName.toLowerCase().includes(q) || s.achievementTitle.toLowerCase().includes(q),
    );
  }, [spotlights, query]);

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await axios.delete(`${API}/${toDelete._id}`);
      setSpotlights((list) => list.filter((s) => s._id !== toDelete._id));
      setToast({ type: "success", message: "Spotlight deleted." });
      setToDelete(null);
    } catch {
      setToast({ type: "error", message: "Couldn't delete the spotlight." });
    } finally {
      setDeleting(false);
    }
  };

  const dark = () => isDarkContext(rootRef.current);

  return (
    <div className="spot-scope" ref={rootRef}>
      <div className="spot-history-toolbar">
        <div>
          <h3 className="spot-history-heading">Spotlight History</h3>
          <p className="spot-hint" aria-live="polite">
            {loading
              ? "Loading…"
              : query
                ? `${filtered.length} of ${spotlights.length} spotlight${spotlights.length === 1 ? "" : "s"}`
                : `${spotlights.length} spotlight${spotlights.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="spot-history-actions">
          <label className="spot-search">
            <IconSearch />
            <span className="spot-visually-hidden">Search spotlights</span>
            <input type="search" placeholder="Search by name or title" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <button type="button" className="spot-btn spot-btn-primary" onClick={onCreate}>
            <IconPlus /> New spotlight
          </button>
        </div>
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
          <span className="spot-form-icon"><IconTrophy size={26} /></span>
          <h4>No spotlights yet</h4>
          <p>Publish the first one to celebrate a student's achievement.</p>
          <button type="button" className="spot-btn spot-btn-primary" onClick={onCreate}>
            <IconPlus /> Create a spotlight
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="spot-card spot-empty">
          <p>No spotlights match “{query}”.</p>
          <button type="button" className="spot-btn spot-btn-ghost" onClick={() => setQuery("")}>Clear search</button>
        </div>
      ) : (
        <ul className="spot-grid" aria-label="Published spotlights">
          {filtered.map((s) => (
            <li key={s._id} className="spot-card spot-history-card">
              <button type="button" className="spot-history-poster" onClick={() => setViewing(s)} aria-label={`View ${s.studentName}'s spotlight`}>
                <img src={s.posterUrl} alt="" loading="lazy" />
              </button>
              <div className="spot-history-body">
                <h4 className="spot-history-name">{s.studentName}</h4>
                <p className="spot-history-title">{s.achievementTitle}</p>
                <p className="spot-history-desc">{s.description}</p>
                <p className="spot-meta"><IconCalendar /> Published {formatPublishedAt(s.publishedAt)}</p>
                <p className="spot-meta"><IconBell /> Push sent to {s.pushSentCount || 0} device{s.pushSentCount === 1 ? "" : "s"}</p>
                <div className="spot-history-card-actions">
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

      {viewing && <SpotlightViewer spotlight={viewing} dark={dark()} onClose={() => setViewing(null)} />}
      {toDelete && (
        <ConfirmDialog
          title="Delete this spotlight?"
          message={`${toDelete.studentName}'s spotlight will be removed from history and from everyone's notification bell. This can't be undone.`}
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
