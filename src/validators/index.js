const { body, param, query, validationResult } = require('express-validator');

// ── Middleware ─────────────────────────────────────────────────────────────────
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status:  'error',
      message: 'Validation failed',
      errors:  errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// ── Auth ───────────────────────────────────────────────────────────────────────
const registerRules = [
  body('email')
    .trim().notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  body('name')
    .optional().trim()
    .isLength({ min: 1, max: 100 }).withMessage('Name must be 1–100 characters'),
];

const loginRules = [
  body('email')
    .trim().notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email address')
    .normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

// ── Task ───────────────────────────────────────────────────────────────────────
const createTaskRules = [
  body('title')
    .trim().notEmpty().withMessage('Title is required')
    .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
  body('description')
    .optional().trim()
    .isLength({ max: 2000 }).withMessage('Description cannot exceed 2000 characters'),
  body('dueDate')
    .optional({ nullable: true })
    .isISO8601().withMessage('Due date must be a valid ISO 8601 date')
    .toDate(),
  body('status')
    .optional()
    .isIn(['pending', 'completed']).withMessage('Status must be pending or completed'),
  body('categoryId')
    .optional({ nullable: true })
    .isUUID().withMessage('categoryId must be a valid UUID'),
  body('tags')
    .optional()
    .isArray({ max: 20 }).withMessage('Tags must be an array with at most 20 items')
    .custom((arr) => arr.every((t) => typeof t === 'string' && t.trim().length > 0 && t.length <= 50))
    .withMessage('Each tag must be a non-empty string of at most 50 characters'),
];

const updateTaskRules = [
  body('title')
    .optional().trim().notEmpty().withMessage('Title cannot be empty')
    .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
  body('description')
    .optional().trim()
    .isLength({ max: 2000 }).withMessage('Description cannot exceed 2000 characters'),
  body('dueDate')
    .optional({ nullable: true })
    .isISO8601().withMessage('Due date must be a valid ISO 8601 date')
    .toDate(),
  body('status')
    .optional()
    .isIn(['pending', 'completed']).withMessage('Status must be pending or completed'),
  body('categoryId')
    .optional({ nullable: true })
    .custom((v) => v === null || /^[0-9a-f-]{36}$/i.test(v))
    .withMessage('categoryId must be a valid UUID or null'),
  body('tags')
    .optional()
    .isArray({ max: 20 }).withMessage('Tags must be an array with at most 20 items')
    .custom((arr) => arr.every((t) => typeof t === 'string' && t.trim().length > 0 && t.length <= 50))
    .withMessage('Each tag must be a non-empty string of at most 50 characters'),
];

// ── Category ───────────────────────────────────────────────────────────────────
const createCategoryRules = [
  body('name')
    .trim().notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),
  body('color')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Color must be a valid hex color (e.g. #4F46E5)'),
  body('icon')
    .optional().trim()
    .isLength({ max: 10 }).withMessage('Icon cannot exceed 10 characters'),
];

const updateCategoryRules = [
  body('name')
    .optional().trim().notEmpty().withMessage('Name cannot be empty')
    .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),
  body('color')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Color must be a valid hex color'),
  body('icon')
    .optional().trim()
    .isLength({ max: 10 }).withMessage('Icon cannot exceed 10 characters'),
];

// ── Param validators ───────────────────────────────────────────────────────────
const mongoIdRule = [
  param('id')
    .matches(/^[a-f\d]{24}$/i).withMessage('Invalid task ID format'),
];

const uuidParamRule = [
  param('id')
    .isUUID().withMessage('Invalid category ID format'),
];

module.exports = {
  validate,
  registerRules,
  loginRules,
  createTaskRules,
  updateTaskRules,
  createCategoryRules,
  updateCategoryRules,
  mongoIdRule,
  uuidParamRule,
};