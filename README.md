# Task Manager API

A secure, production-ready RESTful API for a Task Management application. Built with **Node.js / Express.js**, using **PostgreSQL** for user data and **MongoDB** for task data, with **JWT authentication**, **Swagger UI**, and full **Docker** support.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Design Decisions](#design-decisions)
4. [Prerequisites](#prerequisites)
5. [Setup & Running](#setup--running)
   - [Option A – Docker (Recommended)](#option-a--docker-recommended)
   - [Option B – Manual Setup](#option-b--manual-setup)
6. [Environment Variables](#environment-variables)
7. [API Documentation](#api-documentation)
   - [Swagger UI](#swagger-ui)
   - [Auth Endpoints](#auth-endpoints)
   - [Task Endpoints](#task-endpoints)
8. [Error Handling](#error-handling)
9. [Running Tests](#running-tests)

---

## Tech Stack

| Layer             | Technology                          |
|-------------------|-------------------------------------|
| Runtime           | Node.js 20                          |
| Framework         | Express.js 4                        |
| User DB           | PostgreSQL 16 via Sequelize ORM     |
| Task DB           | MongoDB 7 via Mongoose ODM          |
| Auth              | JWT (jsonwebtoken) + bcryptjs       |
| Validation        | express-validator                   |
| API Docs          | Swagger UI (swagger-jsdoc + swagger-ui-express) |
| Security          | helmet, cors                        |
| Containerization  | Docker + Docker Compose             |
| Testing           | Jest + Supertest                    |

---

## Project Structure

```
task-manager-api/
├── src/
│   ├── app.js                  # Express app (middleware + routes + Swagger UI)
│   ├── server.js               # DB connections + HTTP server bootstrap
│   ├── swagger.js              # OpenAPI 3.0 spec (all schemas + paths)
│   ├── config/
│   │   ├── postgres.js         # Sequelize instance + connectPostgres()
│   │   └── mongo.js            # Mongoose connectMongo()
│   ├── models/
│   │   ├── User.js             # Sequelize model → PostgreSQL
│   │   └── Task.js             # Mongoose model  → MongoDB
│   ├── controllers/
│   │   ├── authController.js   # register / login / getProfile
│   │   └── taskController.js   # CRUD for tasks
│   ├── routes/
│   │   ├── auth.js             # /api/auth/*
│   │   └── tasks.js            # /api/tasks/*
│   ├── middleware/
│   │   ├── auth.js             # JWT verification middleware
│   │   └── errorHandler.js     # AppError class + global error handler
│   ├── validators/
│   │   └── index.js            # express-validator rule sets
│   └── utils/
│       └── jwt.js              # signToken() helper
├── tests/
│   ├── auth.test.js            # Auth endpoint tests
│   └── tasks.test.js           # Task CRUD + ownership tests
├── .env.example
├── .gitignore
├── docker-compose.yml
├── Dockerfile
└── package.json
```

---

## Design Decisions

### Dual-Database Architecture
- **PostgreSQL** stores users — relational integrity matters: unique email constraint, predictable schema, strong ACID guarantees.
- **MongoDB** stores tasks — document-like structure (flexible description, optional fields), JSON embedding maps naturally to a document store. The `userId` field (a PostgreSQL UUID stored as a string) is the cross-database foreign key, enforced at the application layer.

### Separation of `app.js` and `server.js`
`app.js` exports a pure Express application with no side-effects — trivially importable by test suites (Supertest) without opening database connections or ports. `server.js` is the actual entry point that connects to both databases, then starts listening.

### Ownership Enforcement
Every task read/update/delete first fetches the task by `_id`, then checks `task.userId === req.user.id`. A mismatch returns **403 Forbidden** (not 404) — the correct REST convention: the requester knows the resource exists but they don't own it.

### AppError + Global Error Handler
A single `AppError` class carries an `isOperational` flag. Operational errors (bad input, 404, 403) are surfaced to the client. Unexpected errors are logged server-side and return a generic 500 — no stack-trace leakage in production.

### Password Security
bcrypt with configurable rounds (default 12). The hashed password is never returned in any response — even on registration the user object is selected without the `password` column.

### Partial Updates (PATCH)
Task updates use `PATCH`, not `PUT`. Only fields present in the request body are applied — avoids accidental field-clearing when clients send partial payloads.

### JWT Strategy
Stateless JWTs signed with HS256. On every protected request the middleware verifies the signature **and** re-fetches the user from PostgreSQL, ensuring the account still exists. The token payload carries only `{ userId }` — no sensitive data.

### Swagger / OpenAPI Documentation
A full OpenAPI 3.0.3 spec is defined in `src/swagger.js` — all schemas, reusable response components, security schemes, and request examples are declared there. The spec is served both as interactive Swagger UI (`/api-docs`) and as raw JSON (`/api-docs.json`) for Postman/Insomnia import.

---

## Prerequisites

- **Docker & Docker Compose** *(for Option A)*
- **Node.js ≥ 20**, **PostgreSQL ≥ 14**, **MongoDB ≥ 6** *(for Option B)*

---

## Setup & Running

### Option A – Docker (Recommended)

```bash
# 1. Clone the repo
git clone https://github.com/<your-username>/task-manager-api.git
cd task-manager-api

# 2. Start all services (Postgres, Mongo, API) in one command
docker compose up --build
```

Wait for:
```
✅ PostgreSQL connected
✅ MongoDB connected
🚀 Server running on http://localhost:3000
```

To stop and remove containers:
```bash
docker compose down -v
```

---

### Option B – Manual Setup

**1. Clone & install**
```bash
git clone https://github.com/<your-username>/task-manager-api.git
cd task-manager-api
npm install
```

**2. Configure environment**
```bash
cp .env.example .env
# Edit .env with your PostgreSQL and MongoDB credentials
```

**3. Ensure databases are running**
```bash
# PostgreSQL — create the database
psql -U postgres -c "CREATE DATABASE taskmanager;"

# MongoDB — start mongod (default port 27017)
mongod --dbpath /data/db
```

**4. Start the server**
```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

API available at `http://localhost:3000`

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

| Variable          | Description                                | Default                                   |
|-------------------|--------------------------------------------|-------------------------------------------|
| `PORT`            | HTTP port                                  | `3000`                                    |
| `NODE_ENV`        | Environment (`development`/`production`)   | `development`                             |
| `PG_HOST`         | PostgreSQL host                            | `localhost`                               |
| `PG_PORT`         | PostgreSQL port                            | `5432`                                    |
| `PG_DATABASE`     | PostgreSQL database name                   | `taskmanager`                             |
| `PG_USER`         | PostgreSQL user                            | `postgres`                                |
| `PG_PASSWORD`     | PostgreSQL password                        | —                                         |
| `MONGO_URI`       | Full MongoDB connection string             | `mongodb://localhost:27017/taskmanager`   |
| `JWT_SECRET`      | Secret for signing JWTs (**keep private!**) | —                                        |
| `JWT_EXPIRES_IN`  | Token expiry duration                      | `7d`                                      |
| `BCRYPT_ROUNDS`   | bcrypt work factor                         | `12`                                      |

> ⚠️ Never commit `.env` to version control. It is listed in `.gitignore`.

---

## API Documentation

### Swagger UI

The full interactive API documentation is available at:

```
http://localhost:3000/api-docs
```

Raw OpenAPI JSON spec (for Postman / Insomnia import):
```
http://localhost:3000/api-docs.json
```

**How to use Swagger UI:**
1. Open `http://localhost:3000/api-docs` in your browser
2. Use `POST /api/auth/register` to create an account — copy the `token` from the response
3. Click the **Authorize 🔒** button at the top → paste the token → click **Authorize**
4. All protected endpoints are now unlocked — click **Try it out** on any endpoint

---

**Base URL:** `http://localhost:3000`

All request bodies use `Content-Type: application/json`.
All protected endpoints require:
```
Authorization: Bearer <token>
```

---

### Auth Endpoints

#### Health Check
```
GET /health
```
**Response 200:**
```json
{
  "status": "success",
  "message": "Task Manager API is running",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

---

#### Register
```
POST /api/auth/register
```
**Body:**
```json
{
  "email": "alice@example.com",
  "password": "SecurePass1",
  "name": "Alice"
}
```

| Field      | Type   | Required | Rules                                      |
|------------|--------|----------|--------------------------------------------|
| `email`    | string | ✅       | Valid email format, unique                 |
| `password` | string | ✅       | Min 8 chars, 1 uppercase, 1 number         |
| `name`     | string | ❌       | Max 100 chars                              |

**Response 201:**
```json
{
  "status": "success",
  "message": "User registered successfully",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "a1b2c3d4-...",
      "email": "alice@example.com",
      "name": "Alice",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

**Errors:** `400` (validation failed), `409` (email already taken)

---

#### Login
```
POST /api/auth/login
```
**Body:**
```json
{
  "email": "alice@example.com",
  "password": "SecurePass1"
}
```

**Response 200:**
```json
{
  "status": "success",
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "a1b2c3d4-...",
      "email": "alice@example.com",
      "name": "Alice",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

**Errors:** `400` (validation), `401` (wrong credentials)

---

#### Get Profile 🔒
```
GET /api/auth/me
```

**Response 200:**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "a1b2c3d4-...",
      "email": "alice@example.com",
      "name": "Alice",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

**Errors:** `401` (missing / invalid / expired token)

---

### Task Endpoints

> All task endpoints require `Authorization: Bearer <token>`.

---

#### Create Task 🔒
```
POST /api/tasks
```
**Body:**
```json
{
  "title": "Submit assignment",
  "description": "Push to GitHub and share link",
  "dueDate": "2025-12-31",
  "status": "pending"
}
```

| Field         | Type   | Required | Rules                               |
|---------------|--------|----------|-------------------------------------|
| `title`       | string | ✅       | Max 200 chars                       |
| `description` | string | ❌       | Max 2000 chars                      |
| `dueDate`     | string | ❌       | ISO 8601 date (e.g. `2025-12-31`)  |
| `status`      | string | ❌       | `pending` or `completed`            |

**Response 201:**
```json
{
  "status": "success",
  "message": "Task created successfully",
  "data": {
    "task": {
      "id": "64f1a2b3c4d5e6f7a8b9c0d1",
      "title": "Submit assignment",
      "description": "Push to GitHub and share link",
      "dueDate": "2025-12-31T00:00:00.000Z",
      "status": "pending",
      "userId": "a1b2c3d4-...",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

**Errors:** `400` (validation), `401`

---

#### Get All Tasks 🔒
```
GET /api/tasks
GET /api/tasks?status=pending
GET /api/tasks?page=2&limit=10
```

| Query Param | Type    | Description                        |
|-------------|---------|------------------------------------|
| `status`    | string  | Filter: `pending` or `completed`   |
| `page`      | integer | Page number (default: 1)           |
| `limit`     | integer | Results per page (default: 20)     |

**Response 200:**
```json
{
  "status": "success",
  "data": {
    "tasks": [ ],
    "pagination": {
      "total": 42,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    }
  }
}
```

---

#### Get Task by ID 🔒
```
GET /api/tasks/:id
```

**Response 200:** Task object

**Errors:** `400` (invalid ID format), `401`, `403` (another user's task), `404`

---

#### Update Task 🔒
```
PATCH /api/tasks/:id
```
**Body** *(all fields optional)*:
```json
{
  "status": "completed",
  "title": "Submit assignment — DONE"
}
```

**Response 200:** Updated task object

**Errors:** `400`, `401`, `403`, `404`

---

#### Delete Task 🔒
```
DELETE /api/tasks/:id
```

**Response 200:**
```json
{
  "status": "success",
  "message": "Task deleted successfully"
}
```

**Errors:** `400`, `401`, `403`, `404`

---

## Error Handling

All errors follow a consistent shape:

```json
{
  "status": "error",
  "message": "Human-readable description"
}
```

Validation errors include an `errors` array:
```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Must be a valid email address" },
    { "field": "password", "message": "Password must be at least 8 characters" }
  ]
}
```

| Status | Meaning                                           |
|--------|---------------------------------------------------|
| `400`  | Bad request / validation failure                  |
| `401`  | Missing, invalid, or expired token                |
| `403`  | Authenticated but not authorized (wrong owner)    |
| `404`  | Resource or route not found                       |
| `409`  | Conflict (duplicate email)                        |
| `500`  | Internal server error (logged server-side)        |

---

## Running Tests

Tests use **Jest** + **Supertest** against real local databases.

```bash
# Ensure PostgreSQL and MongoDB are running, then:
npm test
```

To use separate test databases (recommended):
```bash
PG_DATABASE=taskmanager_test MONGO_URI=mongodb://localhost:27017/taskmanager_test npm test
```

Test files:
- `tests/auth.test.js` — register, login, profile, token validation
- `tests/tasks.test.js` — full CRUD, ownership enforcement, validation, pagination