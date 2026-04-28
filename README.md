# Insighta CLI

insighta is a globally installable command-line client for the Insighta+ backend APIs.

## Project Links

Use this table to jump across the full docs for each Insighta project.

| Project | Purpose | Docs |
| --- | --- | --- |
| Insighta CLI (this repo) | Terminal client for auth, profile search, export, and admin actions | [CLI README](https://github.com/JohnUghiovhe/Insighta-CLI#readme) |
| Insighta Labs Backend | API, auth, RBAC, natural-language parser, profile intelligence | [Backend README](https://github.com/JohnUghiovhe/insighta-backend#readme) |
| Insighta Web Frontend | Browser UI for auth and profile intelligence workflows | [Frontend README](https://github.com/JohnUghiovhe/insighta-web#readme) |

## Live URLs

| Surface | URL | Status |
| --- | --- | --- |
| Frontend | https://insighta-web-pied.vercel.app/ | Live |
| Backend Base | https://intelligence-query-engine-production.up.railway.app/ | Live |
| Backend Health | https://intelligence-query-engine-production.up.railway.app/health | Live |

## What Was Updated

The CLI behavior documented here now matches the current implementation:

- OAuth for CLI is the init and exchange flow (`GET /auth/github/init`, then `POST /auth/github/exchange`).
- `whoami` calls backend `GET /auth/me` and refreshes locally stored user metadata.
- Natural-language search docs now include parser behavior and concrete query examples.
- Cross-repo documentation links are now included, with a frontend placeholder for upcoming work.

## System Architecture

| Component | File | Responsibility |
| --- | --- | --- |
| Runtime entrypoint | `bin/insighta.js` | Boots compiled CLI runtime from `dist/index.js` |
| Command layer | `src/index.ts` | Registers CLI commands/options using commander |
| OAuth login client | `src/auth.ts` | PKCE generation, browser open, local callback listener |
| API client | `src/api.ts` | Authenticated requests, token refresh, export download |
| Credentials storage | `src/storage.ts` | Reads/writes local credentials file |
| Terminal UI | `src/ui.ts` | Spinner/status output and table rendering |

## CLI Usage

## Quick Run

```bash
insighta login
insighta whoami
insighta profiles list --limit 3
```

## Install And Build

```bash
npm install
npm run build
npm link
```

After linking, the command can be run from any directory:

```bash
insighta login
```

## Command Reference

| Area | Command | Notes |
| --- | --- | --- |
| Auth | `insighta login` | Starts browser-based GitHub OAuth with local callback server |
| Auth | `insighta logout` | Revokes refresh token and removes local credentials |
| Auth | `insighta whoami` | Calls `GET /auth/me` and shows user table |
| Profiles | `insighta profiles list [filters]` | Structured filter/sort/pagination query |
| Profiles | `insighta profiles get <id>` | Fetch one profile by id |
| Profiles | `insighta profiles search "<natural language>"` | Natural-language parser search |
| Profiles | `insighta profiles create --name "<name>"` | Admin-only create operation |
| Profiles | `insighta profiles export --format csv [filters]` | Writes CSV to current working directory |

## Authentication Flow (CLI)

`insighta login` performs a full PKCE login optimized for CLI usage:

1. Generate a local `state`, `code_verifier`, and `code_challenge` (`S256`).
2. Start temporary callback server on `http://<host>:<port><path>`.
3. Fetch GitHub client metadata from backend via `GET /auth/github/init`.
4. Open browser to GitHub authorize URL using local callback URL + PKCE values.
5. Capture `code` and `state` on callback.
6. Validate callback `state` against local generated state.
7. Exchange `code + code_verifier + redirect_uri` through `POST /auth/github/exchange`.
8. Persist tokens and user metadata into local credentials file.

## Natural Language Parsing Approach

`insighta profiles search "..."` calls `GET /api/profiles/search?q=...`.
The parser is deterministic and rule-based on the backend. It supports:

- gender words: male/man/men and female/woman/women
- age-group words: child, teenager, adult, senior, elderly
- young shortcut: maps to age range 16 to 24
- numeric age bounds:
  - above, over, older than, greater than `<n>`
  - below, under, younger than, less than `<n>`
- country phrase: `from <country name>` (must match known country names in stored profile data)

### Search Examples (CLI)

| CLI Query | Interpreted Filters | CLI Command |
| --- | --- | --- |
| young males from nigeria | `gender=male`, `min_age=16`, `max_age=24`, `country_id=NG` | `insighta profiles search "young males from nigeria"` |
| women above 30 | `gender=female`, `min_age=30` | `insighta profiles search "women above 30"` |
| teenage men from kenya | `gender=male`, `age_group=teenager`, `country_id=KE` | `insighta profiles search "teenage men from kenya"` |
| seniors under 70 | `age_group=senior`, `max_age=70` | `insighta profiles search "seniors under 70"` |
| adults from canada | `age_group=adult`, `country_id=CA` | `insighta profiles search "adults from canada"` |

When the parser cannot interpret a query, the backend returns `400 Unable to interpret query` and the CLI prints the error.

## Filtered List And Export Examples

```bash
insighta profiles list --gender male
insighta profiles list --country NG --age-group adult
insighta profiles list --min-age 25 --max-age 40
insighta profiles list --sort-by age --order desc
insighta profiles list --page 2 --limit 20

insighta profiles export --format csv
insighta profiles export --format csv --gender male --country NG
```

## Token Handling Approach

- Credentials are stored at `~/.insighta/credentials.json`.
- Protected requests include:
  - `Authorization: Bearer <access_token>`
  - `X-API-Version: 1`
- Access token expiry is checked before each protected request.
- If access token is expired and refresh token is valid, CLI calls `POST /auth/refresh` and stores rotated tokens.
- If refresh has expired or refresh fails, CLI asks the user to log in again.

## Role Enforcement Logic

Backend enforces authorization. CLI surfaces backend errors directly.

- Admin and analyst: list, get, search, export
- Admin only: create

## Environment Variables

| Variable | Default | Used For |
| --- | --- | --- |
| `INSIGHTA_API_BASE_URL` | `http://localhost:3021` | Backend base URL |
| `INSIGHTA_CALLBACK_PORT` | `8787` | Local callback server port |
| `INSIGHTA_CALLBACK_HOST` | `localhost` | Local callback server host |
| `INSIGHTA_CALLBACK_PATH` | `/callback` | Local callback route path |

## Branch And PR Policy

- Branch from `main` using concise prefixes such as `feat/`, `fix/`, `docs/`, or `chore/`.
- Keep PRs small and scoped to one feature or fix path.
- Merge only after CI checks pass (`lint`, `test`, `build`).
- Prefer squash merges with conventional commit-style summaries.

## Frontend Placeholder

The frontend is the browser counterpart to this CLI and now has a live deployment.

### Frontend Links

| Item | URL |
| --- | --- |
| Frontend Repo | https://github.com/JohnUghiovhe/insighta-web |
| Frontend Live App | https://insighta-web-pied.vercel.app/ |

### End-To-End Flow

- CLI login starts PKCE in the terminal and completes the OAuth exchange through the shared backend.
- Browser login uses the same backend auth system and keeps the web session aligned with CLI-issued account state.
- Both clients read from the same profile intelligence APIs, so search and profile results remain consistent.
- Backend token rotation and role checks remain the final source of truth when either client fails, times out, or loses session state.
