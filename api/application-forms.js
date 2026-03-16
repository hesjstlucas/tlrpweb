const crypto = require("crypto");
const { readSession } = require("./_lib/auth");
const { getJsonFile, hasGithubWriteConfig, putJsonFile } = require("./_lib/github");

function sendJson(res, statusCode, payload) {
  res.setHeader("Content-Type", "application/json");
  res.statusCode = statusCode;
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string" && req.body.trim()) {
    return JSON.parse(req.body);
  }

  if (Buffer.isBuffer(req.body) && req.body.length) {
    return JSON.parse(req.body.toString("utf8"));
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

function sortForms(items = []) {
  return [...items].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

function normalizeQuestion(question, index) {
  const label = String(question?.label || "").trim();
  const placeholder = String(question?.placeholder || "").trim();
  const type = String(question?.type || "short").trim().toLowerCase();
  const required = question?.required !== false;
  const id = String(question?.id || "").trim() || crypto.randomUUID();

  if (!label || label.length > 100) {
    throw new Error(`Question ${index + 1} needs a prompt under 100 characters.`);
  }

  if (placeholder.length > 140) {
    throw new Error(`Question ${index + 1} placeholder must stay under 140 characters.`);
  }

  if (!["short", "long"].includes(type)) {
    throw new Error(`Question ${index + 1} must use the short or long answer type.`);
  }

  return {
    id,
    label,
    placeholder,
    type,
    required
  };
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const data = await getJsonFile("data/application-forms.json");
      const items = sortForms(Array.isArray(data.items) ? data.items : []);
      const id = String(req.query.id || "").trim();

      if (id) {
        const item = items.find((entry) => entry.id === id);
        if (!item) {
          sendJson(res, 404, { error: "Application form not found." });
          return;
        }

        sendJson(res, 200, { item });
        return;
      }

      sendJson(res, 200, { items });
    } catch (error) {
      sendJson(res, 500, { error: error.message || "Application forms could not be loaded." });
    }

    return;
  }

  if (!["POST", "DELETE"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, DELETE");
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  const session = readSession(req);
  const permissions = session?.permissions || {};

  if (!permissions.applicationCreate) {
    sendJson(res, 403, { error: "You are not allowed to manage application forms." });
    return;
  }

  if (process.env.VERCEL && !hasGithubWriteConfig()) {
    sendJson(res, 503, {
      error: "Application form writes on Vercel require GITHUB_REPOSITORY and GITHUB_TOKEN environment variables."
    });
    return;
  }

  if (req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const title = String(body.title || "").trim();
      const department = String(body.department || "").trim();
      const overview = String(body.overview || "").trim();
      const intro = String(body.intro || "").trim();
      const rawQuestions = Array.isArray(body.questions) ? body.questions : [];

      if (!title || title.length > 90) {
        sendJson(res, 400, { error: "Application title is required and must stay under 90 characters." });
        return;
      }

      if (!department || department.length > 60) {
        sendJson(res, 400, { error: "Department is required and must stay under 60 characters." });
        return;
      }

      if (!overview || overview.length > 240) {
        sendJson(res, 400, { error: "Button overview is required and must stay under 240 characters." });
        return;
      }

      if (!intro || intro.length > 1800) {
        sendJson(res, 400, { error: "Application intro is required and must stay under 1800 characters." });
        return;
      }

      if (!rawQuestions.length || rawQuestions.length > 12) {
        sendJson(res, 400, { error: "Each form needs between 1 and 12 questions." });
        return;
      }

      const questions = rawQuestions.map((question, index) => normalizeQuestion(question, index));
      const current = await getJsonFile("data/application-forms.json");
      const nextItem = {
        id: crypto.randomUUID(),
        title,
        department,
        overview,
        intro,
        questions,
        createdAt: new Date().toISOString(),
        createdBy: session.displayName || session.username || "Directive"
      };

      const nextData = {
        items: sortForms([nextItem, ...(Array.isArray(current.items) ? current.items : [])])
      };

      await putJsonFile("data/application-forms.json", nextData, `Create application form: ${title}`);
      sendJson(res, 201, { item: nextItem });
    } catch (error) {
      sendJson(res, 500, { error: error.message || "Application form could not be created." });
    }

    return;
  }

  if (req.method === "DELETE") {
    try {
      const queryId = String(req.query?.id || "").trim();
      const body = queryId ? {} : await readJsonBody(req);
      const id = String(queryId || body.id || "").trim();

      if (!id) {
        sendJson(res, 400, { error: "Application form ID is required." });
        return;
      }

      const current = await getJsonFile("data/application-forms.json");
      const items = Array.isArray(current.items) ? current.items : [];
      const form = items.find((entry) => entry.id === id);

      if (!form) {
        sendJson(res, 404, { error: "Application form not found." });
        return;
      }

      const nextItems = items.filter((entry) => entry.id !== id);
      await putJsonFile(
        "data/application-forms.json",
        { items: sortForms(nextItems) },
        `Delete application form: ${form.title}`
      );

      sendJson(res, 200, {
        deleted: true,
        message: "Application form deleted. Existing submitted applications were left in the review queue."
      });
    } catch (error) {
      sendJson(res, 500, { error: error.message || "Application form could not be deleted." });
    }

    return;
  }

  res.setHeader("Allow", "GET, POST, DELETE");
  sendJson(res, 405, { error: "Method not allowed." });
};
