# SellFree

Standalone React + Vite app (plain JS) using Tailwind CSS v4, shadcn/ui components and Inter.

```bash
cd sellfree
npm install
npm run dev     # http://localhost:5173
npm run build   # outputs to sellfree/dist
```

- shadcn/ui is configured via `components.json` (JS, no TSX) — add components with `npx shadcn@latest add <name>`.
- UI primitives live in `src/components/ui`, placeholder data in `src/data/listings.js`.
- Independent from the StatusTime app: not part of the Docker image or Railway deploy.
