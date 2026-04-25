# EduShare Backend

Node.js + Express backend for an educational resource sharing platform with AI-powered study planning.

## Overview

EduShare Backend provides:

- User authentication with JWT
- Study material upload and moderation flow
- Admin approval/rejection workflow
- AI-powered study plan generation from syllabus/notes PDFs
- AI study assistant endpoints (chat, chapter guidance, question answering)

## Tech Stack

- Node.js
- Express 5
- MongoDB + Mongoose
- JWT + bcrypt
- Multer (in-memory upload)
- Cloudinary (PDF storage)
- Google Gemini API

## Project Structure

```text
.
├── connection.js
├── index.js
├── package.json
├── controllers/
├── middlewares/
├── models/
├── routes/
└── utils/
```

## API Base URL

Default local base URL:

```text
http://localhost:<PORT>/api
```

Health check:

```text
GET /
```

## Environment Variables

Create a `.env` file in the project root:

```env
PORT=5000
MONGODB_URL=mongodb://127.0.0.1:27017/edushare
JWT_SECRET=replace_with_strong_secret

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_FOLDER=edushare/materials

# Gemini
GEMINI_API_KEY=your_gemini_api_key
# Optional fallback used by code
# GOOGLE_API_KEY=your_google_api_key

# Optional (used by googleDrive utility)
# GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com
# GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
# GOOGLE_DRIVE_FOLDER_ID=shared_drive_folder_id
```

## Installation and Run

1. Install dependencies:

```bash
npm install
```

2. Start in development mode:

```bash
npm run dev
```

3. Start in production mode:

```bash
npm start
```

## Auth

Protected routes require:

```text
Authorization: Bearer <token>
```

Token is returned from signup/login.

## Core Workflows

### 1. User and Authentication

- Signup and login
- Fetch current user profile
- User dashboard with upload stats and saved study plans

### 2. Material Sharing

- Users upload materials (`PDF` or `Link`)
- User uploads are created with `pending` status
- Public material listing only returns `approved` materials

### 3. Admin Moderation

- Admin can list materials by status
- Admin can approve/reject pending uploads
- Admin can upload materials directly as approved

### 4. AI Study Guide

- Generate personalized plan from chapters + syllabus PDF + optional notes PDF + YouTube playlist
- Save plan for authenticated users
- Retrieve/update plan status
- AI helper endpoints for general chat, chapter guidance, and question answering

## API Endpoints

### Auth (`/api/auth`)

- `POST /signup`
- `POST /login`
- `GET /me` (protected)
- `GET /dashboard` (protected)

### Materials (`/api/materials`)

- `GET /` - List approved materials (supports query filters: `branch`, `semester`, `subject`, `category`)
- `POST /` (protected, multipart) - Upload material
  - `type=PDF`: send file in `file`
  - `type=Link`: send `fileUrl`

### Admin (`/api/admin`)

All admin routes are protected and require admin role.

- `GET /materials?status=pending|approved|rejected`
- `PATCH /materials/:id/approve`
- `PATCH /materials/:id/reject`
- `POST /materials` (multipart, same payload as material upload, auto-approved)

### Study Guide (`/api/study-guide`)

- `POST /generate-plan` (optional auth, multipart)
  - Files:
    - `syllabusPdf` (required, PDF)
    - `notesPdf` (optional, PDF)
  - Body fields:
    - `subject` (required)
    - `chapters` (required, array/string)
    - `prepWeeks` (required)
    - `learningGoal` (required)
    - `examType` (required)
    - `youtubePlaylist` (required, valid playlist URL with `list=`)
    - `branch` (optional)
    - `semester` (optional)
- `POST /chat`
- `POST /chapter-guidance`
- `POST /answer-question`
- `GET /my-plans` (protected)
- `GET /plan/:id` (protected)
- `PATCH /plan/:id/status` (protected, status: `active|completed|archived`)

## Validation Rules and Limits

- Allowed branches: `IT`, `CE`, `CSE`
- Material categories: `syllabus`, `papers`, `notes`, `playlists`, `solutions`, `books`
- Material types: `PDF`, `Link`
- Semester range: `1-8`
- Upload limit: `5 MB` per PDF
- Upload middleware accepts `application/pdf` only

## Standard Response Pattern

Success:

```json
{
  "success": true,
  "message": "...",
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "message": "..."
}
```

## Notes

- `utils/googleDrive.js` is available but current upload flow uses Cloudinary.
- CORS is configured with `origin: true` and `credentials: true`.
- No automated tests are currently configured in `package.json`.

## License

ISC
