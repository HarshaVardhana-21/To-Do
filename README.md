# TaskFlow: Full-Stack To-Do App

A to-do application with separate frontend and backend folders:

| Layer    | Stack |
|----------|-------|
| Frontend | Vite 8, React 19, TypeScript, Tailwind CSS v4, React Router 7 |
| Backend  | Node.js, Express 5, TypeScript, Mongoose 9, Zod 4, JWT auth |
| Database | MongoDB Atlas |

## Features
- **Accounts:** sign up and sign in with email and password. Passwords are hashed with bcrypt, sessions use JWT, and each user sees only their own tasks.
- **Tasks:** create, edit, delete, and mark tasks complete or not complete. Each task has a title, description, priority (low, medium or high), due date and tags.
- **Filtering and sorting:** filter by status (All, Active, Completed) and by priority. Search is debounced. Sort by date created, due date, priority or title, in either order.
- **Stats:** counts for total, active, completed and overdue tasks, a progress bar, and highlighting for overdue tasks.
- **Clear completed:** delete all completed tasks at once, after a confirmation.
- **Interface:** optimistic updates, toast notifications, loading skeletons and empty states.
- **Dark mode:** a toggle that is remembered between visits and respects the OS setting. The layout is responsive.
- **Hardening:** Helmet, CORS allow-list, rate limiting on the auth routes, input validation, and a consistent error format.

## Project structure
```
To Do/
├── backend/            Express REST API
│   └── src/
│       ├── config/       env validation, DB connection
│       ├── models/       User, Todo (Mongoose)
│       ├── validators/   Zod request schemas
│       ├── middleware/   auth, validate, error handler
│       ├── controllers/  route handlers
│       ├── routes/       /api/auth, /api/todos
│       ├── utils/        ApiError, JWT helpers
│       ├── app.ts        Express app
│       └── server.ts     entry point
└── frontend/           Vite + React SPA
    └── src/
        ├── api/          axios client + endpoint wrappers
        ├── context/      AuthProvider
        ├── hooks/        useAuth, useTodos, useTheme, useDebounce
        ├── components/   UI components
        ├── pages/        Login, Register, Dashboard, 404
        └── lib/          helpers
```

## Setup

### 1. MongoDB Atlas
1. Create a free cluster at <https://cloud.mongodb.com>.
2. Under **Database Access**, create a database user.
3. Under **Network Access**, add your IP address (or `0.0.0.0/0` for development).
4. Go to **Connect > Drivers** and copy the connection string.

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env     # Windows PowerShell: Copy-Item .env.example .env
```
Edit `backend/.env`:
```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/todo-app?retryWrites=true&w=majority
JWT_SECRET=<a long random string, 32+ chars>
```
To generate a secret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

```bash
npm run dev              # http://localhost:5000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev              # http://localhost:5173
```
In development, Vite proxies `/api` to `http://localhost:5000`, so the frontend needs no extra configuration.

## Scripts
| Location | Command | What it does |
|---|---|---|
| backend  | `npm run dev` | Starts the API with hot reload (tsx watch) |
| backend  | `npm run build` / `npm start` | Compiles to `dist/` and runs it |
| backend  | `npm run typecheck` | Type-checks without emitting files |
| frontend | `npm run dev` | Starts the Vite dev server |
| frontend | `npm run build` / `npm run preview` | Builds for production and previews the build |
| frontend | `npm run lint` | Runs oxlint |

## API reference
All responses use the shape `{ success, data }` or `{ success: false, message, details? }`.
Routes under `/api/todos` require the header `Authorization: Bearer <token>`.

| Method | Endpoint | Body / Query |
|---|---|---|
| GET | `/api/health` | none |
| POST | `/api/auth/register` | `{ name, email, password }` |
| POST | `/api/auth/login` | `{ email, password }` |
| GET | `/api/auth/me` | none |
| GET | `/api/todos` | `?status=all\|active\|completed&priority=all\|low\|medium\|high&search=&tag=&sort=createdAt\|dueDate\|priority\|title&order=asc\|desc` |
| GET | `/api/todos/stats` | none |
| POST | `/api/todos` | `{ title, description?, priority?, dueDate?, tags?, completed? }` |
| GET | `/api/todos/:id` | none |
| PATCH | `/api/todos/:id` | any subset of the create fields |
| DELETE | `/api/todos/:id` | none |
| DELETE | `/api/todos/completed` | none |

## Production notes
- Backend: set `NODE_ENV=production` and set `CLIENT_URL` to your deployed frontend origin. Separate multiple origins with commas.
- Frontend: set `VITE_API_URL` to the backend URL (for example `https://api.example.com/api`) before running `npm run build`, then deploy the `dist/` folder to any static host. Configure the host to serve SPA routes by falling back to `index.html`.
