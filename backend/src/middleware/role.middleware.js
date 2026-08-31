function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `Requires one of roles: ${allowedRoles.join(", ")}` });
    }
    next();
  };
}

module.exports = requireRole;
