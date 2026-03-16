function hasDiscordBotToken() {
  return Boolean(process.env.DISCORD_BOT_TOKEN);
}

async function discordRequest(path, options = {}) {
  if (!hasDiscordBotToken()) {
    throw new Error("DISCORD_BOT_TOKEN is not configured.");
  }

  const response = await fetch(`https://discord.com/api${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "tallahassee-city-roleplay-site",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord API request failed with status ${response.status}: ${body}`);
  }

  return response.json();
}

function buildDecisionMessage(item) {
  const status = String(item.status || "pending").trim().toLowerCase();
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
  const lines = [
    "Tallahassee City Roleplay application update",
    "",
    `Application: ${item.formTitle || item.department || "Server Application"}`,
    `Status: ${statusLabel}`
  ];

  if (item.decisionNote) {
    lines.push(`Staff note: ${item.decisionNote}`);
  }

  lines.push("");
  lines.push("If you have questions, please reach out inside the TLRP Discord.");
  return lines.join("\n").slice(0, 1900);
}

async function sendApplicationStatusDm(item) {
  if (!hasDiscordBotToken()) {
    return {
      sent: false,
      warning: "The application status was saved, but DISCORD_BOT_TOKEN is missing so no DM was sent."
    };
  }

  if (!item.applicantDiscordId) {
    return {
      sent: false,
      warning: "The application status was saved, but this applicant does not have a Discord user ID stored for DMs."
    };
  }

  try {
    const channel = await discordRequest("/users/@me/channels", {
      method: "POST",
      body: JSON.stringify({
        recipient_id: item.applicantDiscordId
      })
    });

    await discordRequest(`/channels/${channel.id}/messages`, {
      method: "POST",
      body: JSON.stringify({
        content: buildDecisionMessage(item)
      })
    });

    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      warning: `The application status was saved, but the Discord DM failed: ${error.message}`
    };
  }
}

module.exports = {
  hasDiscordBotToken,
  sendApplicationStatusDm
};
