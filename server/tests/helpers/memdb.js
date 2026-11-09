// In-memory stand-in for MongoDB, so route modules and the scheduler can be
// tested without a database (and never against the real one).
//
//   const t = require("./helpers/memdb");      // call before requiring server code
//   const user = t.add(User, { role: "parent", ... });
//   const api = await t.serve((app) => app.use("/api", require("../checkins")));
//   const r = await api("POST", "/api/checkins/123", { by: "..." });
//   t.pushes()                                   // web-push messages sent so far
//
// Only the query features the server code uses are supported: equality,
// $in/$nin/$ne/$gt/$gte/$lt/$lte/$exists/$regex/$or, dotted paths (including
// "list.0"), populate/select/lean/sort/limit, and simple $set/$push/$pull/$inc updates.
process.env.VAPID_PUBLIC_KEY ||= "test-public";
process.env.VAPID_PRIVATE_KEY ||= "test-private";

const path = require("path");
const mongoose = require("mongoose");
const webpush = require("web-push");
const express = require("express");

const sent = [];
webpush.setVapidDetails = () => {};
webpush.sendNotification = async (sub, payload) => {
  sent.push({ to: sub && sub.who, ...JSON.parse(payload) });
  return { statusCode: 201 };
};

const stores = new Map(); // modelName -> docs[]
const store = (M) => {
  if (!stores.has(M.modelName)) stores.set(M.modelName, []);
  return stores.get(M.modelName);
};

const plain = (d) => (d && typeof d.toObject === "function" ? d.toObject() : d);
const same = (a, b) => String(a) === String(b);

// Value(s) at a dotted path; arrays fan out ("schedule.day" -> every day)
const valuesAt = (doc, key) => {
  let cur = [plain(doc)];
  for (const part of key.split(".")) {
    const next = [];
    for (const v of cur) {
      if (v == null) continue;
      if (Array.isArray(v) && !/^\d+$/.test(part)) v.forEach((x) => next.push(x == null ? x : plain(x)[part]));
      else next.push(plain(v)[part]);
    }
    cur = next;
  }
  return cur.flatMap((v) => (Array.isArray(v) ? (v.length ? v : [undefined]) : [v]));
};

const cmp = (a, b) => {
  if (a instanceof Date || b instanceof Date) return new Date(a) - new Date(b);
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
};

const isOperatorObject = (v) =>
  v && typeof v === "object" && !(v instanceof Date) && !(v instanceof RegExp) && !mongoose.isValidObjectId(v) &&
  Object.keys(v).length > 0 && Object.keys(v).every((k) => k.startsWith("$"));

const testValue = (vals, cond) => {
  if (cond instanceof RegExp) return vals.some((v) => v != null && cond.test(String(v)));
  if (!isOperatorObject(cond)) {
    if (cond === null) return vals.every((v) => v == null);
    return vals.some((v) => v != null && same(v, cond));
  }
  return Object.entries(cond).every(([op, arg]) => {
    const defined = vals.filter((v) => v !== undefined && v !== null);
    switch (op) {
      case "$in": return arg.some((a) => (a === null ? vals.some((v) => v == null) : defined.some((v) => same(v, a))));
      case "$nin": return !arg.some((a) => defined.some((v) => same(v, a)));
      case "$ne": return arg === null ? defined.length > 0 : !defined.some((v) => same(v, arg));
      case "$eq": return defined.some((v) => same(v, arg));
      case "$gt": return defined.some((v) => cmp(v, arg) > 0);
      case "$gte": return defined.some((v) => cmp(v, arg) >= 0);
      case "$lt": return defined.some((v) => cmp(v, arg) < 0);
      case "$lte": return defined.some((v) => cmp(v, arg) <= 0);
      case "$exists": return arg ? defined.length > 0 : defined.length === 0;
      case "$regex": {
        const re = arg instanceof RegExp ? arg : new RegExp(arg, cond.$options || "");
        return defined.some((v) => re.test(String(v)));
      }
      case "$options": return true;
      default: throw new Error(`memdb: unsupported operator ${op}`);
    }
  });
};

const matches = (doc, filter = {}) =>
  Object.entries(filter || {}).every(([k, v]) => {
    if (k === "$or") return v.some((f) => matches(doc, f));
    if (k === "$and") return v.every((f) => matches(doc, f));
    return testValue(valuesAt(doc, k), v);
  });

// Model a field refers to (for populate)
const refModel = (M, field) => {
  const p = M.schema.path(field);
  const ref = p && (p.options?.ref || p.caster?.options?.ref || p.options?.type?.[0]?.ref);
  return ref ? mongoose.model(ref) : null;
};

const pickFields = (obj, fields) => {
  if (!fields || typeof fields !== "string") return obj;
  const list = fields.split(/\s+/).filter(Boolean);
  if (list.every((f) => f.startsWith("-"))) {
    const out = { ...obj };
    list.forEach((f) => delete out[f.slice(1)]);
    return out;
  }
  const out = { _id: obj._id };
  list.forEach((f) => { if (f in obj) out[f] = obj[f]; });
  return out;
};

const query = (M, run) => {
  const pops = [];
  let sortBy = null, lim = null, isLean = false, fields = null;
  const q = {
    populate(f, sel) {
      if (typeof f === "object" && f) pops.push({ path: f.path, select: f.select });
      else pops.push({ path: f, select: sel });
      return q;
    },
    select(f) { fields = f; return q; },
    lean() { isLean = true; return q; },
    sort(s) { sortBy = s; return q; },
    limit(n) { lim = n; return q; },
    exec() { return q.then((x) => x); },
    then(resolve, reject) {
      return Promise.resolve().then(() => {
        const raw = run();
        const single = !Array.isArray(raw);
        let list = single ? (raw ? [raw] : []) : [...raw];
        if (sortBy) {
          const entries = typeof sortBy === "string" ? [[sortBy.replace(/^-/, ""), sortBy.startsWith("-") ? -1 : 1]] : Object.entries(sortBy);
          list.sort((a, b) => {
            for (const [k, dir] of entries) {
              const c = cmp(valuesAt(a, k)[0], valuesAt(b, k)[0]);
              if (c) return c * (dir < 0 ? -1 : 1);
            }
            return 0;
          });
        }
        if (lim) list = list.slice(0, lim);
        if (isLean || pops.length) {
          list = list.map((d) => {
            let o = pickFields(plain(d), isLean ? fields : null);
            for (const { path: f, select } of pops) {
              const R = refModel(M, f);
              if (!R) continue;
              const look = (id) => {
                const found = store(R).find((x) => same(x._id, id));
                return found ? pickFields(plain(found), select) : id;
              };
              o = { ...o, [f]: Array.isArray(o[f]) ? o[f].map(look) : o[f] != null ? look(o[f]) : o[f] };
            }
            return o;
          });
        }
        return single ? list[0] || null : list;
      }).then(resolve, reject);
    },
  };
  return q;
};

const applyUpdate = (doc, update) => {
  const ops = Object.keys(update).some((k) => k.startsWith("$")) ? update : { $set: update };
  for (const [k, v] of Object.entries(ops.$set || {})) doc.set(k, v);
  for (const [k, v] of Object.entries(ops.$setOnInsert || {})) if (doc.isNew) doc.set(k, v);
  for (const [k, v] of Object.entries(ops.$inc || {})) doc.set(k, (Number(doc.get(k)) || 0) + v);
  for (const [k, v] of Object.entries(ops.$push || {})) {
    const arr = doc.get(k) || [];
    (v && v.$each ? v.$each : [v]).forEach((x) => arr.push(x));
    doc.set(k, arr);
  }
  for (const [k, v] of Object.entries(ops.$addToSet || {})) {
    const arr = doc.get(k) || [];
    (v && v.$each ? v.$each : [v]).forEach((x) => { if (!arr.some((y) => same(y, x))) arr.push(x); });
    doc.set(k, arr);
  }
  for (const [k, v] of Object.entries(ops.$pull || {})) {
    const arr = doc.get(k) || [];
    doc.set(k, arr.filter((x) => (isOperatorObject(v) || (v && typeof v === "object" && !mongoose.isValidObjectId(v)) ? !matches(x, v) : !same(x, v))));
  }
  for (const k of Object.keys(ops.$unset || {})) doc.set(k, undefined);
};

const wire = (M) => {
  const docs = () => store(M);
  M.find = (f) => query(M, () => docs().filter((d) => matches(d, f)));
  M.findOne = (f) => query(M, () => docs().find((d) => matches(d, f)) || null);
  M.findById = (id) => query(M, () => docs().find((d) => same(d._id, id)) || null);
  M.exists = async (f) => (docs().some((d) => matches(d, f)) ? { _id: docs().find((d) => matches(d, f))._id } : null);
  M.countDocuments = async (f) => docs().filter((d) => matches(d, f)).length;
  M.create = async (data) => (Array.isArray(data) ? Promise.all(data.map((x) => new M(x).save())) : new M(data).save());
  M.insertMany = async (list) => Promise.all(list.map((x) => new M(x).save()));
  const findAndUpdate = (pick) => (f, update = {}, opts = {}) => query(M, () => {
    let doc = pick(f);
    if (!doc && opts.upsert) {
      doc = new M(Object.fromEntries(Object.entries(f || {}).filter(([k, v]) => !k.startsWith("$") && !isOperatorObject(v))));
      applyUpdate(doc, update);
      docs().push(doc);
    } else if (doc) applyUpdate(doc, update);
    return doc || null;
  });
  M.findOneAndUpdate = findAndUpdate((f) => docs().find((d) => matches(d, f)));
  M.findByIdAndUpdate = findAndUpdate((id) => docs().find((d) => same(d._id, id)));
  M.findByIdAndDelete = async (id) => {
    const doc = docs().find((d) => same(d._id, id));
    stores.set(M.modelName, docs().filter((d) => d !== doc));
    return doc || null;
  };
  M.updateOne = async (f, update, opts = {}) => {
    const doc = docs().find((d) => matches(d, f));
    if (doc) applyUpdate(doc, update);
    else if (opts.upsert) await M.findOneAndUpdate(f, update, { upsert: true });
    return { matchedCount: doc ? 1 : 0, modifiedCount: doc ? 1 : 0 };
  };
  M.updateMany = async (f, update) => {
    const list = docs().filter((d) => matches(d, f));
    list.forEach((d) => applyUpdate(d, update));
    return { matchedCount: list.length, modifiedCount: list.length };
  };
  M.deleteOne = async (f) => {
    const doc = docs().find((d) => matches(d, f));
    stores.set(M.modelName, docs().filter((d) => d !== doc));
    return { deletedCount: doc ? 1 : 0 };
  };
  M.deleteMany = async (f) => {
    const before = docs().length;
    stores.set(M.modelName, docs().filter((d) => !matches(d, f)));
    return { deletedCount: before - docs().length };
  };
  M.bulkWrite = async (ops) => {
    for (const op of ops) {
      if (op.updateOne) await M.updateOne(op.updateOne.filter, op.updateOne.update, { upsert: op.updateOne.upsert });
      else if (op.insertOne) await M.create(op.insertOne.document);
      else if (op.deleteOne) await M.deleteOne(op.deleteOne.filter);
    }
    return { ok: 1 };
  };
  M.prototype.save = async function save() {
    const err = this.validateSync();
    if (err) throw err;
    if (!docs().includes(this)) docs().push(this);
    this.isNew = false;
    return this;
  };
  M.prototype.deleteOne = async function deleteOne() {
    stores.set(M.modelName, docs().filter((d) => d !== this));
    return { deletedCount: 1 };
  };
};

// Wire every model file in server/models
const modelsDir = path.join(__dirname, "..", "..", "models");
const models = {};
for (const f of require("fs").readdirSync(modelsDir)) {
  if (!f.endsWith(".js")) continue;
  const M = require(path.join(modelsDir, f));
  if (M && M.modelName) { wire(M); models[M.modelName] = M; }
}

const add = (M, data) => {
  const doc = new M(data);
  doc.isNew = false;
  store(M).push(doc);
  return doc;
};
const all = (M) => store(M);
const reset = () => { stores.clear(); sent.length = 0; };

// Start an Express app on a free port; returns api(method, url, body)
const servers = [];
const serve = (mount) => new Promise((resolve) => {
  const app = express();
  app.use(express.json());
  mount(app);
  const srv = app.listen(0, () => {
    servers.push(srv);
    const base = `http://127.0.0.1:${srv.address().port}`;
    resolve(async (method, url, body, headers = {}) => {
      const r = await fetch(base + url, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await r.text();
      let json = null;
      try { json = JSON.parse(text); } catch { /* not JSON */ }
      return { status: r.status, json, text };
    });
  });
});
const closeAll = () => Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r))));

// Dates in IST, as the server uses them
const IST_MS = 330 * 60000;
const istNow = () => new Date(Date.now() + IST_MS);
const dayKey = (offsetDays = 0) => new Date(istNow().getTime() + offsetDays * 86400000).toISOString().slice(0, 10);
const monthKey = (offsetMonths = 0) => {
  const d = istNow();
  const t = d.getUTCFullYear() * 12 + d.getUTCMonth() + offsetMonths;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};
// "HH:MM" IST, `min` minutes from now
const istTime = (min = 0) => {
  const t = new Date(istNow().getTime() + min * 60000);
  return `${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`;
};
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const istDayName = (offsetDays = 0) => DAYS[new Date(istNow().getTime() + offsetDays * 86400000).getUTCDay()];
// True when "now + min" lands on another IST day (tests using class times skip then)
const crossesMidnight = (...mins) =>
  mins.some((min) => new Date(istNow().getTime() + min * 60000).toISOString().slice(0, 10) !== dayKey(0));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = {
  models, add, all, reset, serve, closeAll,
  pushes: () => sent.splice(0),
  dayKey, monthKey, istTime, istDayName, crossesMidnight, wait,
};
