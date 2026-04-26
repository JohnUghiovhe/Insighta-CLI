# Insighta CLI

`insighta` is a globally installable command-line client for the Insighta+ backend APIs.

## Reviewer Quick Run

```bash
insighta login
insighta whoami
insighta profiles list --limit 3
```

## System Architecture

- **Runtime entrypoint**: `bin/insighta.js` loads `dist/index.js`.
- **Command layer**: `src/index.ts` defines commands with `commander`.
- **Auth flow**: `src/auth.ts` runs GitHub OAuth PKCE for CLI login.
- **API client**: `src/api.ts` sends authenticated requests and handles refresh.
- **Credential storage**: `src/storage.ts` reads/writes local credential files.
- **Terminal UX**: `src/ui.ts` renders loaders (`ora`) and structured tables (`table`).

## Authentication Flow

`insighta login` performs a full OAuth PKCE login optimized for CLI usage:

1. Generate `state`, `code_verifier`, and `code_challenge` (`S256`).
2. Start a temporary local callback server at `http://127.0.0.1:<port>/callback`.
3. Fetch GitHub OAuth client config from backend: `GET /auth/github/init`.
4. Open browser to GitHub authorize URL with PKCE and state.
5. Capture callback (`code`, `state`) on the local server.
6. Validate returned state against generated state.
7. Exchange code via backend: `POST /auth/github/exchange`.
8. Persist returned tokens + user metadata locally.

## CLI Usage

### Install globally

```bash
npm install
npm run build
npm link
```

After install, this works from any directory:

```bash
insighta login
```

### Auth Commands

```bash
insighta login
insighta logout
insighta whoami
```

### Profile Commands

```bash
insighta profiles list
insighta profiles list --gender male
insighta profiles list --country NG --age-group adult
insighta profiles list --min-age 25 --max-age 40
insighta profiles list --sort-by age --order desc
insighta profiles list --page 2 --limit 20

insighta profiles get <id>
insighta profiles search "young males from nigeria"
insighta profiles create --name "Harriet Tubman"
insighta profiles export --format csv
insighta profiles export --format csv --gender male --country NG
```

## Token Handling Approach

- Credentials are stored at `~/.insighta/credentials.json`.
- Every protected request includes:
  - `Authorization: Bearer <access_token>`
  - `X-API-Version: 1`
- Before each request, access token expiry is checked.
- If access token is expired but refresh token is still valid:
  - CLI calls `POST /auth/refresh`
  - Stores the rotated access/refresh token pair.
- If refresh is expired or refresh fails:
  - CLI prompts re-authentication: `Session expired. Please run: insighta login`.

## Role Enforcement Logic

Authorization is enforced by the backend; CLI surfaces errors clearly.

- **admin + analyst**:
  - `profiles list`
  - `profiles get`
  - `profiles search`
  - `profiles export`
- **admin only**:
  - `profiles create`

If a role does not have access, backend returns an error (e.g. `403`), and CLI prints it as:

```text
Error: <backend message>
```

## Verification (Demo Checklist + Exact Example Outputs)

Run the following during review:

### 1) Global command works from any directory

```bash
insighta --help
```

Expected output:

```text
Usage: insighta [options] [command]

Insighta Labs CLI

Options:
  -V, --version    output the version number
  -h, --help       display help for command

Commands:
  login [options]  Authenticate with GitHub OAuth
  logout           Revoke session and clear local credentials
  whoami           Show current authenticated user
  profiles         Profile operations
  help [command]   display help for command
```

### 2) Login flow

```bash
insighta login
```

Expected output pattern:

```text
- Starting OAuth login flow...
✔ Starting OAuth login flow...
Logged in as <github-username>
Credentials saved to <home>/.insighta/credentials.json
```

### 3) Who am I (table output)

```bash
insighta whoami
```

Expected output structure:

```text
+------------+---------------------------+
| Field      | Value                     |
+------------+---------------------------+
| ID         | <uuid>                    |
| Username   | <github-username>         |
| GitHub ID  | <github-id>               |
| Email      | <email-or->               |
| Role       | analyst                   |
| Active     | true                      |
| Last Login | <iso-date>                |
+------------+---------------------------+
```

### 4) List profiles (loader + table + pagination summary)

```bash
insighta profiles list --gender male --country NG --page 1 --limit 5
```

Expected output pattern:

```text
- Fetching profiles...
✔ Fetching profiles...
+--------------------------------------+----------------+--------+-----+----------+----------------------+----------+-----------+---------------------+
| ID                                   | Name           | Gender | Age | Age Group| Country              | Gender P | Country P | Created             |
+--------------------------------------+----------------+--------+-----+----------+----------------------+----------+-----------+---------------------+
| <uuid>                               | <name>         | male   | 34  | adult    | Nigeria (NG)         | 0.99     | 0.98      | <local datetime>    |
+--------------------------------------+----------------+--------+-----+----------+----------------------+----------+-----------+---------------------+
page=1 limit=5 total=<n> total_pages=<m>
```

### 5) Export CSV to current working directory

```bash
insighta profiles export --format csv --gender male --country NG
```

Expected output pattern:

```text
- Exporting profiles...
✔ Exporting profiles...
CSV exported to <current-working-directory>/profiles_<timestamp>.csv
```

### 6) Token expiry handling

Wait until access token expires, then run:

```bash
insighta profiles list
```

Expected behavior:

- Request succeeds after automatic refresh (no manual action needed), or
- If refresh token is no longer valid:

```text
Error: Session expired. Please run: insighta login
```

### 7) Clear error messaging

If not logged in and calling a protected endpoint:

```bash
insighta profiles list
```

Expected output:

```text
Error: You are not logged in. Run: insighta login
```
