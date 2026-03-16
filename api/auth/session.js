const { hasSessionSecret, readSession } = require("../_lib/auth");
const { hasGithubWriteConfig } = require("../_lib/github");
const { getPermissionConfig } = require("../_lib/permissions");

module.exports = async function handler(req, res) {
  const session = readSession(req);
  const permissionConfig = getPermissionConfig();
  const ownerConfigured = Boolean(process.env.DISCORD_OWNER_ID);
  const guildConfigured = Boolean(process.env.DISCORD_GUILD_ID);
  const storageConfigured = hasGithubWriteConfig() || !process.env.VERCEL;
  const botConfigured = Boolean(process.env.DISCORD_BOT_TOKEN);
  const discordConfigured = Boolean(
    process.env.DISCORD_CLIENT_ID &&
      process.env.DISCORD_CLIENT_SECRET &&
      process.env.DISCORD_REDIRECT_URI &&
      hasSessionSecret() &&
      (ownerConfigured || (permissionConfig.anyRoleConfigured && guildConfigured))
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
        roleConfigured: permissionConfig.mediaRoleConfigured,
        guildConfigured,
        sessionSecretConfigured: hasSessionSecret(),
        mediaRoleConfigured: permissionConfig.mediaRoleConfigured,
        applicationCreatorConfigured: permissionConfig.applicationCreatorConfigured,
        applicationManagerConfigured: permissionConfig.applicationManagerConfigured,
        botConfigured
      }
    })
  );
};
