# E-Healthcare Advisor

Frontend + backend web app for an e-healthcare portal.

## Current Status
- Frontend cleaned and standardized with shared CSS and JS.
- Backend API added with auth, doctors, appointments, articles, and chatbot endpoints.
- Frontend pages are connected to backend APIs.

## Pages
- `login.html` - login
- `newreg.html` - registration
- `project.html` - home/dashboard
- `doc.html` - specialization guidance
- `app.html` - appointment booking
- `art.html` - articles listing + publish
- `read-articles.html` - category-based article reader
- `contact.html` - support/contact details
- `ai.html` - AI chatbot page

## Shared Assets
- `assets/css/styles.css` - global design system and components
- `assets/js/main.js` - navigation helpers + API client (`AppApi`)

## Backend
- Location: `backend/`
- Runtime: Node.js + Express
- Data store: JSON file (`backend/src/data/store.json`)
- Auth: `bcrypt` password hashing + JWT bearer tokens with expiry

### API Endpoints
- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/specializations`
- `GET /api/doctors?specialization=...`
- `POST /api/appointments`
- `GET /api/appointments/me`
- `GET /api/articles`
- `GET /api/articles?category=...`
- `GET /api/article-categories`
- `POST /api/articles`
- `POST /api/chat`

## Run Locally
1. Start backend:
```bash
cd backend
npm install
npm run dev
```
2. Open frontend pages with Live Server (or any static server) from project root.
3. Backend base URL is set to `http://localhost:4000/api`.

## Demo Login
- Username: `demo`
- Password: `demo12345`

## Auth Environment Variables
- `JWT_SECRET` - secret used to sign tokens (set this in production)
- `JWT_EXPIRES_IN` - token expiry (default: `2h`)

Example (PowerShell):
```powershell
$env:JWT_SECRET="change-this-secret"
$env:JWT_EXPIRES_IN="2h"
npm run dev
```

## Migration Note
- Existing users with plain `password` fields are auto-migrated to `passwordHash` on backend startup.
