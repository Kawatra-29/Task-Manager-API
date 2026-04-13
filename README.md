# Task Manager API — v2.0

> A secure, production-ready RESTful API for task management built with **Node.js / Express.js**, backed by **PostgreSQL** (users & categories) and **MongoDB** (tasks & webhook logs), with JWT authentication, real-time reminders, task categorisation & tags, and event-driven webhook delivery.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Architecture & Design Decisions](#architecture--design-decisions)
5. [Prerequisites](#prerequisites)
6. [Setup & Running](#setup--running)
7. [Environment Variables](#environment-variables)
8. [API Documentation](#api-documentation)
   - [Health Check](#health-check)
   - [Auth Endpoints](#auth-endpoints)
   - [Category Endpoints](#category-endpoints)
   - [Task Endpoints](#task-endpoints)
9. [Error Handling](#error-handling)
10. [Running Tests](#running-tests)
11. [Logging](#logging)
12. [Swagger UI](#swagger-ui)

---

## Overview

Task Manager API provides a complete backend for managing personal tasks with rich organizational features. It uses a dual-database architecture — PostgreSQL for relational integrity and MongoDB for flexible document storage — enforced at the application layer via the user's PostgreSQL UUID stored in each MongoDB document.

| Feature | Description |
|---|---|
| JWT Authentication | Secure registration & login with bcrypt password hashing |
| Dual Database | PostgreSQL for relational data; MongoDB for flexible task documents |
| Task Categories | User-created categories with hex color & emoji icon support |
| Free-form Tags | Attach up to 20 lowercase-normalised tags per task |
| Smart Reminders | Configurable in-memory scheduler fires N minutes before due date |
| Webhook Delivery | `task.completed` events with exponential-backoff retry (3 attempts) |
| Request Validation | `express-validator` rules on all endpoints |
| Structured Logging | Winston logger writing to console and rotating log files |
| Docker Support | Full Docker Compose setup for API + PostgreSQL + MongoDB |
| Swagger UI | Interactive API docs at `/api/docs` |

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Runtime | Node.js 20 | JavaScript server runtime |
| Framework | Express.js 4 | HTTP server & routing |
| User/Category DB | PostgreSQL 16 via Sequelize ORM | Relational data with ACID guarantees |
| Task/Event DB | MongoDB 7 via Mongoose ODM | Flexible document model for tasks |
| Authentication | JWT (`jsonwebtoken`) + `bcryptjs` | Stateless auth with secure password hashing |
| Validation | `express-validator` | Request body & param validation |
| Scheduling | `node-cron` + in-memory `setTimeout` | Cron poller + precise timers for reminders |
| Webhooks | `axios` | HTTP delivery with exponential-backoff retry |
| Logging | `winston` | Console + rotating file logs |
| Security | `helmet`, `cors` | HTTP security headers & CORS |
| Containerisation | Docker + Docker Compose | One-command local environment setup |
| Testing | Jest + Supertest | Integration & unit tests |

---

## Project Structure

```
task-manager-api/
├── src/
│   ├── app.js                    # Express app (middleware + routes)
│   ├── server.js                 # DB connections + scheduler bootstrap
│   ├── config/
│   │   ├── postgres.js           # Sequelize instance
│   │   ├── mongo.js              # Mongoose connect
│   │   └── categories.js         # Default category seeds (reference)
│   ├── models/
│   │   ├── User.js               # Sequelize → PostgreSQL
│   │   ├── Category.js           # Sequelize → PostgreSQL
│   │   ├── Task.js               # Mongoose  → MongoDB
│   │   └── WebhookLog.js         # Mongoose  → MongoDB
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── categoryController.js
│   │   └── taskController.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── categories.js
│   │   └── tasks.js
│   ├── middleware/
│   │   ├── auth.js               # JWT verification
│   │   └── errorHandler.js       # AppError + global handler
│   ├── validators/
│   │   └── index.js              # All express-validator rule sets
│   ├── services/
│   │   ├── reminderScheduler.js  # In-memory queue + cron poller
│   │   └── webhookService.js     # Delivery + retry logic
│   └── utils/
│       ├── jwt.js
│       └── logger.js             # Winston logger
├── tests/
│   ├── auth.test.js
│   ├── tasks.test.js
│   └── categories.test.js
├── logs/                         # Auto-created at runtime
│   ├── notifications.log
│   └── error.log
├── .env.example
├── docker-compose.yml
├── Dockerfile
└── package.json
```

---

## Architecture & Design Decisions

### 1. Dual-Database Architecture

Users and categories live in **PostgreSQL** for relational integrity and unique constraints. Tasks and webhook logs live in **MongoDB** for schema flexibility. Cross-database ownership is enforced at the application layer using the PostgreSQL user UUID stored in every MongoDB document.

| Data | Database | Rationale |
|---|---|---|
| Users | PostgreSQL | Unique email constraint, ACID guarantees |
| Categories | PostgreSQL | Per-user unique name constraint, relational joins |
| Tasks | MongoDB | Flexible schema, rich indexing, fast user-scoped queries |
| WebhookLogs | MongoDB | Append-only event log, flexible payload shape |

---

### 2. Dynamic User-Created Categories

Categories are not pre-defined — each user creates their own, stored in PostgreSQL. Category metadata (`name`, hex `color`, `icon` emoji) is **denormalised** onto each Task document as `categoryName` to avoid cross-database joins on every task read. When a category name changes, `categoryController.updateCategory` propagates it via `Task.updateMany`.

> **Default Seeds:** A `DEFAULT_CATEGORIES` constant in `src/config/categories.js` provides Work, Personal, Urgent, Learning, and Health seeds that can be inserted on first login.

---

### 3. Free-Form Tag Management

Tags are stored as a `[String]` array on each Task document, normalised to lowercase and deduplicated at write time. A MongoDB multi-key index on `{ userId, tags }` makes `$all`-based filtering fast. Filtering via `?tags=a,b` requires the task to have **all** listed tags. `GET /api/tasks/tags` uses `Task.distinct()` to return unique tags without fetching full documents.

---

### 4. Reminder Scheduling — In-Memory Queue + Cron Recovery

The reminder system uses two complementary layers for millisecond accuracy and crash recovery:

```
createTask / updateTask
        │
        ▼
reminderScheduler.scheduleReminder(task)
        │
        ├─ Persists reminderScheduledFor to MongoDB
        ├─ Arms a precise setTimeout (ms-accurate)
        └─ Cancels any previous timer for the same task
               │
               ▼ on fire
        reminderScheduler._fire(taskId)
               ├─ Logs 🔔 TASK REMINDER NOTIFICATION via winston
               ├─ POSTs to NOTIFICATION_WEBHOOK_URL (if set)
               └─ Sets task.reminderSentAt (idempotency guard)

node-cron (every minute)
        └─ _poll(): finds tasks in next 2-minute window
           └─ Re-arms setTimeout for any not already tracked
              (handles server restarts / missed timers)
```

**Cancellation / Reschedule logic:**
- `status: 'completed'` → `cancelReminder()` — clears timer and `reminderScheduledFor`
- `dueDate` changed → cancels old timer, resets `reminderSentAt`, schedules new timer
- Task deleted → `cancelReminder()`

> **Config:** `REMINDER_MINUTES_BEFORE` env var (default `60`). Set to `1` or `2` to demo locally.

---

### 5. Webhook Retry — Exponential Backoff with Persistent Audit Log

When a task is marked completed, a `WebhookLog` document is created and the first delivery attempt fires asynchronously. Failed attempts are retried with exponential backoff. All delivery state survives server restarts via MongoDB persistence.

```
task.status → 'completed'
        │
        ▼
webhookService.scheduleTaskCompleted(task, userId)
        ├─ Creates WebhookLog document (status: 'pending')
        └─ Fires _attempt(logId, 1) asynchronously

_attempt(logId, n)
        ├─ POST payload to WEBHOOK_URL (8s timeout)
        ├─ Success → log.status = 'delivered'
        └─ Failure →
               ├─ n < 3: delay = 5000 * 2^(n-1)  [5s, 10s]
               └─ n == 3: log.status = 'failed'

server.js startup
        └─ webhookService.replayPending()
               └─ Re-queues 'pending' logs (staggered by 2s)
```

**Webhook payload (`task.completed`):**
```json
{
  "event": "task.completed",
  "taskId": "64f1a2b3c4d5e6f7a8b9c0d1",
  "title": "Submit assignment",
  "completedAt": "2025-01-01T12:00:00.000Z",
  "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

## Prerequisites

| Option | Requirements |
|---|---|
| Option A — Docker (Recommended) | Docker Desktop + Docker Compose |
| Option B — Manual | Node.js >= 20, PostgreSQL >= 14, MongoDB >= 6 |

---

## Setup & Running

### Option A — Docker (Recommended)

```bash
git clone https://github.com/<your-username>/task-manager-api.git
cd task-manager-api

# (Optional) set WEBHOOK_URL in docker-compose.yml

docker compose up --build
# API now available at http://localhost:3000

# To stop and remove volumes:
docker compose down -v
```

### Option B — Manual Setup

```bash
git clone https://github.com/<your-username>/task-manager-api.git
cd task-manager-api
npm install

cp .env.example .env
# Edit .env with your database credentials and JWT secret

# Start databases
psql -U postgres -c "CREATE DATABASE taskmanager;"
mongod --dbpath /data/db &

npm run dev      # development with auto-reload (nodemon)
# or
npm start        # production
```

### Quick Demo — Trigger a Reminder in ~2 Minutes

```bash
# In .env:
REMINDER_MINUTES_BEFORE=2

# Create a task due 3 minutes from now
curl -X POST http://localhost:3000/api/tasks \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Demo reminder","dueDate":"<NOW+3MIN ISO>"}'

# Watch console or logs/ for: 🔔 TASK REMINDER NOTIFICATION
```

---

## Environment Variables

> ⚠️ Never commit `.env` to version control. Always use strong, randomly generated secrets in production.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `NODE_ENV` | `development` | `development` / `production` / `test` |
| `LOG_LEVEL` | `info` | Winston log level |
| `PG_HOST` | `localhost` | PostgreSQL host |
| `PG_PORT` | `5432` | PostgreSQL port |
| `PG_DATABASE` | `taskmanager` | PostgreSQL database name |
| `PG_USER` | `postgres` | PostgreSQL username |
| `PG_PASSWORD` | — | PostgreSQL password (required) |
| `MONGO_URI` | `mongodb://localhost:27017/taskmanager` | MongoDB connection string |
| `JWT_SECRET` | — | JWT signing secret (required, keep secret) |
| `JWT_EXPIRES_IN` | `7d` | Token time-to-live (e.g. `7d`, `24h`) |
| `BCRYPT_ROUNDS` | `12` | bcrypt hash work factor |
| `REMINDER_MINUTES_BEFORE` | `60` | Minutes before `dueDate` to fire reminder |
| `NOTIFICATION_WEBHOOK_URL` | — | POST reminder events here (optional) |
| `WEBHOOK_URL` | — | POST `task.completed` events here (optional) |

---

## API Documentation

**Base URL:** `http://localhost:3000`
**Swagger UI:** `http://localhost:3000/api/docs`
**OpenAPI JSON:** `http://localhost:3000/api/docs.json`

All request bodies use `Content-Type: application/json`. Protected endpoints require:
```
Authorization: Bearer <token>
```

---

### Health Check

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | No | Returns server status and timestamp |

**Response `200`:**
```json
{
  "status": "success",
  "message": "Task Manager API v2 is running",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

---

### Auth Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | No | Register a new user, returns JWT |
| `POST` | `/api/auth/login` | No | Login with credentials, returns JWT |
| `GET` | `/api/auth/me` | Yes | Get current user profile |

#### `POST /api/auth/register` — Request Body

| Field | Type | Required | Rules |
|---|---|---|---|
| `email` | string | Yes | Valid email address, unique across users |
| `password` | string | Yes | Min 8 chars, at least 1 uppercase, 1 number |
| `name` | string | No | Max 100 characters |

#### Register / Login — Response `201` / `200`

```json
{
  "status": "success",
  "message": "User registered successfully",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "email": "alice@example.com",
      "name": "Alice",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

> **Security note:** Both "email not found" and "wrong password" return the same `401` to prevent user enumeration.

---

### Category Endpoints

All category endpoints require authentication.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/categories` | Create a new category |
| `GET` | `/api/categories` | List all categories (sorted by name) |
| `GET` | `/api/categories/:id` | Get a single category by UUID |
| `PATCH` | `/api/categories/:id` | Partially update a category (name change propagates to tasks) |
| `DELETE` | `/api/categories/:id` | Delete category; sets `categoryId=null` on all linked tasks |

#### Category Request Body

| Field | Type | Required | Rules |
|---|---|---|---|
| `name` | string | Yes | Max 100 chars, unique per user |
| `color` | string | No | Hex colour e.g. `#4F46E5` |
| `icon` | string | No | Max 10 chars (emoji or short code) |

#### Category Response

```json
{
  "status": "success",
  "data": {
    "category": {
      "id": "b2c3d4e5-f6g7-8901-hijk-lm2345678901",
      "name": "Work",
      "color": "#4F46E5",
      "icon": "💼",
      "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "created_at": "2025-01-01T00:00:00.000Z",
      "updated_at": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

---

### Task Endpoints

All task endpoints require authentication.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/tasks` | Create a task (schedules reminder if `dueDate` set) |
| `GET` | `/api/tasks` | List tasks with filtering and pagination |
| `GET` | `/api/tasks/tags` | Get all unique tags used by the authenticated user |
| `GET` | `/api/tasks/:id` | Get a single task by MongoDB ObjectId |
| `PATCH` | `/api/tasks/:id` | Partially update a task (see side effects below) |
| `DELETE` | `/api/tasks/:id` | Delete task and cancel any pending reminder |

#### Create / Update Task — Request Body

| Field | Type | Required (Create) | Rules |
|---|---|---|---|
| `title` | string | Yes | Max 200 characters |
| `description` | string | No | Max 2000 characters |
| `dueDate` | string | No | ISO 8601 date. Schedules reminder automatically. |
| `status` | string | No | `pending` \| `completed` |
| `categoryId` | UUID | No | Must belong to the authenticated user |
| `tags` | string[] | No | Max 20 items, each max 50 chars. Normalised to lowercase. |

#### `PATCH /api/tasks/:id` — Side Effects

- `status: "completed"` → sets `completedAt`, cancels reminder, fires `task.completed` webhook
- `dueDate` changed → cancels old reminder, schedules new one (resets `reminderSentAt`)
- `status: "pending"` on a completed task → clears `completedAt`
- `categoryId: null` → unlinks the category from the task

#### `GET /api/tasks` — Query Parameters

| Parameter | Type | Description |
|---|---|---|
| `status` | string | Filter: `pending` \| `completed` |
| `categoryId` | UUID | Filter tasks by category |
| `tags` | string | Comma-separated list; task must have **all** tags. e.g. `urgent,client-a` |
| `page` | integer | Page number (default: `1`, minimum: `1`) |
| `limit` | integer | Tasks per page (default: `20`, max: `100`) |

**Example queries:**
```
GET /api/tasks?status=pending
GET /api/tasks?categoryId=<uuid>&status=completed
GET /api/tasks?tags=urgent,client-a
GET /api/tasks?status=pending&tags=urgent&page=2&limit=10
```

#### Task Object — Full Response Shape

```json
{
  "id": "64f1a2b3c4d5e6f7a8b9c0d1",
  "title": "Submit assignment",
  "description": "Push to GitHub and share the link",
  "dueDate": "2025-12-31T00:00:00.000Z",
  "status": "pending",
  "completedAt": null,
  "categoryId": "b2c3d4e5-f6g7-8901-hijk-lm2345678901",
  "categoryName": "Work",
  "tags": ["urgent", "client-a"],
  "reminderScheduledFor": "2025-12-30T23:00:00.000Z",
  "reminderSentAt": null,
  "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T12:00:00.000Z"
}
```

---

## Error Handling

All errors follow a consistent JSON shape:

```json
{ "status": "error", "message": "Task not found" }
```

Validation errors include a detailed `errors` array:

```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Must be a valid email address" }
  ]
}
```

| HTTP Status | Meaning |
|---|---|
| `400` | Validation failure or malformed request |
| `401` | Missing, invalid, or expired JWT token |
| `403` | Authenticated but not the resource owner |
| `404` | Resource or route not found |
| `409` | Conflict — duplicate email or category name |
| `500` | Unexpected server error (stack trace shown in `development` mode) |

---

## Running Tests

Tests use Jest + Supertest and require both databases to be running.

```bash
# Run all tests
npm test

# Use separate test databases (recommended)
PG_DATABASE=taskmanager_test \
  MONGO_URI=mongodb://localhost:27017/taskmanager_test \
  npm test
```

| Test File | Coverage |
|---|---|
| `tests/auth.test.js` | Register, login, profile, token expiry & validation |
| `tests/tasks.test.js` | CRUD, ownership enforcement, categories, tags, filtering, pagination |
| `tests/categories.test.js` | CRUD, ownership, task unlinking on category deletion |

---

## Logging

Log files are written to the `logs/` directory (auto-created on startup). Console output is suppressed during tests (`NODE_ENV=test`).

| File | Contents |
|---|---|
| `logs/notifications.log` | Reminder firings, webhook deliveries and retries |
| `logs/error.log` | Error-level logs only |

**Reminder fired:**
```
[2025-01-01 11:00:00] INFO: 🔔 TASK REMINDER NOTIFICATION
| {"taskId":"...","title":"Submit report","dueDate":"...",
  "message":"Task \"Submit report\" is due in 60 minutes!"}
```

**Webhook delivery with retry:**
```
[2025-01-01 12:05:00] WARN: Webhook attempt 1 failed | {"error":"HTTP 503"}
[2025-01-01 12:05:05] INFO: Scheduling retry 2 in 5s | {"logId":"..."}
[2025-01-01 12:05:10] INFO: Webhook delivered successfully | {"attempts":2}
```

---

## Swagger UI

The API ships with a full **OpenAPI 3.0.3** specification and an interactive Swagger UI.

| URL | Description |
|---|---|
| `http://localhost:3000/api/docs` | Interactive Swagger UI — try endpoints directly in browser |
| `http://localhost:3000/api/docs.json` | Raw OpenAPI JSON spec (use for code generation tools) |

> **Tip:** Click **Authorize** in Swagger UI and paste your JWT token. `persistAuthorization` is enabled so the token survives page reloads.