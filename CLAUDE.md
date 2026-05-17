# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend (client/)
```bash
cd client && npm start        # Dev server on port 3000
cd client && npm run build    # Production build (outputs to client/build/)
cd client && npm test         # Jest in interactive watch mode
```

### Backend (server/)
```bash
cd server && node index.js         # Start server (port 5000 by default)
cd server && npx nodemon index.js  # Dev with auto-restart
```

There are no lint scripts. The root `package.json` has no scripts. The only test file is the CRA boilerplate `client/src/App.test.js`.

## Architecture

A full-stack art academy management portal:
- **Frontend:** React 19 (Create React App) at `client/`
- **Backend:** Express 5 REST API at `server/`
- **Database:** MongoDB Atlas via Mongoose
- **File Storage:** Cloudinary (images + PDF reports)
- **Deployment:** Frontend on Netlify, backend on Render, DB on MongoDB Atlas

### Frontend Structure

[client/src/App.js](client/src/App.js) handles authentication state and routes to one of three role-based dashboards in [client/src/components/](client/src/components/):

| Component | Approx. lines | Role |
|---|---|---|
| `AdminDashboard.js` | ~5800 | Manage users, classes, attendance, fees, gallery |
| `TeacherDashboard.js` | ~2900 | Mark attendance, upload artwork, submit feedback |
| `ParentDashboard.js` | ~2200 | View schedule, reports, attendance, fees, gallery |
| `Login.js` | — | Login form |
| `SplashScreen.js` | — | Onboarding |

Each dashboard is one large component with tabbed navigation, using React Hooks (`useState`, `useEffect`, `useRef`, `useCallback`) for all state. No global state library (Redux etc.) is used. Session state is persisted in `localStorage` under the `user` key.

`App.js` includes a safety check that auto-logs-out if `user._id` or `user.role` is missing — this guards against corrupted localStorage state.

### Backend Structure

[server/index.js](server/index.js) is a monolithic Express server (~800 lines) containing all ~40 route definitions plus Cloudinary, Multer, web-push, and Nodemailer configuration. There is no route splitting into separate files.

[server/scheduler.js](server/scheduler.js) registers two `node-cron` jobs:
- **Fee reminders** — fires daily at 10:00 AM, but only sends notifications on days `1, 5, 10, 15, 20, 25, 30` of each month (skips students with a pass for the current month or who have already paid).
- **Teacher month-end reminders** — fires daily at 9:00 AM, but only sends on the last day, 1 day before, and 3 days before month-end.

**Models** in [server/models/](server/models/): `User`, `Class`, `Attendance`, `Feedback`, `Artwork`.

### Key Data Relationships

- A `Class` has one `teacher` (User ref) and many `students` (User refs); also stores its own `schedule[]` of `{day, time, link}` slots.
- `User.assignedClass` (Class ref) is the source-of-truth pointer for student-to-class mapping. The `Class.students[]` array is kept in sync but should be treated as a denormalized cache.
- `POST /api/classes/:id/assign` ([server/index.js:241](server/index.js#L241)) reconciles assignments by reading `User.assignedClass` first, removing students no longer in the new selection, pulling moved students out of their previous class's `students[]`, then updating both sides. When editing, preserve this two-way sync.
- `Attendance` has a unique compound index on `[date, studentId, classId]` to prevent duplicate records. Writes use `bulkWrite` with `upsert: true`.
- `User.payments[]` holds fee history with `{month: "YYYY-MM", status, amount, paidDate}`. Setting status to `Pending` deletes the entry rather than updating it ([server/index.js:387](server/index.js#L387)).
- `User.passes[]` records months where the fee is waived. Marking a pass also removes any existing payment record for that month ([server/index.js:412](server/index.js#L412)). The fee-reminder cron skips students with a pass for the current month.
- Fee-history calculations in dashboards start from `User.registeredDate` forward, not from `joiningDate`.

### Backend ↔ Frontend wiring

- Production backend: `https://art-portal-7n6r.onrender.com`
- This URL is **hardcoded inline at every `axios` / `fetch` call site** across the dashboards — there is no shared constant. When changing the backend URL, search-and-replace across all four files in [client/src/](client/src/) (`App.js` plus the three dashboards).
- The server pings `/ping` on itself every 10 minutes to prevent Render free-tier cold starts ([server/index.js:783](server/index.js#L783)).

### File Uploads

- Artwork images and PDF feedback reports upload directly to Cloudinary via Multer + `multer-storage-cloudinary` (folder `art-academy-reports`, `resource_type: "auto"` so PDFs and images are both accepted).
- The frontend compresses images client-side to ≤0.3 MB with `browser-image-compression` before upload.
- `Artwork.imageUrl` and `Feedback.reportFile` store the Cloudinary URL returned in `req.file.path`.
- Deleting an `Artwork` row only removes the DB record; the Cloudinary asset is intentionally left in place ([server/index.js:692](server/index.js#L692)).

### Push Notifications

- Web Push API with VAPID keys from `server/.env`.
- Subscriptions saved to `User.pushSubscription`; the service worker is [client/public/sw.js](client/public/sw.js).
- Triggered on artwork upload (`/api/notifications/batch-alert`) and by the two cron jobs above.
- Cron jobs handle expired subscriptions: on `statusCode` 404 or 410 they null out `User.pushSubscription`.

## Environment Variables

Backend requires `server/.env`:
```
MONGO_URI=
GMAIL_USER=
GMAIL_PASS=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

If `MONGO_URI` is missing, the server falls back to `mongodb://localhost:27017/art_academy`.

## Known Limitations

- Passwords are stored as plaintext — no hashing.
- No authentication middleware on API routes — all endpoints are publicly accessible.
- Cloudinary credentials are hardcoded in [server/index.js](server/index.js) rather than read from `.env`.
