// Admin › Academic Resources (mounted at /api/resources).
// Folders hold links, notes, images and files the academy sends to parents.
// Uploads go to Cloudinary (folder "art-academy-resources"); images and PDFs as
// "auto", anything else (docx, xlsx, zip…) as "raw" so the file keeps its extension.
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const cloudinary = require("cloudinary").v2; // configured once in index.js
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const ResourceFolder = require("./models/ResourceFolder");

const router = express.Router();
const MAX_MB = 10; // Cloudinary free plan limit for raw files
const COLORS = ["cobalt", "viridian", "cadmium", "alizarin", "violet", "graphite"];

const slug = (s) => String(s || "file").toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "file";
const extOf = (name) => (/\.([a-z0-9]{1,8})$/i.exec(name || "") || [])[1]?.toLowerCase() || "";

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isMedia = /^image\//.test(file.mimetype) || file.mimetype === "application/pdf" || /^video\//.test(file.mimetype);
    const ext = extOf(file.originalname);
    const base = `${slug(file.originalname)}-${Date.now().toString(36)}`;
    return isMedia
      ? { folder: "art-academy-resources", resource_type: "auto", public_id: base }
      : { folder: "art-academy-resources", resource_type: "raw", public_id: ext ? `${base}.${ext}` : base };
  },
});
const upload = multer({ storage, limits: { fileSize: MAX_MB * 1024 * 1024 } });

const validId = (id) => mongoose.Types.ObjectId.isValid(id);
const findFolder = async (req, res) => {
  if (!validId(req.params.id)) { res.status(404).json({ message: "Folder not found" }); return null; }
  const folder = await ResourceFolder.findById(req.params.id);
  if (!folder) res.status(404).json({ message: "Folder not found" });
  return folder;
};
const isUrl = (s) => /^https?:\/\/\S+$/i.test(String(s || "").trim());

// Best-effort page title for a pasted link (4 s budget; falls back to the domain).
const fetchTitle = async (url) => {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (resource-library)" } });
    clearTimeout(t);
    if (!r.ok || !/text\/html/i.test(r.headers.get("content-type") || "")) return "";
    const html = (await r.text()).slice(0, 200000);
    const og = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html);
    const tt = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
    const raw = (og?.[1] || tt?.[1] || "").trim();
    return raw
      .replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .slice(0, 140);
  } catch {
    return "";
  }
};

// ---- folders ----
router.get("/", async (req, res) => {
  try {
    res.json(await ResourceFolder.find().sort({ updatedAt: -1 }));
  } catch (err) {
    res.status(500).json({ message: "Couldn't load resources" });
  }
});

router.post("/", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Give the folder a name" });
    const folder = await ResourceFolder.create({
      name,
      description: String(req.body.description || "").trim(),
      color: COLORS.includes(req.body.color) ? req.body.color : "cobalt",
      createdBy: req.body.by || "",
    });
    res.json(folder);
  } catch (err) {
    res.status(500).json({ message: "Couldn't create the folder" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const folder = await findFolder(req, res);
    if (!folder) return;
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ message: "Give the folder a name" });
      folder.name = name;
    }
    if (req.body.description !== undefined) folder.description = String(req.body.description).trim();
    if (COLORS.includes(req.body.color)) folder.color = req.body.color;
    await folder.save();
    res.json(folder);
  } catch (err) {
    res.status(500).json({ message: "Couldn't save the folder" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ message: "Folder not found" });
    await ResourceFolder.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Couldn't delete the folder" });
  }
});

// ---- items ----
// JSON: { url, title, text } → link; { text, title } → note
router.post("/:id/items", async (req, res) => {
  try {
    const folder = await findFolder(req, res);
    if (!folder) return;
    const url = String(req.body.url || "").trim();
    const text = String(req.body.text || "");
    let title = String(req.body.title || "").trim();
    if (url) {
      if (!isUrl(url)) return res.status(400).json({ message: "Links must start with http:// or https://" });
      if (!title) title = await fetchTitle(url);
      folder.items.push({ kind: "link", url, title, text: text.trim(), createdBy: req.body.by || "" });
    } else {
      if (!text.trim()) return res.status(400).json({ message: "Type a note or paste a link" });
      folder.items.push({ kind: "note", text, title, createdBy: req.body.by || "" });
    }
    await folder.save();
    res.json(folder);
  } catch (err) {
    res.status(500).json({ message: "Couldn't add it" });
  }
});

router.post("/:id/upload", async (req, res) => {
  // Check the folder first so nothing reaches Cloudinary for a missing folder
  let exists = false;
  try {
    exists = validId(req.params.id) && !!(await ResourceFolder.exists({ _id: req.params.id }));
  } catch {
    exists = false;
  }
  if (!exists) return res.status(404).json({ message: "Folder not found" });

  upload.single("file")(req, res, async (upErr) => {
    if (upErr) {
      const tooBig = upErr.code === "LIMIT_FILE_SIZE";
      if (!tooBig) console.error("Resource upload error:", upErr);
      return res.status(400).json({ message: tooBig ? `Files can be up to ${MAX_MB} MB` : "Upload failed. Try again." });
    }
    try {
      if (!req.file) return res.status(400).json({ message: "Choose a file to upload" });
      const folder = await findFolder(req, res);
      if (!folder) return;
      const f = req.file;
      folder.items.push({
        kind: /^image\//.test(f.mimetype) ? "image" : "file",
        title: String(req.body.title || "").trim() || f.originalname.replace(/\.[^.]+$/, ""),
        url: f.path,
        fileName: f.originalname,
        mimeType: f.mimetype,
        size: f.size || 0,
        publicId: f.filename || "",
        createdBy: req.body.by || "",
      });
      await folder.save();
      res.json(folder);
    } catch (err) {
      console.error("Resource upload error:", err);
      res.status(500).json({ message: "Upload failed. Try again." });
    }
  });
});

router.put("/:id/items/:itemId", async (req, res) => {
  try {
    const folder = await findFolder(req, res);
    if (!folder) return;
    const item = folder.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: "Item not found" });
    const { title, url, text, pinned } = req.body;
    if (title !== undefined) item.title = String(title).trim();
    if (text !== undefined) item.text = String(text);
    if (url !== undefined && item.kind === "link") {
      if (!isUrl(url)) return res.status(400).json({ message: "Links must start with http:// or https://" });
      item.url = String(url).trim();
    }
    if (pinned !== undefined) item.pinned = !!pinned;
    await folder.save();
    res.json(folder);
  } catch (err) {
    res.status(500).json({ message: "Couldn't save the change" });
  }
});

router.delete("/:id/items/:itemId", async (req, res) => {
  try {
    const folder = await findFolder(req, res);
    if (!folder) return;
    const item = folder.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: "Item not found" });
    item.deleteOne();
    await folder.save();
    res.json(folder);
  } catch (err) {
    res.status(500).json({ message: "Couldn't delete it" });
  }
});

module.exports = router;
