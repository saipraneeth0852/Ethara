# TaskFlow Dashboard

TaskFlow is a full-stack project management dashboard with JWT auth, role-based access control, project/task management, and seeded demo data.

This repository includes dedicated documentation for each app layer:

- `frontend/README.md` — frontend setup and usage
- `backend/README.md` — backend setup, API, and production deployment

## Admin Credentials

- Email: `admin@taskflow.com`
- Password: `Admin1234`

## Architecture

- Frontend: React + TypeScript + Vite + Tailwind + shadcn/ui
- Backend: Express + PostgreSQL (`pg`) + JWT + bcrypt + RBAC
- Auth: HTTP-only cookie-based JWTs
- DB: PostgreSQL for scalable persistence

## Features

- User signup/login/logout
- Admin/member role support
- Projects, tasks, and project membership management
- Dashboard summaries and project detail views
- Secure cookie auth with CORS and rate limiting
- Healthcheck endpoint for container readiness

## Local Development

### 1. Frontend

```bash
cd /Users/macbook/Documents/task-flow-dashboard-main
npm install
npm run dev
```

Default frontend runs on `http://localhost:8081` if available.

### 2. Backend

```bash
cd /Users/macbook/Documents/task-flow-dashboard-main/backend
npm install
cp .env.example .env
# Edit .env with your values if needed
npm run dev
```

Backend listens on `http://localhost:3000` by default.

#### Frontend environment

Set `VITE_API_URL` to your backend API base URL in your frontend environment or shell:

```bash
export VITE_API_URL=http://localhost:3000/api
```

## Production Ready Setup

### Backend

Create a `.env` from `.env.example` and provide a strong `JWT_SECRET`.

```bash
cp backend/.env.example backend/.env
```

Start the backend in production mode:

```bash
cd backend
npm install
npm start
```

### Build frontend for production

```bash
cd /Users/macbook/Documents/task-flow-dashboard-main
npm run build
```

The frontend build output is available in `dist/` and can be hosted on any static file server.

### Docker backend

Build the backend image:

```bash
cd /Users/macbook/Documents/task-flow-dashboard-main/backend
docker build -t taskflow-backend .
```

Run it:

```bash
docker run --rm -p 3000:3000 --env-file .env taskflow-backend
```

## Environment Variables

Backend `.env` variables:

- `PORT` — Backend port (default: `3000`)
- `JWT_SECRET` — Strong secret used to sign JWTs
- `DATABASE_URL` — SQLite file path, e.g. `./data/taskflow.db`
- `FRONTEND_URL` — Comma-separated allowed frontend origins
- `NODE_ENV` — `development` or `production`
- `TRUST_PROXY` — `true` when running behind a reverse proxy
- `RATE_LIMIT_MAX` — Maximum requests per IP window

Frontend env:

- `VITE_API_URL` — Backend API base URL, e.g. `http://localhost:3000/api`

## Seeded Accounts

The backend seeds a demo admin and member user automatically.

- Admin
  - Email: `admin@taskflow.com`
  - Password: `Admin1234`

- Member
  - Email: `member@taskflow.com`
  - Password: `Member1234`
  - User ID: `46a8a96b-3895-45ac-b13a-be554806bd6d`

## API Reference

### Auth

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Projects

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:id`
- `PATCH /api/projects/:id`
- `DELETE /api/projects/:id`
- `GET /api/projects/:id/members`
- `POST /api/projects/:id/members`
- `DELETE /api/projects/:id/members/:userId`
- `POST /api/projects/:id/tasks`

### Tasks

- `GET /api/tasks/:id`
- `PATCH /api/tasks/:id`
- `PATCH /api/tasks/:id/status`
- `PATCH /api/tasks/:id/assign`
- `DELETE /api/tasks/:id`

### Dashboard

- `GET /api/dashboard`

### Health

- `GET /healthz`

## Production Notes

- Use a secure `JWT_SECRET` and never commit `.env`
- Serve frontend `dist/` from a static host or CDN
- Use HTTPS and secure cookies in production
- Monitor backend logs and enable backups for `taskflow.db`
- For large production deployments, replace SQLite with a managed SQL database

## Release Checklist

- [x] Secure environment variables
- [x] Production cookie configuration
- [x] CORS whitelist and healthcheck endpoint
- [x] Rate limiting middleware
- [x] Docker-ready backend image
- [x] Full project README
# Ethara
# Ethara
