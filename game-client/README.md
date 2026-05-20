# Beananza Client

React client for the Beananza card game, built with Vite, TanStack Router, and
TanStack Query.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The Vite dev server proxies `/rooms`, `/register`, `/config`,
`/upload-avatar`, `/user-avatars`, and `/ws` to the game server. By default it
targets `http://localhost:8080`; override with `INTERNAL_API_URL` when needed.

## Scripts

```bash
npm run dev      # Vite dev server on port 3000
npm run build    # Production build plus TypeScript check
npm run start    # Preview the production build
npm run lint     # ESLint
```
