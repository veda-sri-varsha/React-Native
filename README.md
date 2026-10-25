# LevelUp 90

LevelUp 90 is a mobile-first Expo and React Native app for tracking a 90-day personal growth plan. It combines a private daily dashboard with manual DSA, learning, authorized lab, project, career, exercise, reflection, and weekly-review trackers. The existing authenticated lead inbox and Meta Lead Ads webhook workflow remain available from the Growth hub.

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

   Replace the placeholder secrets in `server/.env`. Generate independent random values for `JWT_SECRET`, `SIGNUP_INVITE_CODE`, and `META_WEBHOOK_VERIFY_TOKEN`; never commit `.env` files. `JWT_SECRET` must contain at least 32 characters. Registration is invite-only by default.

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
| `ALLOW_PUBLIC_SIGNUP` | Defaults to `false`; keep invite-only registration for shared deployments. |
| `SIGNUP_INVITE_CODE` | Secret invite code required when public registration is disabled. |
| `ALLOWED_ORIGINS` | Comma-separated browser origins for CORS; native mobile requests have no browser origin. |
| `AI_API_ENDPOINT` | Optional OpenAI-compatible chat-completions endpoint. Leave unset to use local suggestions. |
| `AI_API_KEY` | Optional private provider key. The mobile app never receives this value. |
| `AI_MODEL` | Optional model name used by the configured endpoint. |
| `META_WEBHOOK_VERIFY_TOKEN` | Private value used only for Meta's webhook GET verification. |
| `META_APP_SECRET` | Meta app secret used to verify `X-Hub-Signature-256` against the raw POST body. |
| `META_PAGE_ACCESS_TOKEN` | Authorized Page access token used only by the backend for Graph API retrieval. |
| `META_PAGE_ID` | The Page whose lead notifications this deployment accepts. |
| `META_GRAPH_API_VERSION` | Graph API version currently supported by your Meta app, in `vNN.N` format. |

Never put Meta secrets, Page tokens, AI keys, JWT secrets, or invite codes in `EXPO_PUBLIC_*` variables or the mobile app.

## Meta Lead Ads setup

The callback must be a publicly reachable HTTPS URL: `https://<public-host>/webhooks`. A LAN URL is not sufficient. In your Meta app, configure this callback and the verification token, subscribe the Page to the `leadgen` webhook field, and grant the app and Page the permissions required to retrieve leads. Meta documentation lists permissions including `leads_retrieval`, `pages_show_list`, `pages_read_engagement`, and `pages_manage_ads`; webhook subscriptions also require `pages_manage_metadata`. Confirm the current requirements for your app, Page, and API version.

`GET /webhooks` returns the challenge only for a valid `subscribe` request and configured token. `POST /webhooks` verifies the HMAC signature before parsing, extracts the Page and lead IDs from a `leadgen` change, fetches permitted lead fields with the configured Graph API version and Page token, persists the lead, and emits the authenticated Socket.IO event `lead:new`. Failed retrievals are returned as errors for retry. Completed webhook IDs are deduplicated.

The credentials, Page permissions, public HTTPS deployment, and a real Lead Ads Testing Tool delivery are external prerequisites. Automated tests use mocked Graph API responses; they do **not** prove a real Meta callback or credential setup works.

Official references:

- [Meta Webhooks](https://developers.facebook.com/docs/graph-api/webhooks/)
- [Meta Lead Ads: retrieving leads](https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/lead-ads/retrieving)

## Main app workflows

- **Today:** actual user name, challenge day, saved daily actions, challenge setup, and optional plan suggestions.
- **DSA:** problem records, attempt outcomes, revisions, and mock-test results.
- **Growth hub:** learning, authorized labs, projects and milestones, seven principles, exercise, weekly/daily reflection, the existing lead inbox, and settings.
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

Meta production setup and mobile-device LAN connectivity must be tested with your own credentials and deployment.
