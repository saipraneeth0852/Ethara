# Frontend README

This project frontend is a React + TypeScript + Vite application for the TaskFlow Dashboard.

## Overview

- Vite-powered React application
- React Router for navigation
- Tailwind CSS and shadcn/ui for UI components
- Communicates with the backend via `src/lib/api.ts`
- Uses `axios` with `withCredentials: true` for cookie-based auth

## Local Development

```bash
cd /Users/macbook/Documents/task-flow-dashboard-main
npm install
npm run dev
```

The app will run on the first available port, typically `http://localhost:8080` or `http://localhost:8081`.

## Frontend Environment

Set the backend API base URL in your shell or `.env` file:

```bash
export VITE_API_URL=http://localhost:3000/api
```

## Production Build

```bash
npm run build
```

The built assets are output to `dist/`.

## Preview

```bash
npm run preview
```

## Notes

- Ensure the backend is running before using the frontend.
- If the backend is on a different URL, update `VITE_API_URL`.
- Clear browser cookies if auth state becomes stale.
