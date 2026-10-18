# AttendanceApp

A simple attendance tracker built with **Next.js 16** (App Router), **SQLite**, and **Tailwind CSS 4**. Members log their attendance by scanning a QR code — that's the whole flow. Admins manage everything from a dashboard.

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

## Tech stack

- **Next.js 16** — App Router, Server Components, server actions (no custom API routes)
- **SQLite** (through the [libSQL](https://github.com/tursodatabase/libSQL) client) — a plain database file locally, a hosted [Turso](https://turso.tech) database when deployed (free tier)
- **Tailwind CSS 4** — light-mode UI

## Local development

There is no database server to install or run — the app creates its SQLite file automatically on first use.

### 1. Configure environment variables

Create a `.env.local` file in the project root:

```bash
SESSION_SECRET=<random 32-byte hex string>
```

Generate the secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`DATABASE_URL` is optional locally (the app defaults to a local SQLite file). Set it if you want a different file location, or to point at a hosted database.

### 2. Run

```bash
npm install
npm run dev        # http://localhost:3000
```

First-time admin login: **`admin` / `admin123`** — the default admin is seeded automatically on first login attempt (with a console warning). **Change it before anyone else uses the app.**

To try the scan flow from your phone on the same network:

```bash
npm run dev:lan    # binds to 0.0.0.0
```

Then open the dashboard via your computer's LAN IP (e.g. `http://192.168.x.x:3000/admin`) — the QR code encodes whatever origin you're viewing it from, so it will point phones at the right address.

## Deploying to Vercel

Vercel's serverless filesystem is ephemeral, so a deployed instance can't rely on a local database file. The standard setup is [Turso](https://turso.tech) — hosted SQLite with a free tier; the same libSQL client works locally and remotely.

1. **Create a Turso database**:

   ```bash
   # sign up at turso.tech, then with the Turso CLI:
   turso db create attendanceapp
   turso db show attendanceapp      # copy the database URL (libsql://...)
   turso db tokens create attendanceapp   # copy the token
   ```

2. **Push the project to GitHub** (or any Git provider).

3. **Import it into Vercel**: [vercel.com/new](https://vercel.com/new) → import the repository. Vercel detects Next.js automatically — no build settings needed.

4. **Set the environment variables** in the Vercel project (**Settings → Environment Variables**):

   | Variable            | Value                                              |
   | ------------------- | -------------------------------------------------- |
   | `SESSION_SECRET`    | a fresh random hex string (see command above)      |
   | `DATABASE_URL`      | your Turso database URL (`libsql://...`)           |
   | `TURSO_AUTH_TOKEN`  | the Turso auth token                               |

5. **Deploy** (pushes to the production branch deploy automatically).

6. **Set up the app**: open `https://<your-project>.vercel.app/admin`, sign in with `admin` / `admin123`, and change the admin password. Create your groups, then leave the dashboard open — the QR code on it encodes the deployment URL, so members scan it straight from their phones.

## Configuration

| Variable           | Where                  | Purpose                                                                 |
| ------------------ | ---------------------- | ----------------------------------------------------------------------- |
| `SESSION_SECRET`   | `.env.local` / Vercel  | Signs admin + device session cookies. **Required.**                     |
| `DATABASE_URL`     | optional / Vercel      | `file:...` path or `libsql://...` URL. Locally defaults to a SQLite file; **required on Vercel.** |
| `TURSO_AUTH_TOKEN` | optional / Vercel      | Auth token when using a hosted Turso database.                          |

> Note: changing `SESSION_SECRET` signs everyone out (admin + devices).

## Scripts

| Command           | What it does                          |
| ----------------- | ------------------------------------- |
| `npm run dev`     | Dev server on localhost:3000          |
| `npm run dev:lan` | Dev server reachable from LAN devices |
| `npm run build`   | Production build                      |
| `npm run start`   | Serve the production build            |
| `npm run lint`    | ESLint                                |

## Architecture notes

- **Blocking routes for data pages** — `/scan`, `/admin`, `/admin/members`, `/admin/groups`, and `/admin/members/[id]` render fully per request (`export const instant = false` + `connection()`, no data `<Suspense>` holes). This avoids Next 16.4's streamed-hole swap failures on hard loads (which left pages stuck on skeletons) and means a database error surfaces as an honest error page instead of an infinite spinner.
- **Controlled form inputs** — React 19 resets uncontrolled forms after *every* server action, including failed ones, which wiped what members typed when validation failed. All action forms keep their values on error and clear only on success.
- **Auth**: signed, HMAC-sha256 session cookies (`src/lib/tokens.ts`). `src/proxy.ts` optimistically gates `/admin/*`; every admin server action re-verifies the session against the database via `requireAdmin()`.
- **Server actions only** — no custom API routes; every action validates its own authorization.
- **Attendance is idempotent per day** — unique index on `(user_id, date)` + `ON CONFLICT DO NOTHING` upsert; scanning twice the same day never doubles up.
- **Nicknames are unique** (case-insensitive) via a unique index on the normalized `nickname_key` column.
- Light mode throughout (`color-scheme: light` in `globals.css`).

## Project structure

```
src/
  proxy.ts                 # /admin/* gate (optimistic cookie check)
  lib/
    db.ts                  # SQLite connection (libSQL — file locally, Turso on Vercel)
    data.ts                # Queries + serialization
    auth.ts                # Admin session + password hashing (scrypt)
    session.ts             # Cookie read/write helpers
    tokens.ts              # HMAC sign/verify (pure, no Next APIs)
    types.ts               # Shared serialized types for client components
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
