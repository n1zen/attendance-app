# AttendanceApp

A local-first attendance tracker built with **Next.js 16** (App Router), **MongoDB**, and **Tailwind CSS 4**. Users log their attendance by scanning a QR code — that's the whole flow. Admins manage everything from a dashboard.

## How it works

**For members (the scan flow)**

1. Scan the QR code shown on the admin dashboard → opens `/scan`.
2. **First time on a device?** A short form appears: full name, nickname, and group (groups are created by admins). Submitting registers the member, checks them in, and remembers the device for a year.
3. **Every scan after that** checks the member in automatically — zero interaction.
4. On a new phone but already registered? Use the **"I already have an account"** tab to find yourself by nickname.

**For admins**

- `/admin` — dashboard: today's live stats, the check-in list (auto-refreshes), and the big attendance QR code.
- `/admin/members` — add, search, filter, edit, and delete members; per-member attendance history.
- `/admin/groups` — add, rename, and delete groups (deletion is blocked while members still use the group).

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

First-time admin login: **`admin` / `admin123`** — change the password hash or ask for a change-password flow before any real deployment. The default admin is seeded automatically on first login attempt, and a warning is printed to the console.

### Printing/scanning the QR code from phones

Phones must be able to reach your computer. On your local network, run:

```bash
npm run dev:lan   # binds to 0.0.0.0
```

Then open the dashboard via your computer's LAN IP (e.g. `http://192.168.x.x:3000/admin`) — the QR code encodes whatever origin you're viewing it from, so it will point phones at the right address.

## Database

By default the app runs a **local MongoDB via [mongodb-memory-server](https://github.com/typegoose/mongodb-memory-server)** — no installation needed. The data lives in `~/.attendanceapp/db` and survives restarts; the `mongod` binary is downloaded on first run.

> The database directory is intentionally **outside the project folder** so OneDrive (or any sync tool) never touches MongoDB's data files. Override the location with `MONGODB_DB_PATH` if needed.

To use your own MongoDB instead (local or Atlas), set it in `.env.local`:

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/attendanceapp
```

**Troubleshooting — `DBPathInUse` on startup:** if the server was force-killed (e.g. Task Manager) instead of stopped with Ctrl+C, its `mongod` child can survive and hold the database lock; the next start then fails its first request. The app stops `mongod` on normal shutdown, but after a force-kill, end the leftover `mongod` process (look for `mongod-x64-win*` in your process list) and reload — the server starts a fresh instance on the next request.

## Configuration

| Variable            | Where       | Purpose                                          |
| ------------------- | ----------- | ------------------------------------------------ |
| `SESSION_SECRET`    | `.env.local`| Signs admin + device session cookies. Required.  |
| `MONGODB_URI`       | `.env.local`| Optional — override the built-in dev database.   |
| `MONGODB_DB_PATH`   | `.env.local`| Optional — where the local mongod stores data.   |

Generate a new secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> Note: changing `SESSION_SECRET` signs everyone out (admin + devices).

## Scripts

| Command            | What it does                          |
| ------------------ | ------------------------------------- |
| `npm run dev`      | Dev server on localhost:3000          |
| `npm run dev:lan`  | Dev server reachable from LAN devices |
| `npm run build`    | Production build                      |
| `npm run start`    | Serve the production build            |
| `npm run lint`     | ESLint                                |

## Architecture notes

- **Next.js 16 with Cache Components** — but every data-driven page (`/scan`, `/admin`, `/admin/members`, `/admin/groups`, `/admin/members/[id]`) is deliberately a **blocking route** (`export const instant = false` + `connection()`, no `<Suspense>` data holes): it renders fully per request. Two reasons: Next 16.4 could fail to apply streamed-hole swaps on hard loads (pages got stuck on skeletons), and if the database dies mid-request the user gets an honest error page instead of an infinite spinner. Local Mongo is milliseconds fast, so there is nothing to gain from streaming here.
- **Forms use controlled inputs** — React 19 resets uncontrolled forms after *every* server action, including failed ones, which wiped what members typed when validation failed. All action forms keep their values on error (see `src/app/scan/new-user-panel.tsx`).
- **Auth**: signed, HMAC-sha256 session cookies (`src/lib/tokens.ts`). `src/proxy.ts` optimistically gates `/admin/*`; every admin server action re-verifies the session against the database via `requireAdmin()`.
- **Server actions only** — no custom API routes; every action validates its own authorization.
- **Attendance is idempotent per day** — unique index on `(userId, date)`, upsert on check-in; scanning twice the same day never doubles up.
- **Nicknames are unique** (case-insensitive) via a normalized `nicknameKey` field + unique index.
- Light mode throughout (`color-scheme: light` in `globals.css`).

## Project structure

```
src/
  proxy.ts                 # /admin/* gate (optimistic cookie check)
  lib/
    db.ts                  # MongoDB connection (memory-server fallback)
    data.ts                # Queries + serialization
    auth.ts                # Admin session + password hashing (scrypt)
    session.ts             # Cookie read/write helpers
    tokens.ts              # HMAC sign/verify (pure, no Next APIs)
    types.ts               # Shared types (docs + serialized shapes)
    ui.ts                  # Shared Tailwind class strings
  app/
    page.tsx               # Landing
    scan/                  # The one-tap member flow
      page.tsx             #   blocking page (instant = false)
      scan-content.tsx     #   device → member resolution
      checkin-client.tsx   #   auto check-in for known devices
      new-user-panel.tsx   #   register / claim-by-nickname tabs
      actions.ts           #   check-in, register, claim
    admin/
      login/               # username + password
      actions.ts           # groups/members mutations + logout
      (dashboard)/
        page.tsx           # stats + live list + QR code
        members/           # list + [id] history
        groups/            # group management
```
