const { body, param, validationResult } = require('express-validator');

// Middleware to check validation results
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// User registration rules
const registerRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),

  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters'),
];

// User login rules
const loginRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required'),
];

// Task creation rules
const createTaskRules = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 }).withMessage('Description cannot exceed 2000 characters'),

  body('dueDate')
    .optional({ nullable: true })
    .isISO8601().withMessage('Due date must be a valid ISO 8601 date (e.g. 2025-12-31)')
    .toDate(),

  body('status')
    .optional()
    .isIn(['pending', 'completed']).withMessage('Status must be pending or completed'),
];

// Task update rules (all fields optional)
const updateTaskRules = [
  body('title')
    .optional()
    .trim()
    .notEmpty().withMessage('Title cannot be empty')
    .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 }).withMessage('Description cannot exceed 2000 characters'),

  body('dueDate')
    .optional({ nullable: true })
    .isISO8601().withMessage('Due date must be a valid ISO 8601 date')
    .toDate(),

  body('status')
    .optional()
    .isIn(['pending', 'completed']).withMessage('Status must be pending or completed'),
];

// MongoDB ObjectId validation
const mongoIdRule = [
  param('id')
    .matches(/^[a-f\d]{24}$/i).withMessage('Invalid task ID format'),
];

module.exports = {
  validate,
  registerRules,
  loginRules,
  createTaskRules,
  updateTaskRules,
  mongoIdRule,
};
