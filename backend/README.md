# TaskFlow Backend

This backend provides the TaskFlow API with Express, SQLite, JWT authentication, RBAC, and seeded demo data.

## Overview

- Express API server
- PostgreSQL persistence via `pg`
- JWT auth with secure HTTP-only cookies
- Role-based access control: `admin` and `member`
- Security middleware: Helmet, CORS, compression, rate limiting
- Health endpoint at `/healthz`

## Setup

```bash
cd backend
npm install
cp .env.example .env
```

Open `backend/.env` and configure the environment values.

## Development

```bash
npm run dev
```

The backend listens on `http://localhost:3000` by default.

## Production

```bash
npm install
npm start
```

### Docker

```bash
docker build -t taskflow-backend .
docker run --rm -p 3000:3000 --env-file .env taskflow-backend
```

## Environment Variables

- `PORT` — backend port (default `3000`)
- `JWT_SECRET` — strong secret for signing JWT tokens
- `DATABASE_URL` — PostgreSQL connection string (e.g., `postgresql://user:pass@host:port/db`)
- `FRONTEND_URL` — comma-separated allowed frontend origin(s)
- `NODE_ENV` — `development` or `production`
- `TRUST_PROXY` — `true` when behind a reverse proxy
- `RATE_LIMIT_MAX` — max requests per IP per 15-minute window

## Seeded Accounts

The backend seeds demo users automatically on first run.

- Admin: `admin@taskflow.com` / `Admin1234`
- Member: `member@taskflow.com` / `Member1234`

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

- Use a secure `JWT_SECRET`.
- Do not commit `.env`.
- Back up your PostgreSQL database regularly.
- Use a managed PostgreSQL service for larger production deployments.
