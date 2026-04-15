const ROLE_RANK = { agent: 1, lead: 2, csm: 3, manager: 4 };

function requireRole(minRole) {
  return (req, res, next) => {
    const userRank = ROLE_RANK[req.user?.role] || 0;
    const minRank = ROLE_RANK[minRole] || 0;
    if (userRank < minRank) {
      return res.status(403).json({ error: `Requires ${minRole} role or above` });
    }
    next();
  };
}

module.exports = { requireRole };
