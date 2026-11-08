const jwt = require('jsonwebtoken');
const config = require('../config');
const { getDatabase } = require('../db/database');

function authenticateToken(req, res, next) {
  let token = null;
  const authHeader = req.headers['authorization'];

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Access token required.' });
  }

  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    const db = getDatabase();
    const user = db.prepare('SELECT user_id, name, email, created_at FROM users WHERE user_id = ?').get(payload.user_id);

    if (!user) {
      return res.status(401).json({ error: 'User does not exist or has been removed.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

module.exports = {
  authenticateToken
};

