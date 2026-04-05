# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend (client/)
```bash
cd client && npm start        # Dev server on port 3000
cd client && npm run build    # Production build
cd client && npm test         # Run Jest tests
```

### Backend (server/)
```bash
cd server && node index.js         # Start server
cd server && npx nodemon index.js  # Dev with auto-restart (nodemon installed as devDependency)
```

There are no lint scripts configured. The root `package.json` has no scripts.

## Architecture

This is a full-stack art academy management portal:
- **Frontend:** React 19 (Create React App) at `client/`
- **Backend:** Express 5 REST API at `server/`
- **Database:** MongoDB Atlas via Mongoose
- **File Storage:** Cloudinary (images + PDF reports)
- **Deployment:** Frontend on Netlify, backend on Render, DB on MongoDB Atlas

### Frontend Structure

`client/src/App.js` handles authentication state and routes to one of three role-based dashboards stored in `client/src/components/`:

| Component | Lines | Role |
|---|---|---|
| `AdminDashboard.js` | ~5600 | Manage users, classes, attendance, fees, gallery |
| `TeacherDashboard.js` | ~2600 | Mark attendance, upload artwork, submit feedback |
| `ParentDashboard.js` | ~2100 | View schedule, reports, attendance, fees, gallery |
| `Login.js` | — | Login form |
| `SplashScreen.js` | — | Onboarding |

Each dashboard is a single large component with tabbed navigation, using React Hooks (`useState`, `useEffect`, `useRef`, `useCallback`) for all state. No global state library (Redux etc.) is used. Session state is persisted in `localStorage`.

### Backend Structure

`server/index.js` is a monolithic Express server (~718 lines) containing all ~40 route definitions plus Cloudinary, Multer, and web-push configuration. There is no route splitting into separate files.

`server/scheduler.js` runs a `node-cron` job daily at 10 AM to send fee reminder push notifications.

**Models** in `server/models/`: `User`, `Class`, `Attendance`, `Feedback`, `Artwork`

### Key Data Relationships

- A `Class` has one `teacher` (User ref) and many `students` (User refs)
- `User` has `assignedClass` (Class ref) for student-to-class mapping
- When a student is assigned to a new class via `POST /api/classes/:id/assign`, the server auto-removes them from their previous class
- `Attendance` has a unique compound index on `[date, studentId, classId]` to prevent duplicate records
- Fee history on `User.payments[]` is calculated only from `User.registeredDate` forward

### API Base URL

- Production backend: `https://art-portal-7n6r.onrender.com`
- The frontend reads this from a hardcoded `API_BASE` constant at the top of each dashboard component
- The server pings itself (`/ping`) every 10 minutes to prevent Render cold starts

### File Uploads

- Artwork images and PDF feedback reports are uploaded directly to Cloudinary
- Multer + `multer-storage-cloudinary` handle multipart uploads in the backend
- The frontend compresses images client-side to ≤0.3 MB (`browser-image-compression`) before upload

### Push Notifications

- Uses the Web Push API with VAPID keys stored in `server/.env`
- Subscriptions saved to `User.pushSubscription`
- Triggered on artwork upload and by the daily fee-reminder cron job

## Environment Variables

Backend requires `server/.env`:
```
MONGO_URI=
GMAIL_USER=
GMAIL_PASS=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

## Known Limitations

- Passwords are stored as plaintext — no hashing implemented
- No authentication middleware on API routes — all endpoints are publicly accessible
- Cloudinary credentials are hardcoded in `server/index.js` rather than in `.env`
