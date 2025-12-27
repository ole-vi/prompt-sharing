const admin = require("firebase-admin");
const { runJules, runJulesHttp, validateJulesKey, getJulesKeyInfo } = require("./controllers/julesController");
const { githubOAuthExchange, getGitHubUser } = require("./controllers/authController");

admin.initializeApp();

exports.runJules = runJules;
exports.runJulesHttp = runJulesHttp;
exports.validateJulesKey = validateJulesKey;
exports.getJulesKeyInfo = getJulesKeyInfo;
exports.githubOAuthExchange = githubOAuthExchange;
exports.getGitHubUser = getGitHubUser;
