# StatusTime — Claude Code Context

## What this is
Automatic time tracking SaaS for remote teams via Slack presence polling.
$9/user/month. Built by Benoit (bgolconcie).

## Live URLs
- App: https://statustime-production.up.railway.app
- GitHub: https://github.com/bgolconcie/statustime
- Railway project: e1d5db56-62f8-409b-9e42-83bac81f84e2
- Railway service: 35e9ac2b-7e8d-4090-b3df-5d2c56e64b03

## Stack
- **Frontend**: React 18 + TypeScript + Vite + React Router v6 + Recharts — lives in `client/`
- **Backend**: Express.js — lives in `server/`
- **DB**: PostgreSQL on Railway
- **Font**: Inter throughout — NO Syne, NO italic anywhere
- **Build**: `cd client && npm run build` — outputs to `public/`
- **Start**: `node server/index.js`
- **Deploy**: push to main → Railway auto-builds and deploys (~45s)

## Key architecture decisions
- UserDetail lives at `/dashboard/user/:id` (inside AppLayout, has sidebar)
- All navigation links to users use `/dashboard/user/:id` NOT `/user/:id`
- Presence is polled every 5 minutes via node-cron
- Every poll writes a row to `presence_snapshots` (org_id, user_id, polled_at, is_active)
- Sessions in `time_sessions` are written when user goes active→away
- Heatmap uses `presence_snapshots` grouped by DOW + hour → pct active
- Activity log uses `presence_snapshots` grouped by date + hour → timeline per day

## Database tables
- `organizations` — orgs (auth, billing, trial)
- `integrations` — Slack workspace connections
- `tracked_users` — synced Slack users
- `time_sessions` — active sessions (start_time, end_time, duration_minutes)
- `presence_snapshots` — every 5-min poll result (is_active bool) — KEY for heatmap/log
- `leave_requests` — leave management

## Env vars (set in Railway)
- DATABASE_URL — PostgreSQL connection string
- JWT_SECRET — statustime-jwt-secret-2026-xK9mP2nR
- NODE_ENV — production
- SLACK_CLIENT_ID / SLACK_CLIENT_SECRET / SLACK_SIGNING_SECRET
- APP_URL — https://statustime-production.up.railway.app

## File structure
```
client/src/
  App.tsx                          # Routes — /dashboard/* inside AppLayout
  pages/
    Login.tsx
    UserDetail.tsx                 # User detail page (inside AppLayout)
    dashboard/
      Overview.tsx                 # Main dashboard
      TeamHours.tsx
      Leave.tsx
      Integrations.tsx
      Reports.tsx
  components/
    layout/AppLayout.tsx           # Sidebar nav (Inter font, no Syne)
    ui/
      Card.tsx                     # CardHeader uses Inter, fontWeight 600
      StatCard.tsx                 # Inter, 1.35rem, single line
      Avatar.tsx / Badge.tsx / StatusDot.tsx / Toast.tsx
  hooks/
    useTheme.ts / useLocalTime.ts
  api.ts                           # Typed API client
  utils.ts                         # minsToHours, formatDate

server/
  index.js                         # Express entry, runs migrate() on start
  routes/
    auth.js                        # register / login / me
    slack.js                       # OAuth, sync, presence polling
    dashboard.js                   # users, hours, heatmap, activity-log, export
    billing.js                     # Stripe checkout / portal / webhook
  jobs/poller.js                   # node-cron every 5min — polls Slack + writes snapshots
  db/
    index.js                       # pg Pool + migrate()
    schema.sql                     # CREATE TABLE IF NOT EXISTS for all tables
```

## Key API endpoints
- GET  /api/dashboard/users                        — all tracked users
- GET  /api/dashboard/users/:id                    — single user profile
- GET  /api/dashboard/users/:id/hours?days=N       — daily totals from time_sessions
- GET  /api/dashboard/users/:id/hourly?days=N      — 7x24 heatmap from presence_snapshots
- GET  /api/dashboard/users/:id/activity-log?days=N — per-day timeline from presence_snapshots
- GET  /api/dashboard/stats                        — org-level totals
- GET  /api/dashboard/export?from=&to=             — CSV export

## Design rules
- Font: Inter everywhere, fontStyle: normal, NO Syne, NO italic
- Colors: CSS variables (--accent, --text, --muted, --surface, --surface2, --border, --bg)
- Card titles: Inter, fontWeight 600, fontSize 0.95rem
- StatCard values: Inter, fontWeight 700, fontSize 1.35rem, single line (whiteSpace: nowrap)
- Sidebar: 220px, white surface, nav items with active blue left border
- UserDetail: rendered inside AppLayout (has sidebar), no custom navbar
- Back button in UserDetail: uses useNavigate() to go to /dashboard

## Development workflow
1. Edit files locally
2. `cd client && npm run build` to catch TypeScript errors
3. `git add . && git commit -m "description" && git push`
4. Railway auto-deploys in ~45 seconds
5. DB schema changes: just add to schema.sql — migrate() runs on every server start with IF NOT EXISTS

## Current state (as of March 29, 2026)
- 11 Slack users synced (stax3.com workspace)
- presence_snapshots started collecting today — heatmap/activity log will fill over days
- time_sessions has historical data but many rows lack start_time/end_time (pre-snapshot era)
- Trial: 13 days left on Benigo account
- Marketing page at / not yet fixed (serves blank React shell instead of marketing.html)
