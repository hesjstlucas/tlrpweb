const crypto = require("crypto");

const SESSION_COOKIE = "tcrp_session";
const STATE_COOKIE = "tcrp_discord_state";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const STATE_TTL_SECONDS = 60 * 10;

function parseCookies(header = "") {
  return header
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((accumulator, entry) => {
      const separatorIndex = entry.indexOf("=");
      if (separatorIndex === -1) {
        return accumulator;
      }

      const key = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1).trim();
      accumulator[key] = decodeURIComponent(value);
      return accumulator;
    }, {});
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  if (options.httpOnly) {
    parts.push("HttpOnly");
  }

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }

  if (options.secure) {
    parts.push("Secure");
  }

  parts.push(`Path=${options.path || "/"}`);
  return parts.join("; ");
}

function getSessionSecret() {
  return process.env.SESSION_SECRET || "";
}

function hasSessionSecret() {
  return getSessionSecret().length >= 16;
}

function sign(value) {
  if (!hasSessionSecret()) {
    throw new Error("SESSION_SECRET is not configured.");
  }

  return crypto.createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function generateDiscordState() {
  return crypto.randomBytes(24).toString("hex");
}

function createStateCookie(state) {
  return serializeCookie(STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: STATE_TTL_SECONDS,
    sameSite: "Lax",
    secure: true
  });
}

function clearStateCookie() {
  return serializeCookie(STATE_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    sameSite: "Lax",
    secure: true
  });
}

function readState(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies[STATE_COOKIE] || null;
}

function createSessionCookie(session) {
  const payload = {
    ...session,
    exp: Date.now() + SESSION_TTL_MS
  };

  const encoded = encodePayload(payload);
  const signature = sign(encoded);

  return serializeCookie(SESSION_COOKIE, `${encoded}.${signature}`, {
    httpOnly: true,
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    sameSite: "Lax",
    secure: true
  });
}

function clearSessionCookie() {
  return serializeCookie(SESSION_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    sameSite: "Lax",
    secure: true
  });
}

function readSession(req) {
  if (!hasSessionSecret()) {
    return null;
  }

  const cookies = parseCookies(req.headers.cookie || "");
  const raw = cookies[SESSION_COOKIE];

  if (!raw) {
    return null;
  }

  const [encoded, signature] = raw.split(".");

  if (!encoded || !signature || sign(encoded) !== signature) {
    return null;
  }

  try {
    const payload = decodePayload(encoded);
    if (!payload.exp || payload.exp < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

module.exports = {
  SESSION_COOKIE,
  clearSessionCookie,
  clearStateCookie,
  createSessionCookie,
  createStateCookie,
  generateDiscordState,
  hasSessionSecret,
  readSession,
  readState
};
