// Sends the signed-in user's login pass with every call to our API, so the
// server can tell who is calling. (Step 1 of protecting the API: the server only
// watches for now and refuses nothing.) Older sessions without the new pass send
// the chatbot pass they already have; the next login replaces both.
import axios from "axios";

const API_HOST = "onrender.com";
let lastRaw = null;
let lastToken = null;

const currentToken = () => {
  let raw = null;
  try { raw = localStorage.getItem("user"); } catch { return null; }
  if (raw === lastRaw) return lastToken;
  lastRaw = raw;
  try {
    const u = raw ? JSON.parse(raw) : null;
    lastToken = u?.authToken || u?.chatToken || null;
  } catch {
    lastToken = null;
  }
  return lastToken;
};

axios.interceptors.request.use((config) => {
  if (!String(config.url || "").includes(API_HOST)) return config;
  const token = currentToken();
  if (!token) return config;
  const has = typeof config.headers?.has === "function" ? config.headers.has("Authorization") : !!config.headers?.Authorization;
  if (!has) {
    if (typeof config.headers?.set === "function") config.headers.set("Authorization", `Bearer ${token}`);
    else config.headers = { ...(config.headers || {}), Authorization: `Bearer ${token}` };
  }
  return config;
});
