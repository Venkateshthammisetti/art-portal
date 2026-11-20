// Sends the signed-in user's login pass with every call to our API, so the
// server can tell who is calling. (Step 1 of protecting the API: the server only
// watches for now and refuses nothing.) Older sessions without the new pass send
// the chatbot pass they already have. The server renews passes that are running
// out and sends the new one back in the X-Auth-Token header; it's saved here so
// people who stay logged in for weeks keep a valid pass.
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

// Keep a renewed pass the server sent back (only for the person signed in on this device)
const passOwner = (token) => {
  try {
    const payload = String(token).split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload + "===".slice((payload.length + 3) % 4))).uid || null;
  } catch {
    return null;
  }
};
const keepRenewedPass = (res) => {
  const token = res?.headers?.["x-auth-token"];
  if (!token || !String(res?.config?.url || "").includes(API_HOST)) return;
  try {
    const raw = localStorage.getItem("user");
    const u = raw ? JSON.parse(raw) : null;
    if (!u || String(u._id) !== String(passOwner(token)) || u.authToken === token) return;
    localStorage.setItem("user", JSON.stringify({ ...u, authToken: token }));
  } catch { /* storage unavailable: the next login gives a new pass */ }
};
axios.interceptors.response.use(
  (res) => { keepRenewedPass(res); return res; },
  (err) => { keepRenewedPass(err?.response); return Promise.reject(err); },
);
