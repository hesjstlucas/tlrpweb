const crypto = require("crypto");
const { readSession } = require("./_lib/auth");
const { getJsonFile, hasGithubWriteConfig, putJsonFile } = require("./_lib/github");

function sendJson(res, statusCode, payload) {
  res.setHeader("Content-Type", "application/json");
  res.statusCode = statusCode;
  res.end(JSON.stringify(payload));
}

function validateUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const data = await getJsonFile("data/media.json");
      sendJson(res, 200, data);
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }

    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  const session = readSession(req);

  if (!session || !session.authorized) {
    sendJson(res, 403, { error: "You are not allowed to publish media." });
    return;
  }

  if (process.env.VERCEL && !hasGithubWriteConfig()) {
    sendJson(res, 503, {
      error: "Media publishing on Vercel requires GITHUB_REPOSITORY and GITHUB_TOKEN environment variables."
    });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const title = String(body.title || "").trim();
    const url = String(body.url || "").trim();
    const type = String(body.type || "").trim().toLowerCase();
    const description = String(body.description || "").trim();

    if (!title || title.length > 90) {
      sendJson(res, 400, { error: "Title is required and must stay under 90 characters." });
      return;
    }

    if (!validateUrl(url)) {
      sendJson(res, 400, { error: "A valid image or video URL is required." });
      return;
    }

    if (!["image", "video"].includes(type)) {
      sendJson(res, 400, { error: "Media type must be image or video." });
      return;
    }

    if (description.length > 240) {
      sendJson(res, 400, { error: "Description must stay under 240 characters." });
      return;
    }

    const current = await getJsonFile("data/media.json");
    const nextItem = {
      id: crypto.randomUUID(),
      title,
      url,
      type,
      description,
      createdAt: new Date().toISOString(),
      addedBy: session.displayName || session.username || "Authorized User"
    };

    const nextData = {
      items: [nextItem, ...(Array.isArray(current.items) ? current.items : [])]
    };

    await putJsonFile("data/media.json", nextData, `Add media entry: ${title}`);
    sendJson(res, 201, { item: nextItem });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Failed to publish media." });
  }
};
