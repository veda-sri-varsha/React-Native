# LevelUp 90

LevelUp 90 is a mobile-first Expo and React Native app for tracking a 90-day personal growth plan. It combines a private daily dashboard with manual DSA, learning, authorized lab, project, career, exercise, reflection, and weekly-review trackers. The Growth hub also includes an authenticated lead inbox for manually entered leads, with live updates through Socket.IO.

The app does not preload sample activity or claim that a plan was completed. Dashboard and analytics values come from records saved by the signed-in user. AI planning is optional; without an AI provider, the backend returns a deterministic, data-grounded suggestion. When enabled, relevant planning context is sent to the configured provider, so review its privacy terms before configuring it. Suggestions never change records unless the user chooses to add one.

## Run locally

Use Node.js **22.13 or newer**.

1. Install app dependencies and set the backend URL:

   ```powershell
   npm install
   Copy-Item .env.example .env
   ```

   For a physical phone, set `EXPO_PUBLIC_API_URL` in `.env` to your computer's LAN IP, for example `http://192.168.1.10:3000`. Do not use `localhost` on a phone. The computer and phone must share a network, and the firewall must allow port 3000.

2. Configure and start the backend in a second terminal:

   ```powershell
   Copy-Item server/.env.example server/.env
   npm --prefix server install
   npm --prefix server run dev
   ```

   Replace the placeholder `JWT_SECRET` in `server/.env`; never commit `.env` files. It must contain at least 32 characters. Account registration is open, so use this app only where open sign-up is appropriate.

3. Start Expo from the project root:

   ```powershell
   npm start
   ```

   Use Expo Go or a development build. On iOS and Android, access tokens are stored with Expo SecureStore. Web sessions are memory-only and end when the page is reloaded.

The backend health check is `GET /health`. SQLite is created at `server/data/leads.sqlite` and is excluded from Git.

## Environment variables

### App (`.env`)

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Reachable backend URL, including port. Use the computer's LAN IP for local phones and an HTTPS URL in deployment. This value is public, not a secret. |

### Backend (`server/.env`)

| Variable | Purpose |
| --- | --- |
| `PORT` | API and Socket.IO port; defaults to `3000`. |
| `DATABASE_PATH` | SQLite file path; defaults to `./data/leads.sqlite` relative to `server/`. |
| `JWT_SECRET` | Private signing key for one-hour access tokens; at least 32 characters. |
| `WORKSPACE_ID` | Workspace boundary for the existing lead inbox. |
| `ALLOWED_ORIGINS` | Comma-separated browser origins for CORS; native mobile requests have no browser origin. |
| `AI_API_ENDPOINT` | Optional OpenAI-compatible chat-completions endpoint. Leave unset to use local suggestions. |
| `AI_API_KEY` | Optional private provider key. The mobile app never receives this value. |
| `AI_MODEL` | Optional model name used by the configured endpoint. |
Never put AI keys or JWT secrets in `EXPO_PUBLIC_*` variables or the mobile app.

## Main app workflows

- **Today:** actual user name, challenge day, saved daily actions, challenge setup, and optional plan suggestions.
- **DSA:** problem records, attempt outcomes, revisions, and mock-test results.
- **Growth hub:** learning, authorized labs, projects and milestones, seven principles, exercise, weekly/daily reflection, the manual lead inbox, and settings.
- **Career:** job applications with validation that requires the real submission date before a record can be marked submitted.
- **Progress:** daily activity and saved-record analytics; days without a plan are not treated as failures.
- **Settings:** planning preferences, local theme selection, authenticated JSON export, and explicit account deletion.

Growth records are owner-scoped and validated by the backend. Passwords are bcrypt-hashed; API endpoints and Socket.IO connections require an expiring signed token. Account deletion requires typing `DELETE`.

## Checks

Run from the repository root:

```powershell
npx expo lint
npx tsc --noEmit
npm --prefix server test
npx expo-doctor
```

Mobile-device LAN connectivity must be tested on your network and deployment.
