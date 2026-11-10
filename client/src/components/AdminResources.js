// Admin › Academic Resources: folders of links, notes, images and files the
// academy keeps ready to send to parents (registration forms, material lists…).
// Add things by pasting a link, typing a note, choosing files, pasting an image,
// or dropping files/links anywhere on an open folder. Pinned items show at the
// top of the library for one-tap Copy / WhatsApp.
// API: /api/resources (server/resources.js).
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import notify from "../utils/notify";
import {
  IconFolder,
  IconFolderPlus,
  IconLink,
  IconCopy,
  IconExternal,
  IconArrowLeft,
  IconMoreVertical,
  IconWhatsApp,
  IconFile,
  IconPdf,
  IconNote,
  IconUpload,
  IconSearch,
  IconStar,
  IconEdit,
  IconTrash,
  IconCheck,
  IconX,
} from "./Icons";
import "./AdminResources.css";

const API = "https://art-portal-7n6r.onrender.com/api/resources";
const MAX_MB = 10;

// Folder colours, named after paints
export const PAINTS = [
  { key: "cobalt", label: "Cobalt" },
  { key: "viridian", label: "Viridian" },
  { key: "cadmium", label: "Cadmium" },
  { key: "alizarin", label: "Alizarin" },
  { key: "violet", label: "Violet" },
  { key: "graphite", label: "Graphite" },
];

const KINDS = [
  { key: "all", label: "All" },
  { key: "link", label: "Links" },
  { key: "image", label: "Images" },
  { key: "file", label: "Files" },
  { key: "note", label: "Notes" },
];

const me = () => {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    return u.fullName || u.username || "Admin";
  } catch {
    return "Admin";
  }
};
const isUrl = (s) => /^https?:\/\/\S+$/i.test(String(s || "").trim());
const domainOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};
const fmtSize = (b) => (!b ? "" : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const fmtWhen = (d) => {
  if (!d) return "";
  const days = Math.floor((Date.now() - new Date(d)) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};
const itemTitle = (it) =>
  it.title || (it.kind === "link" ? domainOf(it.url) : it.kind === "note" ? it.text.split("\n")[0].slice(0, 80) : it.fileName || "Untitled");
const shareText = (it) => {
  if (it.kind === "note") return it.title ? `${it.title}\n\n${it.text}` : it.text;
  const head = itemTitle(it);
  return it.text ? `${head}\n${it.text}\n${it.url}` : `${head}\n${it.url}`;
};
const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
};
const countLabel = (items) => {
  const n = (k) => items.filter((i) => i.kind === k).length;
  const parts = [
    [n("link"), "link"],
    [n("image"), "image"],
    [n("file"), "file"],
    [n("note"), "note"],
  ].filter(([c]) => c > 0).map(([c, w]) => `${c} ${w}${c === 1 ? "" : "s"}`);
  return parts.length ? parts.join(", ") : "Empty";
};
const errMsg = (err, fallback) => err?.response?.data?.message || fallback;

// ---------------- item glyph / thumbnail ----------------
const ItemGlyph = ({ it }) => {
  if (it.kind === "image") return <img className="res-thumb" src={it.url} alt="" loading="lazy" />;
  const Icon = it.kind === "link" ? IconLink : it.kind === "note" ? IconNote : /pdf/i.test(it.mimeType) ? IconPdf : IconFile;
  return (
    <span className={`res-glyph res-glyph-${it.kind}`} aria-hidden="true">
      <Icon size={18} />
    </span>
  );
};

// ---------------- folder dialog ----------------
const FolderDialog = ({ initial, onClose, onSaved }) => {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [color, setColor] = useState(initial?.color || "cobalt");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError("Give the folder a name");
    setSaving(true);
    setError("");
    try {
      const body = { name, description, color, by: me() };
      const r = initial ? await axios.put(`${API}/${initial._id}`, body) : await axios.post(API, body);
      onSaved(r.data);
    } catch (err) {
      setError(errMsg(err, "Couldn't save the folder. Try again."));
      setSaving(false);
    }
  };

  return (
    <div className="res-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="res-modal" role="dialog" aria-modal="true" aria-labelledby="res-folder-title" onSubmit={save}>
        <h3 id="res-folder-title">{initial ? "Edit folder" : "New folder"}</h3>
        <label className="res-field">
          <span>Name</span>
          <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Registration, Art materials" maxLength={60} />
        </label>
        <label className="res-field">
          <span>What's in it (optional)</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Links we send to new parents" maxLength={140} />
        </label>
        <fieldset className="res-field res-paints">
          <legend>Colour</legend>
          <div className="res-paint-row">
            {PAINTS.map((p) => (
              <label key={p.key} className={`res-paint paint-${p.key}${color === p.key ? " is-on" : ""}`} title={p.label}>
                <input type="radio" name="paint" value={p.key} checked={color === p.key} onChange={() => setColor(p.key)} />
                <span className="res-paint-chip" aria-hidden="true">{color === p.key && <IconCheck size={14} />}</span>
                <span className="res-paint-name">{p.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p className="res-error" role="alert">{error}</p>}
        <div className="res-modal-actions">
          <button type="button" className="res-btn res-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="res-btn res-btn-primary" disabled={saving}>
            {saving ? "Saving…" : initial ? "Save folder" : "Create folder"}
          </button>
        </div>
      </form>
    </div>
  );
};

// ---------------- one item row ----------------
const ItemRow = ({ it, folder, showFolder, onChange, onOpenFolder }) => {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenu(false);
    const esc = (e) => e.key === "Escape" && setMenu(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  const update = async (body, done) => {
    setBusy(true);
    try {
      const r = await axios.put(`${API}/${folder._id}/items/${it._id}`, body);
      onChange(r.data);
      if (done) notify.success(done);
      setEditing(false);
    } catch (err) {
      notify.error(errMsg(err, "Couldn't save the change"));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setMenu(false);
    if (!window.confirm(`Delete "${itemTitle(it)}"?`)) return;
    try {
      const r = await axios.delete(`${API}/${folder._id}/items/${it._id}`);
      onChange(r.data);
      notify.success("Deleted");
    } catch (err) {
      notify.error(errMsg(err, "Couldn't delete it"));
    }
  };
  const copy = async () => {
    await copyText(it.kind === "note" ? shareText(it) : it.url);
    notify.success(it.kind === "note" ? "Note copied" : "Link copied");
  };

  if (editing) {
    return (
      <li className="res-item is-editing">
        <form className="res-edit" onSubmit={(e) => { e.preventDefault(); update(draft, "Saved"); }}>
          <label className="res-field">
            <span>Title</span>
            <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder={itemTitle(it)} autoFocus />
          </label>
          {it.kind === "link" && (
            <label className="res-field">
              <span>Link</span>
              <input type="url" value={draft.url} onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))} required />
            </label>
          )}
          <label className="res-field">
            <span>{it.kind === "note" ? "Note" : "Note for parents (optional, sent with the link)"}</span>
            <textarea rows={it.kind === "note" ? 5 : 2} value={draft.text} onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))} />
          </label>
          <div className="res-modal-actions">
            <button type="button" className="res-btn res-btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
            <button type="submit" className="res-btn res-btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </li>
    );
  }

  const sub =
    it.kind === "link" ? domainOf(it.url)
      : it.kind === "note" ? (it.title ? it.text.split("\n")[0] : it.text.split("\n").slice(1).join(" ")).slice(0, 140)
        : [it.fileName, fmtSize(it.size)].filter(Boolean).join(", ");

  return (
    <li className={`res-item${it.pinned ? " is-pinned" : ""}`}>
      <ItemGlyph it={it} />
      <div className="res-item-main">
        <div className="res-item-title">
          {it.kind === "note" ? (
            <span>{itemTitle(it)}</span>
          ) : (
            <a href={it.url} target="_blank" rel="noopener noreferrer">{itemTitle(it)}</a>
          )}
          {it.pinned && <IconStar size={13} className="res-pin-mark" title="Pinned" />}
        </div>
        {sub && <div className="res-item-sub">{sub}</div>}
        {it.kind !== "note" && it.text && <div className="res-item-note">{it.text}</div>}
        {showFolder && (
          <button type="button" className={`res-folder-tag paint-${folder.color}`} onClick={() => onOpenFolder(folder._id)}>
            <IconFolder size={12} /> {folder.name}
          </button>
        )}
      </div>
      <div className="res-item-actions">
        <button type="button" className="res-act" onClick={copy} aria-label={`Copy ${itemTitle(it)}`}>
          <IconCopy /> <span>Copy</span>
        </button>
        <a className="res-act res-act-wa" href={`https://wa.me/?text=${encodeURIComponent(shareText(it))}`} target="_blank" rel="noopener noreferrer" aria-label={`Send ${itemTitle(it)} on WhatsApp`}>
          <IconWhatsApp /> <span>WhatsApp</span>
        </a>
        <div className="res-menu-wrap" ref={menuRef}>
          <button type="button" className="res-act res-act-icon" onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu} aria-label="More actions">
            <IconMoreVertical />
          </button>
          {menu && (
            <div className="res-menu" role="menu">
              {it.kind !== "note" && (
                <a role="menuitem" href={it.url} target="_blank" rel="noopener noreferrer" onClick={() => setMenu(false)}>
                  <IconExternal /> Open
                </a>
              )}
              <button type="button" role="menuitem" onClick={() => { setMenu(false); update({ pinned: !it.pinned }, it.pinned ? "Unpinned" : "Pinned to the top of the library"); }}>
                <IconStar /> {it.pinned ? "Unpin" : "Pin for quick send"}
              </button>
              <button type="button" role="menuitem" onClick={() => { setMenu(false); setDraft({ title: it.title, url: it.url, text: it.text }); setEditing(true); }}>
                <IconEdit /> Edit
              </button>
              <button type="button" role="menuitem" className="danger" onClick={remove}>
                <IconTrash /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
};

// ---------------- composer: paste a link, type a note, upload ----------------
const Composer = ({ folder, onChange, onFiles }) => {
  const [value, setValue] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const taRef = useRef(null);
  const trimmed = value.trim();
  const link = isUrl(trimmed);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`;
  }, [value]);

  const add = async () => {
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const body = link ? { url: trimmed, title, by: me() } : { text: value, title, by: me() };
      const r = await axios.post(`${API}/${folder._id}/items`, body);
      onChange(r.data);
      setValue("");
      setTitle("");
      notify.success(link ? "Link added" : "Note added");
      taRef.current?.focus();
    } catch (err) {
      notify.error(errMsg(err, "Couldn't add it. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const onPaste = (e) => {
    const files = Array.from(e.clipboardData?.files || []);
    if (files.length) {
      e.preventDefault();
      onFiles(files);
    }
  };

  return (
    <div className="res-composer">
      <div className="res-composer-input">
        <span className={`res-composer-kind${link ? " is-link" : ""}`} aria-hidden="true">
          {link ? <IconLink /> : <IconNote />}
        </span>
        <textarea
          ref={taRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onPaste={onPaste}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey || (link && !e.shiftKey))) {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Paste a link, or type a note…"
          aria-label={`Add a link or note to ${folder.name}`}
        />
      </div>
      {trimmed && (
        <input
          className="res-composer-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={link ? "Title (optional, we'll use the page's title)" : "Title (optional)"}
          aria-label="Title"
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
        />
      )}
      <div className="res-composer-bar">
        <button type="button" className="res-btn res-btn-ghost" onClick={() => fileRef.current?.click()}>
          <IconUpload /> Upload files
        </button>
        <span className="res-composer-hint">or drop files and links anywhere in this folder</span>
        <button type="button" className="res-btn res-btn-primary" onClick={add} disabled={!trimmed || busy}>
          {busy ? "Adding…" : link ? "Add link" : "Add note"}
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            onFiles(Array.from(e.target.files || []));
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
};

// ---------------- folder view ----------------
const FolderView = ({ folder, onBack, onChange, onEdit, onDeleted }) => {
  const [kind, setKind] = useState("all");
  const [uploads, setUploads] = useState([]); // {id, name, pct, error}
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const uploadFiles = useCallback(async (files) => {
    for (const file of files) {
      const id = `${file.name}-${file.size}-${Math.random()}`;
      if (file.size > MAX_MB * 1024 * 1024) {
        notify.error(`${file.name} is over ${MAX_MB} MB`);
        continue;
      }
      setUploads((u) => [...u, { id, name: file.name, pct: 0 }]);
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("by", me());
        const r = await axios.post(`${API}/${folder._id}/upload`, fd, {
          onUploadProgress: (p) => p.total && setUploads((u) => u.map((x) => (x.id === id ? { ...x, pct: Math.round((p.loaded / p.total) * 100) } : x))),
        });
        onChange(r.data);
        notify.success(`${file.name} uploaded`);
      } catch (err) {
        notify.error(`${file.name}: ${errMsg(err, "upload failed")}`);
      } finally {
        setUploads((u) => u.filter((x) => x.id !== id));
      }
    }
  }, [folder._id, onChange]);

  const addDroppedLink = async (url) => {
    try {
      const r = await axios.post(`${API}/${folder._id}/items`, { url, by: me() });
      onChange(r.data);
      notify.success("Link added");
    } catch (err) {
      notify.error(errMsg(err, "Couldn't add the link"));
    }
  };

  const onDragEnter = (e) => {
    if (!Array.from(e.dataTransfer?.types || []).some((t) => t === "Files" || t === "text/uri-list" || t === "text/plain")) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };
  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (!dragDepth.current) setDragging(false);
  };
  const onDrop = (e) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length) return uploadFiles(files);
    const text = (e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain") || "").split(/\r?\n/).find((l) => l && !l.startsWith("#"));
    if (text && isUrl(text)) addDroppedLink(text.trim());
    else if (text) notify.info("Only files and links can be dropped. Type notes in the box.");
  };

  const deleteFolder = async () => {
    const n = folder.items.length;
    if (!window.confirm(`Delete the folder "${folder.name}"${n ? ` and its ${n} item${n === 1 ? "" : "s"}` : ""}?`)) return;
    try {
      await axios.delete(`${API}/${folder._id}`);
      notify.success("Folder deleted");
      onDeleted(folder._id);
    } catch (err) {
      notify.error(errMsg(err, "Couldn't delete the folder"));
    }
  };

  const sorted = useMemo(
    () => [...folder.items].sort((a, b) => (b.pinned - a.pinned) || new Date(b.createdAt) - new Date(a.createdAt)),
    [folder.items],
  );
  const shown = kind === "all" ? sorted : sorted.filter((i) => i.kind === kind);
  const counts = KINDS.reduce((acc, k) => ({ ...acc, [k.key]: k.key === "all" ? folder.items.length : folder.items.filter((i) => i.kind === k.key).length }), {});

  return (
    <div
      className={`res-folder-view paint-${folder.color}${dragging ? " is-dragging" : ""}`}
      onDragEnter={onDragEnter}
      onDragOver={(e) => dragging && e.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <button type="button" className="res-back" onClick={onBack}>
        <IconArrowLeft /> All folders
      </button>

      <header className="res-folder-head">
        <span className="res-folder-band" aria-hidden="true" />
        <div className="res-folder-head-text">
          <h2>{folder.name}</h2>
          {folder.description && <p>{folder.description}</p>}
        </div>
        <div className="res-folder-head-actions">
          <button type="button" className="res-btn res-btn-ghost" onClick={onEdit}><IconEdit /> <span>Edit</span></button>
          <button type="button" className="res-btn res-btn-ghost res-btn-danger" onClick={deleteFolder}><IconTrash /> <span>Delete</span></button>
        </div>
      </header>

      <Composer folder={folder} onChange={onChange} onFiles={uploadFiles} />

      {uploads.length > 0 && (
        <ul className="res-uploads" aria-live="polite">
          {uploads.map((u) => (
            <li key={u.id}>
              <span className="res-upload-name">{u.name}</span>
              <span className="res-upload-track"><span style={{ width: `${u.pct}%` }} /></span>
              <span className="res-upload-pct">{u.pct < 100 ? `${u.pct}%` : "Saving…"}</span>
            </li>
          ))}
        </ul>
      )}

      {folder.items.length > 0 && (
        <div className="res-kinds" role="tablist" aria-label="Show">
          {KINDS.filter((k) => k.key === "all" || counts[k.key] > 0).map((k) => (
            <button key={k.key} type="button" role="tab" aria-selected={kind === k.key} className={kind === k.key ? "is-on" : ""} onClick={() => setKind(k.key)}>
              {k.label} <span>{counts[k.key]}</span>
            </button>
          ))}
        </div>
      )}

      {folder.items.length === 0 ? (
        <div className="res-empty">
          <IconUpload size={28} />
          <p><strong>This folder is empty.</strong> Paste a link above, type a note, or drop files here.</p>
        </div>
      ) : (
        <ul className="res-items">
          {shown.map((it) => (
            <ItemRow key={it._id} it={it} folder={folder} onChange={onChange} />
          ))}
        </ul>
      )}

      {dragging && (
        <div className="res-drop" aria-hidden="true">
          <div><IconUpload size={32} /><span>Drop to add to {folder.name}</span></div>
        </div>
      )}
    </div>
  );
};

// ---------------- library (all folders) ----------------
export default function AdminResources() {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [openId, setOpenId] = useState(null);
  const [dialog, setDialog] = useState(null); // { initial? }
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const r = await axios.get(API);
      setFolders(r.data);
    } catch (err) {
      setLoadError("Couldn't load resources. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const replaceFolder = useCallback((f) => {
    setFolders((list) => {
      const rest = list.filter((x) => x._id !== f._id);
      return [f, ...rest];
    });
  }, []);

  const open = folders.find((f) => f._id === openId);
  const q = query.trim().toLowerCase();
  const pinned = useMemo(() => folders.flatMap((f) => f.items.filter((i) => i.pinned).map((it) => ({ it, f }))), [folders]);
  const results = useMemo(() => {
    if (!q) return [];
    return folders.flatMap((f) =>
      f.items
        .filter((it) => [it.title, it.url, it.text, it.fileName].some((v) => String(v || "").toLowerCase().includes(q)))
        .map((it) => ({ it, f })),
    );
  }, [folders, q]);
  const matchingFolders = q ? folders.filter((f) => `${f.name} ${f.description}`.toLowerCase().includes(q)) : folders;

  const dialogEl = dialog && (
    <FolderDialog
      initial={dialog.initial}
      onClose={() => setDialog(null)}
      onSaved={(f) => {
        replaceFolder(f);
        setDialog(null);
        notify.success(dialog.initial ? "Folder saved" : "Folder created");
        if (!dialog.initial) setOpenId(f._id);
      }}
    />
  );

  if (open) {
    return (
      <div className="res-root">
        <FolderView
          folder={open}
          onBack={() => setOpenId(null)}
          onChange={replaceFolder}
          onEdit={() => setDialog({ initial: open })}
          onDeleted={(id) => { setFolders((l) => l.filter((x) => x._id !== id)); setOpenId(null); }}
        />
        {dialogEl}
      </div>
    );
  }

  return (
    <div className="res-root">
      <div className="res-toolbar">
        <label className="res-search">
          <IconSearch />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search links, notes and files" aria-label="Search resources" />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><IconX /></button>
          )}
        </label>
        <button type="button" className="res-btn res-btn-primary" onClick={() => setDialog({})}>
          <IconFolderPlus /> New folder
        </button>
      </div>

      {loading && folders.length === 0 ? (
        <div className="res-folders" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="res-folder-card is-skeleton" />)}
        </div>
      ) : loadError ? (
        <div className="res-empty">
          <p>{loadError}</p>
          <button type="button" className="res-btn res-btn-primary" onClick={load}>Try again</button>
        </div>
      ) : q ? (
        <section aria-label="Search results">
          {matchingFolders.length > 0 && (
            <div className="res-folders res-folders-compact">
              {matchingFolders.map((f) => <FolderCard key={f._id} f={f} onOpen={() => setOpenId(f._id)} />)}
            </div>
          )}
          {results.length > 0 ? (
            <ul className="res-items">
              {results.map(({ it, f }) => (
                <ItemRow key={it._id} it={it} folder={f} showFolder onChange={replaceFolder} onOpenFolder={setOpenId} />
              ))}
            </ul>
          ) : (
            matchingFolders.length === 0 && <div className="res-empty"><p>Nothing matches "{query}".</p></div>
          )}
        </section>
      ) : folders.length === 0 ? (
        <div className="res-empty res-empty-start">
          <IconFolder size={32} />
          <p><strong>Keep the links you send parents in one place.</strong></p>
          <p>Make a folder such as "Registration" or "Art materials", then paste links, type notes or drop files into it.</p>
          <button type="button" className="res-btn res-btn-primary" onClick={() => setDialog({})}><IconFolderPlus /> Create the first folder</button>
        </div>
      ) : (
        <>
          {pinned.length > 0 && (
            <section className="res-pinned" aria-labelledby="res-pinned-title">
              <h3 id="res-pinned-title"><IconStar /> Pinned for quick send</h3>
              <ul className="res-items">
                {pinned.map(({ it, f }) => (
                  <ItemRow key={it._id} it={it} folder={f} showFolder onChange={replaceFolder} onOpenFolder={setOpenId} />
                ))}
              </ul>
            </section>
          )}
          <section aria-label="Folders">
            <div className="res-folders">
              {folders.map((f) => <FolderCard key={f._id} f={f} onOpen={() => setOpenId(f._id)} />)}
            </div>
          </section>
        </>
      )}
      {dialogEl}
    </div>
  );
}

const FolderCard = ({ f, onOpen }) => {
  const images = f.items.filter((i) => i.kind === "image").slice(0, 3);
  return (
    <button type="button" className={`res-folder-card paint-${f.color}`} onClick={onOpen}>
      <span className="res-folder-band" aria-hidden="true" />
      <span className="res-folder-body">
        <span className="res-folder-name">{f.name}</span>
        {f.description && <span className="res-folder-desc">{f.description}</span>}
        <span className="res-folder-meta">
          <span>{countLabel(f.items)}</span>
          <span>Updated {fmtWhen(f.updatedAt)}</span>
        </span>
      </span>
      {images.length > 0 && (
        <span className="res-folder-peek" aria-hidden="true">
          {images.map((i) => <img key={i._id} src={i.url} alt="" loading="lazy" />)}
        </span>
      )}
    </button>
  );
};
