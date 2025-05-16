const { PORTS } = require("../whitelistports");

const allowedOrigins = Object.values(PORTS).map(port => `https://localhost:${port}`);
allowedOrigins.push("https://localhost");
// scheme + domain + port

module.exports = { allowedOrigins };