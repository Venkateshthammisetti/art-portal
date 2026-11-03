// Ask Cloudinary for a resized copy of an uploaded image instead of the full
// original: `c_limit` never upscales, `q_auto` / `f_auto` pick the lightest
// quality and format (WebP/AVIF) the device supports. Gallery tiles load a small
// copy; the viewer loads a screen-sized one. Non-Cloudinary URLs, and URLs that
// already carry a transformation, are returned unchanged. Callers fall back to
// the original URL if a resized copy ever fails to load.
const UPLOAD_MARKER = "/image/upload/";

export const cldUrl = (url, width) => {
  if (!url || typeof url !== "string" || !url.includes("res.cloudinary.com")) return url;
  const at = url.indexOf(UPLOAD_MARKER);
  if (at === -1) return url;
  const head = url.slice(0, at + UPLOAD_MARKER.length);
  const rest = url.slice(at + UPLOAD_MARKER.length);
  // First path segment is either the version ("v1712345678/") or a transformation
  // ("w_600,c_limit/"); leave already-transformed URLs alone.
  if (!/^v\d+\//.test(rest) && /^[a-z]{1,3}_[^/]*\//.test(rest)) return url;
  return `${head}c_limit,w_${width},q_auto,f_auto/${rest}`;
};

export const THUMB_WIDTH = 600; // grid tiles (2–5 per row, sharp on 3x phones)
export const VIEW_WIDTH = 1800; // full-screen viewer
