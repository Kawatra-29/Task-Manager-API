const express = require('express');
const router = express.Router();
const {
  createTask,
  getAllTasks,
  getTask,
  updateTask,
  deleteTask,
} = require('../controllers/taskController');
const { authenticate } = require('../middleware/auth');
const {
  createTaskRules,
  updateTaskRules,
  mongoIdRule,
  validate,
} = require('../validators');

// All task routes require authentication
router.use(authenticate);

router.post('/', createTaskRules, validate, createTask);
router.get('/', getAllTasks);
router.get('/:id', mongoIdRule, validate, getTask);
router.patch('/:id', mongoIdRule, updateTaskRules, validate, updateTask);
router.delete('/:id', mongoIdRule, validate, deleteTask);

module.exports = router;
