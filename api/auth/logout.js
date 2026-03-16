const { buildAuthRedirect, clearSessionCookie, sanitizeNextPath } = require("../_lib/auth");

module.exports = async function handler(req, res) {
  const nextPath = sanitizeNextPath(req.query.next || "/media.html");
  res.setHeader("Set-Cookie", clearSessionCookie());
  res.writeHead(302, { Location: buildAuthRedirect(nextPath, "logged-out") });
  res.end();
};
