const fs = require("fs");
const path = require("path");

function getRepoSettings() {
  return {
    repository: process.env.GITHUB_REPOSITORY || "",
    branch: process.env.GITHUB_BRANCH || "main",
    token: process.env.GITHUB_TOKEN || ""
  };
}

function hasGithubWriteConfig() {
  const { repository, token } = getRepoSettings();
  return Boolean(repository && token);
}

function getLocalPath(relativePath) {
  return path.resolve(process.cwd(), relativePath);
}

function readLocalJson(relativePath) {
  const raw = fs.readFileSync(getLocalPath(relativePath), "utf8");
  return JSON.parse(raw);
}

function writeLocalJson(relativePath, data) {
  fs.writeFileSync(getLocalPath(relativePath), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function fetchGithubFile(relativePath) {
  const { repository, branch, token } = getRepoSettings();

  if (!repository) {
    return null;
  }

  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "tallahassee-city-roleplay-site"
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(
    `https://api.github.com/repos/${repository}/contents/${relativePath}?ref=${encodeURIComponent(branch)}`,
    { headers }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`GitHub read failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const decoded = Buffer.from(payload.content, "base64").toString("utf8");

  return {
    sha: payload.sha,
    data: JSON.parse(decoded)
  };
}

async function writeGithubJson(relativePath, data, message) {
  const { repository, branch, token } = getRepoSettings();

  if (!repository || !token) {
    throw new Error("GitHub repository settings are not configured for write access.");
  }

  const existing = await fetchGithubFile(relativePath);
  const content = Buffer.from(`${JSON.stringify(data, null, 2)}\n`, "utf8").toString("base64");

  const response = await fetch(`https://api.github.com/repos/${repository}/contents/${relativePath}`, {
    method: "PUT",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "tallahassee-city-roleplay-site"
    },
    body: JSON.stringify({
      message,
      content,
      branch,
      sha: existing ? existing.sha : undefined
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub write failed with status ${response.status}: ${body}`);
  }
}

async function getJsonFile(relativePath) {
  const remote = await fetchGithubFile(relativePath);
  if (remote) {
    return remote.data;
  }

  return readLocalJson(relativePath);
}

async function putJsonFile(relativePath, data, message) {
  const { repository, token } = getRepoSettings();

  if (repository && token) {
    await writeGithubJson(relativePath, data, message);
    return;
  }

  writeLocalJson(relativePath, data);
}

module.exports = {
  getJsonFile,
  hasGithubWriteConfig,
  putJsonFile
};
