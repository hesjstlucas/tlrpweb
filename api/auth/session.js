const { hasSessionSecret, readSession } = require("../_lib/auth");
const { hasGithubWriteConfig } = require("../_lib/github");

function parseAllowedRoles() {
  return (process.env.DISCORD_ALLOWED_ROLE_ID || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

module.exports = async function handler(req, res) {
  const session = readSession(req);
  const allowedRoles = parseAllowedRoles();
  const ownerConfigured = Boolean(process.env.DISCORD_OWNER_ID);
  const storageConfigured = hasGithubWriteConfig() || !process.env.VERCEL;
  const discordConfigured = Boolean(
    process.env.DISCORD_CLIENT_ID &&
      process.env.DISCORD_CLIENT_SECRET &&
      process.env.DISCORD_REDIRECT_URI &&
      hasSessionSecret() &&
      (ownerConfigured || (allowedRoles.length > 0 && process.env.DISCORD_GUILD_ID))
  );

  res.setHeader("Content-Type", "application/json");
  res.statusCode = 200;
  res.end(
    JSON.stringify({
      authenticated: Boolean(session),
      session: session || null,
      config: {
        discordConfigured,
        storageConfigured,
        ownerConfigured,
        roleConfigured: allowedRoles.length > 0,
        guildConfigured: Boolean(process.env.DISCORD_GUILD_ID),
        sessionSecretConfigured: hasSessionSecret()
      }
    })
  );
};
