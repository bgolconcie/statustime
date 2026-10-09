# SellFree

A second-hand marketplace for phones and tablets: people list devices (no limit on how many) and chat with buyers.

The UI picks Hebrew (RTL) or English from the browser language, with a manual switch.

## Run locally

Requires Node.js 22.13+ (uses the built-in `node:sqlite`).

```bash
cd sellfree
npm install
npm run dev     # API on :3001 + Vite on http://localhost:5173
```

Production-style: `npm run build && npm start` → http://localhost:3001

Demo accounts (created on first run): `dana@sellfree.test` / `yossi@sellfree.test`, password `demo1234` — or use
"Quick sign-in for testing" on the sign-in page, no email or password needed.

## Shareable demo

`npm run build:demo` builds the real client against an in-browser stand-in for the server (`src/demo/api.js`)
and inlines it into one page, `dist-demo/sellfree-demo.html`. Data stays in the viewer's browser, the other side
of a chat replies automatically, and the price check is simulated rather than read by Claude.

## Structure

- `server/` — Express API + SQLite (`server/data/sellfree.db`, created automatically, git-ignored)
  - `routes/auth.js` — register / login / me (JWT)
  - `routes/listings.js` — browse, create (unlimited), mark sold, delete, start a conversation
  - `routes/conversations.js` — conversation list, messages, unread counts
- `src/` — React (JS) client with Tailwind v4 + shadcn/ui, Inter font
  - `pages/` — Browse, ListingDetail, Sell, MyListings, Messages, Login
  - `i18n/` — English/Hebrew strings and language detection

## AI device check

Every listing is built from 8 guided images (`PROOF_SLOTS` in `src/lib/catalog.js`); the first 7 are required:

| # | Slot | Type | What it shows |
|---|---|---|---|
| 1 | Device Info (`deviceInfo`) | screenshot | About page: model name, model number, storage |
| 2 | Parts & Lock (`partsLock`) | screenshot | About page scrolled: carrier lock, parts & service history |
| 3 | Battery Health (`battery`) | screenshot | Maximum capacity % |
| 4 | Purchase Date (`purchaseDate`) | screenshot | AppleCare & Warranty (or a receipt on Android) |
| 5 | Screen Test (`screenOn`) | photo | Front, screen on, white image — cracks, dead pixels |
| 6 | Scratch Check (`screenOff`) | photo | Front, screen off, angled — scratches; also the listing cover |
| 7 | Back Side (`back`) | photo | Back glass and cameras |
| 8 | Box & Cable (`box`) | photo, optional | Original box / charging cable — adds to the value |

Each slot shows a drawn example (`src/lib/mockImages.js`), a written instruction and a Listen button that reads it
aloud with the browser's speech synthesis. Every upload is checked on its own the moment it's added
(`POST /api/appraisals/check-image`: right image? readable?) and marked Valid or Retake with the reason; images under
400px on the short side are rejected before that. Once all required images pass, the full check
(`POST /api/appraisals`, `server/appraisal.js`) identifies the device and reports model number, RAM, storage, purchase
date, battery % and cycles, screen and body condition, genuine parts, carrier lock, box/cable, the problems it found and
the model's launch price. `src/lib/valuation.js` turns those facts into an estimated market value in ₪; the factors
there are starting points to calibrate against real sales. Sellers get the result and auto-filled fields; buyers see it
on the listing next to the asking price.

This needs Claude API credentials on the server: set `ANTHROPIC_API_KEY` (or log in with `ant auth login`).
Without them the app still works — the check just reports that it's unavailable.
Each seller is limited to 20 full checks and 200 image checks per day.

## Sign in with Google

Set `GOOGLE_CLIENT_ID` to show "Continue with Google" on the sign-in page. Create it in Google Cloud Console →
APIs & Services → Credentials → OAuth client ID (type "Web application"), and add the app's address
(e.g. `http://localhost:5173` and the production URL) under "Authorized JavaScript origins".
The server verifies Google's ID token, creates the account on first sign-in, and links it to an existing
account with the same (Google-verified) email. Without the variable the button is simply hidden.

## Env vars

`PORT`, `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`, `ALLOW_DEMO_LOGIN` (one-click sign-in as the sample users for testing; on by default, off when `NODE_ENV=production`; set `true`/`false` to override), `JWT_SECRET` (otherwise a random secret is stored in `server/data/`), `DATA_DIR`.
