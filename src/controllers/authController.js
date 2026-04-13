const bcrypt    = require('bcryptjs');
const User      = require('../models/User');
const { signToken } = require('../utils/jwt');
const { AppError }  = require('../middleware/errorHandler');

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    const existing = await User.findOne({ where: { email } });
    if (existing) return next(new AppError('A user with this email already exists', 409));

    const rounds  = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashed  = await bcrypt.hash(password, rounds);
    const user    = await User.create({ email, password: hashed, name });
    const token   = signToken(user.id);

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: {
        token,
        user: { id: user.id, email: user.email, name: user.name, createdAt: user.created_at },
      },
    });
  } catch (err) { next(err); }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return next(new AppError('Invalid email or password', 401));

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return next(new AppError('Invalid email or password', 401));

    const token = signToken(user.id);

    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: {
        token,
        user: { id: user.id, email: user.email, name: user.name, createdAt: user.created_at },
      },
    });
  } catch (err) { next(err); }
};

// GET /api/auth/me
const getProfile = (req, res) => {
  res.status(200).json({
    status: 'success',
    data: {
      user: {
        id: req.user.id, email: req.user.email,
        name: req.user.name, createdAt: req.user.created_at,
      },
    },
  });
};

module.exports = { register, login, getProfile };