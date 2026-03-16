const {
  clearStateCookie,
  createSessionCookie,
  hasSessionSecret,
  readState
} = require("../../_lib/auth");

function parseAllowedRoles() {
  return (process.env.DISCORD_ALLOWED_ROLE_ID || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

module.exports = async function handler(req, res) {
  const { code, state } = req.query;
  const expectedState = readState(req);
  const allowedRoles = parseAllowedRoles();
  const guildId = process.env.DISCORD_GUILD_ID || "";
  const ownerId = process.env.DISCORD_OWNER_ID || "";

  if (
    !process.env.DISCORD_CLIENT_ID ||
    !process.env.DISCORD_CLIENT_SECRET ||
    !process.env.DISCORD_REDIRECT_URI ||
    !hasSessionSecret() ||
    (allowedRoles.length > 0 && !guildId) ||
    (!ownerId && allowedRoles.length === 0)
  ) {
    res.setHeader("Set-Cookie", clearStateCookie());
    res.writeHead(302, { Location: "/media.html?auth=misconfigured" });
    res.end();
    return;
  }

  if (!code || !state || !expectedState || expectedState !== state) {
    res.setHeader("Set-Cookie", clearStateCookie());
    res.writeHead(302, { Location: "/media.html?auth=failed" });
    res.end();
    return;
  }

  try {
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID || "",
        client_secret: process.env.DISCORD_CLIENT_SECRET || "",
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI || ""
      })
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to exchange the Discord OAuth code.");
    }

    const tokenPayload = await tokenResponse.json();
    const accessToken = tokenPayload.access_token;

    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!userResponse.ok) {
      throw new Error("Failed to fetch the Discord user profile.");
    }

    const user = await userResponse.json();

    let memberRoles = [];
    let inGuild = false;

    if (guildId) {
      const memberResponse = await fetch(
        `https://discord.com/api/users/@me/guilds/${guildId}/member`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      if (memberResponse.ok) {
        const member = await memberResponse.json();
        memberRoles = Array.isArray(member.roles) ? member.roles : [];
        inGuild = true;
      }
    }

    const isOwner = Boolean(ownerId) && user.id === ownerId;
    const hasAllowedRole = allowedRoles.some((roleId) => memberRoles.includes(roleId));
    const authorized = isOwner || hasAllowedRole;

    const sessionCookie = createSessionCookie({
      discordId: user.id,
      username: user.username,
      displayName: user.global_name || user.username,
      authorized,
      inGuild,
      isOwner,
      roles: memberRoles
    });

    res.setHeader("Set-Cookie", [sessionCookie, clearStateCookie()]);
    res.writeHead(302, {
      Location: `/media.html?auth=${authorized ? "success" : "denied"}`
    });
    res.end();
  } catch {
    res.setHeader("Set-Cookie", clearStateCookie());
    res.writeHead(302, { Location: "/media.html?auth=failed" });
    res.end();
  }
};
