# Beananza Client

React client for the Beananza card game, built with Vite, TanStack Router, and
TanStack Query.

## Development

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`INTERNAL_API_URL` is required in `.env` for native Vite development. The Vite
dev server proxies same-origin browser requests to that internal Go server URL.
WebSocket traffic uses the same proxy target.

## Routing

The browser client uses same-origin API and WebSocket routing:

```text
/rooms
/register
/config
/upload-avatar
/user-avatars
/ws
```

The WebSocket URL is derived from the page URL, using `wss://` on HTTPS and
`ws://` on HTTP.

## Scripts

```bash
npm run dev      # Vite dev server on port 3000
npm run build    # Production build plus TypeScript check
npm run start    # Preview the production build
npm run lint     # ESLint
```
