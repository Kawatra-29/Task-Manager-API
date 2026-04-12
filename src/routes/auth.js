const express = require('express');
const router = express.Router();
const { register, login, getProfile } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const {
  registerRules,
  loginRules,
  validate,
} = require('../validators');

router.post('/register', registerRules, validate, register);
router.post('/login', loginRules, validate, login);
router.get('/me', authenticate, getProfile);

module.exports = router;
