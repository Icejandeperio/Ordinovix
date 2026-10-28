# Deploy runbook (owner)

You run these steps; Claude Code never does (ADR-0002, section 4). Everything is done from a clone of the repository, in a
terminal, with `scripts/setup-cloudflare.mjs` (`npm run setup:cloudflare --`). The script creates what is missing and leaves
the rest alone, so running a phase again is safe. It keeps no Cloudflare credentials: each phase asks for the API token, uses
it for that run only, and ends with `wrangler logout`.

The order matters, because a Worker's secrets can only be set on a Worker that exists:

| # | Step | Who | Needs |
|---|---|---|---|
| 1 | Accounts and tools | you | Cloudflare account, GitHub CLI, Node 22+ |
| 2 | Cloudflare API token | you | the dashboard |
| 3 | Phase 1: `npm run setup:cloudflare` | script | token |
| 4 | Merge the database ids | you and CI | a pull request |
| 5 | Google OAuth client | you | the values phase 1 printed |
| 6 | Phase 2: `--secrets` | script | the preview Worker exists (step 4) |
| 7 | Phase 3: `--first-owner <email>` | script | step 4 |
| 8 | Reseed the preview Demo data | you | GitHub Actions |
| 9 | Check it | you | a browser |

## 1. Accounts and tools

- A **Cloudflare** account (Free plan is enough). In the dashboard open **R2 Object Storage** once and switch it on. R2 may ask for a
  payment card even on the free tier; you are not charged inside the free allowance (10 GB, and the app stays far below it).
- **GitHub CLI** signed in as the owner of the repository: `gh auth login`, then `gh auth status` must say you are logged in.
- **Node 22 or newer**, then in the clone: `npm ci`.
- A **Google** account for the Google Cloud console (step 5).

## 2. Create the Cloudflare API token

Dashboard, **My Profile, API Tokens, Create Token, Create Custom Token**. Name it `ordinovix`.

| Permission | Level |
|---|---|
| Account, Workers Scripts | Edit |
| Account, D1 | Edit |
| Account, Workers R2 Storage | Edit |
| Account, Account Settings | Read |

Account resources: include your account only. Create the token and keep it in a password manager; Cloudflare shows it once. Phase 1
saves a copy as the GitHub secret `CLOUDFLARE_API_TOKEN`, which is what CI deploys with. Nothing is stored on your laptop.

## 3. Phase 1, infrastructure

```text
npm run setup:cloudflare -- --dry-run     # prints the plan and calls nothing
npm run setup:cloudflare                  # asks for the token (typing is hidden)
```

It creates the D1 databases `ordinovix-preview` and `ordinovix`, the R2 buckets `ordinovix-preview-files` and `ordinovix-files`,
and a lifecycle rule that deletes objects under `backups/db/` in `ordinovix-files` after 84 days (12 weekly backups). It writes
the real database ids into `wrangler.jsonc`, sets the GitHub secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, and creates
the GitHub environment `production` with you as the only required reviewer (so every production release waits for your approval).

If the account has no `workers.dev` subdomain yet it asks you to pick one (for example `jan-santos`). Your sites are then
`https://ordinovix-preview.<subdomain>.workers.dev` and `https://ordinovix.<subdomain>.workers.dev`.

At the end it prints the exact **Google OAuth origins and redirect URIs** for local, preview and production. Keep that output for step 5.

## 4. Merge the database ids

Database ids are identifiers, not secrets. Commit the change to `wrangler.jsonc` on a branch, open a pull request, and merge it once
`verify` is green (or ask Claude Code to do this in the U32 session). After the merge, the **deploy-preview** workflow applies the
migrations, builds and deploys the preview Worker, and checks `/api/v1/health`. Watch it under **Actions**. Until step 6 the site
loads but nobody can sign in.

## 5. Create the Google OAuth client

[Google Cloud console](https://console.cloud.google.com/): create a project (for example `Ordinovix`).

1. **APIs and Services, OAuth consent screen**: user type External; app name Ordinovix; support email yours; scopes `openid`, `email`,
   `profile` only; **Publishing status: In production** (otherwise Google limits sign-in to test users and expires it after 7 days).
2. **Credentials, Create credentials, OAuth client ID**: type **Web application**.
3. Paste the **Authorized JavaScript origins** and **Authorized redirect URIs** that phase 1 printed (local, preview and production;
   production does not exist yet and that is fine).
4. Copy the **client ID** and **client secret**. You type them into phase 2.

## 6. Phase 2, secrets

```text
npm run setup:cloudflare -- --secrets
```

It prints the OAuth values again, then lists which secrets the preview Worker already has (names only). It generates the missing
`BETTER_AUTH_SECRET`, `FILE_URL_SIGNING_KEY`, `TIN_ENCRYPTION_KEY` and the VAPID key pair with `node:crypto`, asks you for
`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (hidden), and sends all of them to Cloudflare in one call. Nothing is printed or saved;
values differ per environment. Run it again later and it changes nothing. If the Worker does not exist yet it says so: finish step 4.

- `--rotate <NAME>` replaces one secret you name (for example after a leak). Rotating `BETTER_AUTH_SECRET` signs everyone out.
- `TIN_ENCRYPTION_KEY` is never replaced by the script: every stored TIN would become unreadable. Cloudflare cannot show the value
  again, so decide how you want to keep a recovery copy before production holds real data (see GO_LIVE.md).

## 7. Phase 3, the first owner

```text
npm run setup:cloudflare -- --first-owner you@example.org
```

Makes that Google account the owner of the preview **Demo organization** (an allowlist entry; the person is linked at their first
Google sign-in). Use the Google address you will sign in with. Safe to run again.

## 8. Reseed the preview Demo data

GitHub, **Actions, deploy-preview, Run workflow**, tick **Replace the preview Demo organization with fresh sample data**. The owner
you added in step 7 is kept; only the sample organization's rows are replaced. Do this whenever you want the preview back to a
clean sample state.

## 9. Check the preview

Open `https://ordinovix-preview.<subdomain>.workers.dev`, choose **Sign in with Google**, and confirm you see the Demo organization.
`/api/v1/health` answers `{"ok":true,...}`. Claude Code can run the read-only checks of the U32 list (health, 401 without a cookie,
deep links, security headers, no dev sign-in).

## Releasing production (later, after the client accepts the MVP)

Production stays empty and undeployed until you decide.

1. **Actions, deploy-production, Run workflow**, type `DEPLOY`, then approve the run as the required reviewer of the `production`
   environment. CI refuses a commit whose `verify` run did not pass. It migrates the production database, builds, deploys, and checks health.
2. `npm run setup:cloudflare -- --secrets --env production` (fresh values, different from preview).
3. `npm run setup:cloudflare -- --first-owner you@example.org --env production --org org-main --org-name "Your practice name"`.
4. Sign in on the production site; it starts with no sample data.

## Backups and the restore drill

The **backup-production** workflow exports the production database every Sunday into `ordinovix-files/backups/db/YYYY-MM-DD.sql`
(never as a GitHub artifact: the repository is public). Cloudflare also keeps 7 days of point-in-time history (D1 Time Travel).
Try a restore once before real data is stored. In a terminal where you set `CLOUDFLARE_API_TOKEN` yourself for this session, then close it:

```text
npx wrangler r2 object get ordinovix-files/backups/db/<date>.sql --remote --file restore.sql
npx wrangler d1 create ordinovix-restore-test
npx wrangler d1 execute ordinovix-restore-test --remote --file restore.sql
npx wrangler d1 execute ordinovix-restore-test --remote --command "SELECT COUNT(*) FROM clients"
npx wrangler d1 delete ordinovix-restore-test
npx wrangler logout
```

Delete `restore.sql` afterwards: it holds client data.

## If something goes wrong

| Symptom | Cause and fix |
|---|---|
| "R2 must be switched on first" | Open R2 Object Storage in the dashboard once, accept the terms (and the card prompt), run phase 1 again. |
| "This token can see no Cloudflare account" or "Check the token's permissions" | The token is missing a permission from step 2 or is limited to another account. Create it again. |
| "gh is not signed in" | `gh auth login`, then run phase 1 again. |
| Phase 2: "The Worker ... does not exist yet" | The deploy has not happened: finish step 4 and wait for deploy-preview to turn green. |
| deploy-preview says "skipped" | The database id in `wrangler.jsonc` is still the all-zero placeholder, or the GitHub secrets are missing: run phase 1 and merge the ids. |
| Google says "redirect_uri_mismatch" | The redirect URI in the Google client is not exactly `https://ordinovix-preview.<subdomain>.workers.dev/api/auth/callback/google`. |
| Sign-in works but the app says access is pending | The Google address is not an owner or invited member: run phase 3 with that address. |

What the script never does: print or save a secret, deploy a Worker, run migrations (CI does), or keep a login on your machine.
