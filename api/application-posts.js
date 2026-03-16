const crypto = require("crypto");
const { readSession } = require("./_lib/auth");
const { getJsonFile, hasGithubWriteConfig, putJsonFile } = require("./_lib/github");

function sendJson(res, statusCode, payload) {
  res.setHeader("Content-Type", "application/json");
  res.statusCode = statusCode;
  res.end(JSON.stringify(payload));
}

function validateUrl(value) {
  if (!value) {
    return true;
  }

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

function sortItems(items = []) {
  return [...items].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const data = await getJsonFile("data/application-portals.json");
      const items = sortItems(Array.isArray(data.items) ? data.items : []);
      const id = String(req.query.id || "").trim();

      if (id) {
        const item = items.find((entry) => entry.id === id);
        if (!item) {
          sendJson(res, 404, { error: "Application page not found." });
          return;
        }

        sendJson(res, 200, { item });
        return;
      }

      sendJson(res, 200, { items });
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
  const permissions = session?.permissions || {};

  if (!permissions.applicationCreate) {
    sendJson(res, 403, { error: "You are not allowed to publish public application pages." });
    return;
  }

  if (process.env.VERCEL && !hasGithubWriteConfig()) {
    sendJson(res, 503, {
      error: "Application page writes on Vercel require GITHUB_REPOSITORY and GITHUB_TOKEN environment variables."
    });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const title = String(body.title || "").trim();
    const department = String(body.department || "").trim();
    const overview = String(body.overview || "").trim();
    const details = String(body.details || "").trim();
    const applyLink = String(body.applyLink || "").trim();

    if (!title || title.length > 90) {
      sendJson(res, 400, { error: "Application title is required and must stay under 90 characters." });
      return;
    }

    if (!department || department.length > 60) {
      sendJson(res, 400, { error: "Department is required and must stay under 60 characters." });
      return;
    }

    if (!overview || overview.length > 240) {
      sendJson(res, 400, { error: "Overview is required and must stay under 240 characters." });
      return;
    }

    if (!details || details.length > 2500) {
      sendJson(res, 400, { error: "Details are required and must stay under 2500 characters." });
      return;
    }

    if (!validateUrl(applyLink)) {
      sendJson(res, 400, { error: "Apply link must be a valid http or https URL." });
      return;
    }

    const current = await getJsonFile("data/application-portals.json");
    const nextItem = {
      id: crypto.randomUUID(),
      title,
      department,
      overview,
      details,
      applyLink,
      createdAt: new Date().toISOString(),
      createdBy: session.displayName || session.username || "Directive"
    };

    const nextData = {
      items: sortItems([nextItem, ...(Array.isArray(current.items) ? current.items : [])])
    };

    await putJsonFile("data/application-portals.json", nextData, `Publish application page: ${title}`);
    sendJson(res, 201, { item: nextItem });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Failed to publish the application page." });
  }
};
