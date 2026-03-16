# TLRP Landing Page

Standalone Tallahassee City Roleplay site for Vercel.

## One-step env setup

If you do not want to add the Vercel environment variables by hand, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-vercel-env.ps1
```

That script:

- asks for the Discord and GitHub values once
- generates `SESSION_SECRET` for you
- saves a private local copy to `.env.vercel.local`
- uploads the values to Vercel through the CLI or `npx vercel`
- starts a production deploy after the upload finishes

You still need to add the redirect URL it prints into the Discord Developer Portal, because Discord controls that setting on their side.

## Main pages

- `index.html` is the homepage.
- `rules.html` contains the server rules.
- `departments.html` contains the departments page.
- `applications.html` contains the public application buttons plus the staff-side form builder and review queue.
- `apply.html` is the hidden player-facing form page that opens from the application buttons and is not linked in the main nav.
- `chain-of-command.html` shows the leadership structure.
- `media.html` shows the public media gallery and the Discord-gated publishing tools.

## Data files

- `data/application-forms.json` stores the live player-facing application forms built by Directive+.
- `data/applications.json` stores submitted player applications and management review decisions.
- `data/chain-of-command.json` powers the chain-of-command page.
- `data/media.json` stores media gallery entries.

## Application tracker access

The public application buttons are visible to everyone, but building forms and reviewing submissions are role-gated.

Allowed actions are:

- `DISCORD_APPLICATION_CREATOR_ROLE_ID` for Directive+ users who should create application forms
- `DISCORD_APPLICATION_MANAGER_ROLE_ID` for Management+ users who should review submitted applications

Each value can be a single role ID or a comma-separated list if you want multiple roles to count.

Workflow:

1. Directive+ creates a form on `applications.html`.
2. The site turns that into a large public application button.
3. Players click the button and open `apply.html?id=...` in a new tab.
4. Players must sign in with Discord before they can submit.
5. Management+ reviews submissions on `applications.html`.
6. Accepted, denied, or pending updates can send a Discord DM to the applicant if `DISCORD_BOT_TOKEN` is configured.

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
- `DISCORD_BOT_TOKEN`
- `SESSION_SECRET`

`SESSION_SECRET` should be a strong random string with at least 16 characters.

`DISCORD_BOT_TOKEN` is required if you want accept, deny, and pending decisions to DM the applicant automatically.

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
