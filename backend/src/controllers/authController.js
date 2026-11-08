const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { getDatabase } = require('../db/database');

async function register(req, res) {
  try {
    const { name, email, password } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required.' });
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required.' });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const db = getDatabase();

    const existingUser = db.prepare('SELECT user_id FROM users WHERE email = ?').get(normalizedEmail);
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (user_id, name, email, password_hash, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, name.trim(), normalizedEmail, passwordHash, createdAt);

    const user = {
      user_id: userId,
      name: name.trim(),
      email: normalizedEmail,
      created_at: createdAt
    };

    const token = jwt.sign(
      { user_id: userId, email: normalizedEmail, name: user.name },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    return res.status(201).json({ user, token });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Internal server error during registration.' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const db = getDatabase();

    const userRecord = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
    if (!userRecord) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, userRecord.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = {
      user_id: userRecord.user_id,
      name: userRecord.name,
      email: userRecord.email,
      created_at: userRecord.created_at
    };

    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, name: user.name },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    return res.status(200).json({ user, token });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
}

module.exports = {
  register,
  login
};

