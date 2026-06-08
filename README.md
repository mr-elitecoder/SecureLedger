# SecureLedger

SecureLedger is a full-stack payment and auditing prototype that combines:
- a Node.js + Express backend,
- a MySQL database with stored procedures,
- a static frontend served from `frontend/`,
- JWT-based authentication,
- admin fraud and audit monitoring.

---

## Project Overview

SecureLedger is designed to support:
- user registration and login,
- secure fund transfers between accounts,
- transaction history and dashboard summaries,
- admin analytics, fraud alert review, and audit logging.

The backend lives in `backend/` and serves the static frontend from `frontend/`.

---

## Architecture

- `backend/server.js` — main Express entry point
- `backend/config/db.js` — MySQL connection pool
- `backend/middleware/auth.js` — JWT auth and admin authorization
- `backend/routes/` — API routes
- `backend/Database/` — SQL schema, stored procedures, and DB scripts
- `frontend/` — static frontend assets

---

## Key Features

- User registration and login
- Password hashing with `bcryptjs`
- JWT authentication via `jsonwebtoken`
- Secure transfer stored procedure `transfer_funds`
- Transaction history stored procedure `get_transaction_history`
- Admin analytics and fraud alert management
- Audit log support
- Static frontend served from Express

---

## Folder Structure

```text
backend/
  package.json
  server.js
  config/
    db.js
  middleware/
    auth.js
  routes/
    auth.js
    users.js
    transactions.js
    admin.js
  Database/
    Schema.sql
    procedures.sql
    ...
frontend/
  index.html
  dashboard.html
  admin.html
  index.js
  dashboard.js
  admin.js
  index.css
  dashboard.css
  admin.css
```

---

## Prerequisites

- Node.js (recommended 18+)
- npm
- MySQL database
- `git` for source control

---

## Setup

1. Clone the project
2. Navigate to the backend folder
3. Install dependencies
4. Create a `.env` file
5. Start the server

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
DB_USER=your_db_username
DB_PASSWORD=your_db_password
DB_CONNECT_STRING=localhost:1521/ORCLPDB1
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=1d
PORT=5000
# Optional: Oracle Instant Client directory path
# ORACLE_CLIENT_LIB_DIR=C:\oracle\instantclient_19_12
```

---

## Run Locally

```bash
cd backend
npm run dev
```

Then open the frontend in your browser:
- `http://localhost:5000/`

---

## API Endpoints

### Authentication

- `POST /api/auth/register`
  - Body: `{ full_name, email, password }`
- `POST /api/auth/login`
  - Body: `{ email, password }`
- `GET /api/auth/profile`
  - Header: `Authorization: Bearer <token>`

### User Routes

- `GET /api/users/list`
  - returns active users for transfers
- `GET /api/users/me/balance`
  - returns current user balance
- `GET /api/users/me/summary`
  - returns dashboard stats
- `GET /api/users/me/trends`
  - returns recent transaction trend data
- `GET /api/users/search?q=...`
  - search active users by name/email

### Transaction Routes

- `POST /api/transactions/transfer`
  - Body: `{ receiver_id, amount, description }`
- `GET /api/transactions/history?limit=20`
  - returns recent transactions for current user
- `GET /api/transactions/:id`
  - returns a single transaction detail

### Admin Routes

Requires `role: admin` in JWT.

- `GET /api/admin/analytics/overview`
- `GET /api/admin/fraud-alerts`
- `PUT /api/admin/fraud-alerts/:id/review`
- `GET /api/admin/users`
- `PUT /api/admin/users/:id/toggle-status`
- `GET /api/admin/audit-log?limit=50`

### Health Check

- `GET /api/health`

---

## Database

The project uses MySQL and includes:
- connection pooling in `backend/config/db.js`
- stored procedures in `backend/Database/procedures.sql`
- schema and sample SQL files in `backend/Database/`

Important stored procedures:
- `transfer_funds(...)`
- `get_transaction_history(...)`

---

## Security Notes

- Passwords are hashed using `bcryptjs`
- JWT tokens are signed with `JWT_SECRET`
- Admin-only routes are protected with `adminOnly` middleware

---

## Notes

- The frontend is static and served from `frontend/`
- The backend serves both API and frontend
- There are currently no automated tests in `backend/package.json`

---

## Future Improvements

- Add unit/integration tests
- Add user role management UI
- Add rate limiting and input sanitization
- Add production deployment guide
