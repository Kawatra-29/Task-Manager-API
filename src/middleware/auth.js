const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'Access token required. Use Authorization: Bearer <token>',
      });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ status: 'error', message: 'Token expired' });
      }
      return res.status(401).json({ status: 'error', message: 'Invalid token' });
    }

    const user = await User.findByPk(decoded.userId, {
      attributes: ['id', 'email', 'name', 'created_at'],
    });

    if (!user) {
      return res.status(401).json({ status: 'error', message: 'User no longer exists' });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { authenticate };
