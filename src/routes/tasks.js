const express = require('express');
const router  = express.Router();
const {
  createTask, getAllTasks, getTask,
  updateTask, deleteTask, getUserTags,
} = require('../controllers/taskController');
const { authenticate } = require('../middleware/auth');
const {
  createTaskRules, updateTaskRules,
  mongoIdRule, validate,
} = require('../validators');

router.use(authenticate);

router.get('/tags',    getUserTags);                               // GET  /api/tasks/tags
router.post('/',       createTaskRules, validate, createTask);    // POST /api/tasks
router.get('/',        getAllTasks);                               // GET  /api/tasks
router.get('/:id',     mongoIdRule, validate, getTask);           // GET  /api/tasks/:id
router.patch('/:id',   mongoIdRule, updateTaskRules, validate, updateTask);
router.delete('/:id',  mongoIdRule, validate, deleteTask);

module.exports = router;