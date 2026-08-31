function info(...args) { console.log("[INFO]", ...args); }
function error(...args) { console.error("[ERROR]", ...args); }

module.exports = { info, error };
