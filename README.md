# TLRP Landing Page

Standalone Tallahassee City Roleplay site for Vercel.

## Main pages

- `index.html` is the homepage.
- `rules.html` contains the server rules.
- `departments.html` contains the departments page.
- `applications.html` contains the application tracker.
- `chain-of-command.html` shows the leadership structure.
- `media.html` shows the public media gallery and the Discord-gated publishing tools.

## Data files

- `data/applications.json` stores the application tracker entries.
- `data/chain-of-command.json` powers the chain-of-command page.
- `data/media.json` stores media gallery entries.

## Application tracker access

The application tracker is public to view, but staff actions are role-gated.

Allowed actions are:

- `DISCORD_APPLICATION_CREATOR_ROLE_ID` for Directive+ users who should create application records
- `DISCORD_APPLICATION_MANAGER_ROLE_ID` for Management+ users who should accept or deny records

Each value can be a single role ID or a comma-separated list if you want multiple roles to count.

## Chain of command editing

The chain of command is intentionally website read-only.

To update it:

1. Edit `data/chain-of-command.json`.
2. Commit and push the change.
3. Let Vercel redeploy the site.

Only people with access to the repository file can change that page.

## Media publishing access

The media page is public to view, but posting is restricted.

Allowed publishers are:

- The Discord user ID set in `DISCORD_OWNER_ID`
- Members of your server who have the role ID listed in `DISCORD_ALLOWED_ROLE_ID`

On Vercel, new media items are written back into `data/media.json` through the GitHub API, so media publishing needs both Discord OAuth variables and GitHub write variables.

## Required Vercel environment variables

### Discord auth

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI`
- `SESSION_SECRET`

`SESSION_SECRET` should be a strong random string with at least 16 characters.

### Access control

- `DISCORD_OWNER_ID`
- `DISCORD_ALLOWED_ROLE_ID`
- `DISCORD_APPLICATION_CREATOR_ROLE_ID`
- `DISCORD_APPLICATION_MANAGER_ROLE_ID`
- `DISCORD_GUILD_ID`

Notes:

- `DISCORD_ALLOWED_ROLE_ID` can be a single role ID or a comma-separated list.
- `DISCORD_APPLICATION_CREATOR_ROLE_ID` can be a single role ID or a comma-separated list.
- `DISCORD_APPLICATION_MANAGER_ROLE_ID` can be a single role ID or a comma-separated list.
- If you only want the owner account to post, you can leave `DISCORD_ALLOWED_ROLE_ID` empty.
- If the owner should also handle applications, `DISCORD_OWNER_ID` already overrides the role checks.
- If you use role-based access, `DISCORD_GUILD_ID` must also be set.

### GitHub writeback for media posts

- `GITHUB_REPOSITORY`
- `GITHUB_BRANCH`
- `GITHUB_TOKEN`

Example values:

- `GITHUB_REPOSITORY=hesjstlucas/tlrpweb`
- `GITHUB_BRANCH=main`
- `GITHUB_TOKEN=<github-personal-access-token-with-repo-contents-write-access>`

## Discord redirect URL

Set your Discord OAuth redirect URL to:

`https://your-vercel-domain.vercel.app/api/auth/discord/callback`

Replace the domain with your real Vercel domain or custom domain.

## Deploy on Vercel

1. Import the GitHub repo into Vercel.
2. Set the framework preset to `Other`.
3. Add the environment variables above.
4. Redeploy after saving the variables.
