# MindCare Backend (Consolidated)

This backend contains:
- FastAPI server (`chatbot.py`) for AI chat streaming and utilities
- Node Express server (`server.js`) for custom auth using `public.users` and Nodemailer emails

## Setup

Create `backend/.env` with:

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...  # server-side only

# Optional SMTP for emails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@example.com
SMTP_PASS=app-password
SMTP_FROM=MindCare <you@example.com>

# JWT
JWT_SECRET=change-this

# Frontend URL
FRONTEND_URL=http://localhost:8080
```

Install deps:
- Python (in `backend`): `pip install -r requirements.txt`
- Node (in `backend`): `npm install`

Start servers (in separate terminals):
- FastAPI: `python -m uvicorn chatbot:app --host 127.0.0.1 --port 8000`
- Node: `node server.js` (or `npm run dev` if you add it)

## API
- POST `/student/signup` — create user in `public.users` with hashed password
- POST `/student/login` — authenticate against `public.users`
- GET `/health` — health check

Ensure database has `public.users.password_hash` column (see `frontend/supabase/schema.sql`).