# SellFree

A second-hand marketplace for phones, computers and TVs: people list devices (no limit on how many) and chat with buyers.
Items are tagged with age groups so shoppers see what fits the age they're shopping for.
The UI picks Hebrew (RTL) or English from the browser language, with a manual switch.

## Run locally

Requires Node.js 22.13+ (uses the built-in `node:sqlite`).

```bash
cd sellfree
npm install
npm run dev     # API on :3001 + Vite on http://localhost:5173
```

Production-style: `npm run build && npm start` → http://localhost:3001

Demo accounts (created on first run): `dana@sellfree.test` / `yossi@sellfree.test`, password `demo1234`.

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

## Phone price check

Phone listings require 5 screenshots of the phone's own data (model & storage, purchase date, network lock, battery health,
parts/diagnostics). When all 5 are uploaded, the server sends them to Claude (`server/appraisal.js`), which
reads the facts (model, storage, purchase date, battery %, genuine parts, carrier lock, launch price).
Physical condition can't be seen in a screenshot, so the estimate uses the condition the seller declares.
`src/lib/valuation.js` turns those facts into an estimated value in ₪; the factors there are starting points
to calibrate against real sales. Sellers get the estimate and auto-filled fields; buyers see it on the listing.

This needs Claude API credentials on the server: set `ANTHROPIC_API_KEY` (or log in with `ant auth login`).
Without them the app still works — the price check just reports that it's unavailable.
Each seller is limited to 20 price checks per day.

## Sign in with Google

Set `GOOGLE_CLIENT_ID` to show "Continue with Google" on the sign-in page. Create it in Google Cloud Console →
APIs & Services → Credentials → OAuth client ID (type "Web application"), and add the app's address
(e.g. `http://localhost:5173` and the production URL) under "Authorized JavaScript origins".
The server verifies Google's ID token, creates the account on first sign-in, and links it to an existing
account with the same (Google-verified) email. Without the variable the button is simply hidden.

## Env vars

`PORT`, `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`, `JWT_SECRET` (otherwise a random secret is stored in `server/data/`), `DATA_DIR`.
