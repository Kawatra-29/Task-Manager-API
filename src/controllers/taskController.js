const Task = require('../models/Task');
const { AppError } = require('../middleware/errorHandler');

// POST /api/tasks
const createTask = async (req, res, next) => {
  try {
    const { title, description, dueDate, status } = req.body;

    const task = await Task.create({
      title,
      description: description || '',
      dueDate: dueDate || null,
      status: status || 'pending',
      userId: req.user.id,
    });

    res.status(201).json({
      status: 'success',
      message: 'Task created successfully',
      data: { task },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/tasks
const getAllTasks = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const filter = { userId: req.user.id };
    if (status && ['pending', 'completed'].includes(status)) {
      filter.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [tasks, total] = await Promise.all([
      Task.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Task.countDocuments(filter),
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        tasks,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/tasks/:id
const getTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return next(new AppError('Task not found', 404));
    }

    // Ownership check — 403 if task belongs to another user
    if (task.userId !== req.user.id) {
      return next(new AppError('You do not have permission to access this task', 403));
    }

    res.status(200).json({
      status: 'success',
      data: { task },
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/tasks/:id
const updateTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return next(new AppError('Task not found', 404));
    }

    if (task.userId !== req.user.id) {
      return next(new AppError('You do not have permission to modify this task', 403));
    }

    // Apply only provided fields (partial update)
    const allowedFields = ['title', 'description', 'dueDate', 'status'];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        task[field] = req.body[field];
      }
    });

    await task.save();

    res.status(200).json({
      status: 'success',
      message: 'Task updated successfully',
      data: { task },
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/tasks/:id
const deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return next(new AppError('Task not found', 404));
    }

    if (task.userId !== req.user.id) {
      return next(new AppError('You do not have permission to delete this task', 403));
    }

    await task.deleteOne();

    res.status(200).json({
      status: 'success',
      message: 'Task deleted successfully',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { createTask, getAllTasks, getTask, updateTask, deleteTask };
