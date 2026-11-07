// Shared, short-lived cache for GET /api/users in the Admin dashboard. Every
// Admin tab used to download the whole user list again on each visit; now tabs
// share one copy for 60 s, and any save (POST/PUT/DELETE through axios) clears
// it so the next screen sees fresh data.
import axios from "axios";

const URL = "https://art-portal-7n6r.onrender.com/api/users";
const TTL_MS = 60 * 1000;
let cached = null; // { at, data }
let inflight = null;

const clone = (x) => (typeof structuredClone === "function" ? structuredClone(x) : JSON.parse(JSON.stringify(x)));

export const invalidateUsers = () => { cached = null; };

export const getUsers = ({ force = false } = {}) => {
  if (!force && cached && Date.now() - cached.at < TTL_MS) return Promise.resolve({ data: clone(cached.data) });
  if (!force && inflight) return inflight.then((r) => ({ data: clone(r.data) }));
  inflight = axios.get(URL).then((res) => {
    cached = { at: Date.now(), data: res.data };
    return res;
  }).finally(() => { inflight = null; });
  return inflight.then((r) => ({ data: clone(r.data) }));
};

// Any successful write to the API makes the cached list stale
axios.interceptors.response.use((res) => {
  const m = String(res.config?.method || "get").toLowerCase();
  if (m !== "get" && String(res.config?.url || "").includes("onrender.com")) invalidateUsers();
  return res;
});
