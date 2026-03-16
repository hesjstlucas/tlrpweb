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
  return [...items].sort((left, right) => {
    if (left.status === "pending" && right.status !== "pending") {
      return -1;
    }

    if (left.status !== "pending" && right.status === "pending") {
      return 1;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const data = await getJsonFile("data/applications.json");
      sendJson(res, 200, {
        items: sortItems(Array.isArray(data.items) ? data.items : [])
      });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }

    return;
  }

  const session = readSession(req);
  const permissions = session?.permissions || {};

  if (req.method === "POST") {
    if (!permissions.applicationCreate) {
      sendJson(res, 403, { error: "You are not allowed to create application records." });
      return;
    }

    if (process.env.VERCEL && !hasGithubWriteConfig()) {
      sendJson(res, 503, {
        error: "Application writes on Vercel require GITHUB_REPOSITORY and GITHUB_TOKEN environment variables."
      });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const applicantName = String(body.applicantName || "").trim();
      const applicantDiscord = String(body.applicantDiscord || "").trim();
      const department = String(body.department || "").trim();
      const position = String(body.position || "").trim();
      const referenceLink = String(body.referenceLink || "").trim();
      const summary = String(body.summary || "").trim();

      if (!applicantName || applicantName.length > 80) {
        sendJson(res, 400, { error: "Applicant name is required and must stay under 80 characters." });
        return;
      }

      if (!applicantDiscord || applicantDiscord.length > 80) {
        sendJson(res, 400, { error: "Discord username or ID is required and must stay under 80 characters." });
        return;
      }

      if (!department || department.length > 60) {
        sendJson(res, 400, { error: "Department is required and must stay under 60 characters." });
        return;
      }

      if (!position || position.length > 70) {
        sendJson(res, 400, { error: "Position is required and must stay under 70 characters." });
        return;
      }

      if (!summary || summary.length > 600) {
        sendJson(res, 400, { error: "Summary is required and must stay under 600 characters." });
        return;
      }

      if (!validateUrl(referenceLink)) {
        sendJson(res, 400, { error: "Reference link must be a valid http or https URL." });
        return;
      }

      const current = await getJsonFile("data/applications.json");
      const nextItem = {
        id: crypto.randomUUID(),
        applicantName,
        applicantDiscord,
        department,
        position,
        referenceLink,
        summary,
        status: "pending",
        createdAt: new Date().toISOString(),
        createdBy: session.displayName || session.username || "Authorized User",
        reviewedAt: null,
        reviewedBy: "",
        decisionNote: ""
      };

      const nextData = {
        items: sortItems([nextItem, ...(Array.isArray(current.items) ? current.items : [])])
      };

      await putJsonFile("data/applications.json", nextData, `Create application record: ${applicantName}`);
      sendJson(res, 201, { item: nextItem });
    } catch (error) {
      sendJson(res, 500, { error: error.message || "Failed to create the application record." });
    }

    return;
  }

  if (req.method === "PATCH") {
    if (!permissions.applicationManage) {
      sendJson(res, 403, { error: "You are not allowed to review application records." });
      return;
    }

    if (process.env.VERCEL && !hasGithubWriteConfig()) {
      sendJson(res, 503, {
        error: "Application writes on Vercel require GITHUB_REPOSITORY and GITHUB_TOKEN environment variables."
      });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const id = String(body.id || "").trim();
      const status = String(body.status || "").trim().toLowerCase();
      const decisionNote = String(body.decisionNote || "").trim();

      if (!id) {
        sendJson(res, 400, { error: "Application ID is required." });
        return;
      }

      if (!["accepted", "denied"].includes(status)) {
        sendJson(res, 400, { error: "Status must be accepted or denied." });
        return;
      }

      if (decisionNote.length > 300) {
        sendJson(res, 400, { error: "Decision note must stay under 300 characters." });
        return;
      }

      const current = await getJsonFile("data/applications.json");
      const items = Array.isArray(current.items) ? current.items : [];
      const index = items.findIndex((item) => item.id === id);

      if (index === -1) {
        sendJson(res, 404, { error: "Application record not found." });
        return;
      }

      const currentItem = items[index];
      const updatedItem = {
        ...currentItem,
        status,
        decisionNote,
        reviewedAt: new Date().toISOString(),
        reviewedBy: session.displayName || session.username || "Management"
      };

      const nextItems = [...items];
      nextItems[index] = updatedItem;

      await putJsonFile(
        "data/applications.json",
        { items: sortItems(nextItems) },
        `Review application record: ${currentItem.applicantName} -> ${status}`
      );

      sendJson(res, 200, { item: updatedItem });
    } catch (error) {
      sendJson(res, 500, { error: error.message || "Failed to review the application record." });
    }

    return;
  }

  res.setHeader("Allow", "GET, POST, PATCH");
  sendJson(res, 405, { error: "Method not allowed." });
};
