const { createStateCookie, generateDiscordState, hasSessionSecret } = require("../../_lib/auth");

module.exports = async function handler(req, res) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri || !hasSessionSecret()) {
    res.writeHead(302, { Location: "/media.html?auth=misconfigured" });
    res.end();
    return;
  }

  const state = generateDiscordState();
  const authorizationUrl = new URL("https://discord.com/oauth2/authorize");

  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("scope", "identify guilds.members.read");
  authorizationUrl.searchParams.set("state", state);

  res.setHeader("Set-Cookie", createStateCookie(state));
  res.writeHead(302, { Location: authorizationUrl.toString() });
  res.end();
};
