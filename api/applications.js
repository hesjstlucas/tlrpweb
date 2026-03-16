const crypto = require("crypto");
const { readSession } = require("./_lib/auth");
const { sendApplicationStatusDm } = require("./_lib/discord");
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

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function normalizeStatus(value) {
  return String(value || "pending").trim().toLowerCase();
}

function getCreatedTime(item) {
  return new Date(item.submittedAt || item.createdAt || item.reviewedAt || 0).getTime();
}

function sortItems(items = []) {
  return [...items].sort((left, right) => {
    const leftStatus = normalizeStatus(left.status);
    const rightStatus = normalizeStatus(right.status);

    if (leftStatus === "pending" && rightStatus !== "pending") {
      return -1;
    }

    if (leftStatus !== "pending" && rightStatus === "pending") {
      return 1;
    }

    return getCreatedTime(right) - getCreatedTime(left);
  });
}

function getSubmissionValues(rawAnswers = []) {
  const values = new Map();

  if (!Array.isArray(rawAnswers)) {
    return values;
  }

  rawAnswers.forEach((answer) => {
    const questionId = String(answer?.questionId || "").trim();
    if (!questionId) {
      return;
    }

    values.set(questionId, String(answer?.value || "").trim());
  });

  return values;
}

module.exports = async function handler(req, res) {
  const session = readSession(req);
  const permissions = session?.permissions || {};

  if (req.method === "GET") {
    if (!permissions.applicationManage) {
      sendJson(res, 403, { error: "You are not allowed to view application submissions." });
      return;
    }

    try {
      const data = await getJsonFile("data/applications.json");
      sendJson(res, 200, {
        items: sortItems(Array.isArray(data.items) ? data.items : [])
      });
    } catch (error) {
      sendJson(res, 500, { error: error.message || "Applications could not be loaded." });
    }

    return;
  }

  if (process.env.VERCEL && !hasGithubWriteConfig()) {
    sendJson(res, 503, {
      error: "Application writes on Vercel require GITHUB_REPOSITORY and GITHUB_TOKEN environment variables."
    });
    return;
  }

  if (req.method === "POST") {
    if (!session) {
      sendJson(res, 401, { error: "You must sign in with Discord before you can apply." });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const formId = String(body.formId || "").trim();
      const formsData = await getJsonFile("data/application-forms.json");
      const forms = Array.isArray(formsData.items) ? formsData.items : [];
      const form = forms.find((entry) => entry.id === formId);

      if (!form) {
        sendJson(res, 404, { error: "This application form could not be found." });
        return;
      }

      const answersByQuestion = getSubmissionValues(body.answers);
      const answers = (Array.isArray(form.questions) ? form.questions : []).map((question) => {
        const value = answersByQuestion.get(question.id) || "";
        const limit = question.type === "long" ? 1500 : 300;

        if (question.required && !value) {
          throw new Error(`The question "${question.label}" is required.`);
        }

        if (value.length > limit) {
          throw new Error(`The answer for "${question.label}" must stay under ${limit} characters.`);
        }

        return {
          questionId: question.id,
          label: question.label,
          type: question.type,
          value
        };
      });

      const current = await getJsonFile("data/applications.json");
      const timestamp = new Date().toISOString();
      const nextItem = {
        id: crypto.randomUUID(),
        formId: form.id,
        formTitle: form.title,
        department: form.department,
        applicantDiscordId: session.discordId,
        applicantUsername: session.username,
        applicantName: session.displayName || session.username || "Applicant",
        status: "pending",
        createdAt: timestamp,
        submittedAt: timestamp,
        createdBy: session.displayName || session.username || "Applicant",
        answers,
        reviewedAt: null,
        reviewedBy: "",
        decisionNote: ""
      };

      const nextData = {
        items: sortItems([nextItem, ...(Array.isArray(current.items) ? current.items : [])])
      };

      await putJsonFile(
        "data/applications.json",
        nextData,
        `Submit application: ${form.title} by ${nextItem.applicantName}`
      );

      sendJson(res, 201, { item: nextItem });
    } catch (error) {
      sendJson(res, 400, { error: error.message || "Your application could not be submitted." });
    }

    return;
  }

  if (req.method === "PATCH") {
    if (!permissions.applicationManage) {
      sendJson(res, 403, { error: "You are not allowed to review application submissions." });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const id = String(body.id || "").trim();
      const status = normalizeStatus(body.status);
      const decisionNote = String(body.decisionNote || "").trim();

      if (!id) {
        sendJson(res, 400, { error: "Application ID is required." });
        return;
      }

      if (!["accepted", "denied", "pending"].includes(status)) {
        sendJson(res, 400, { error: "Status must be accepted, denied, or pending." });
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
        sendJson(res, 404, { error: "Application submission not found." });
        return;
      }

      const updatedItem = {
        ...items[index],
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
        `Review application submission: ${updatedItem.applicantName || updatedItem.formTitle || updatedItem.id} -> ${status}`
      );

      const dmResult = await sendApplicationStatusDm(updatedItem);
      sendJson(res, 200, {
        item: updatedItem,
        warning: dmResult.warning || ""
      });
    } catch (error) {
      sendJson(res, 500, { error: error.message || "Application status could not be updated." });
    }

    return;
  }

  res.setHeader("Allow", "GET, POST, PATCH");
  sendJson(res, 405, { error: "Method not allowed." });
};
