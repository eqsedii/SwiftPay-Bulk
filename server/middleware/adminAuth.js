const jwt = require('jsonwebtoken');

const { JWT_SECRET } = process.env;

function requireAdmin(req, res, next) {
  const token = req.cookies?.admin_session;
  if (!token) return res.status(401).json({ error: 'Not logged in' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload?.admin) throw new Error('Not an admin token');
    req.admin = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired, please log in again' });
  }
}

module.exports = { requireAdmin };
