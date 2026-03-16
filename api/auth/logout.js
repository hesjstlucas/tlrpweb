const { clearSessionCookie } = require("../_lib/auth");

module.exports = async function handler(req, res) {
  res.setHeader("Set-Cookie", clearSessionCookie());
  res.writeHead(302, { Location: "/media.html?auth=logged-out" });
  res.end();
};
