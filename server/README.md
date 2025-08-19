# Admin Platform Server

Env vars: `PORT`, `MONGODB_URI`, `JWT_SECRET`

- Dev: `npm run dev`
- Build: `npm run build`
- Start: `npm start`

API Overview:
- POST `/api/auth/login` { email, password }
- Users CRUD `/api/users` (auth: teacher/admin)
- Scores: 
  - GET `/api/scores/user/:userId?courseId=xxx`
  - PUT `/api/scores/user/:userId` (teacher/admin)
  - GET `/api/scores/class/:className?courseId=xxx` (teacher/admin) 