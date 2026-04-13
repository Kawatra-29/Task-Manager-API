const Task               = require('../models/Task');
const Category           = require('../models/Category');
const { AppError }       = require('../middleware/errorHandler');
const reminderScheduler  = require('../services/reminderScheduler');
const webhookService     = require('../services/webhookService');
const logger             = require('../utils/logger');

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Normalise tags: trim, lowercase, deduplicate */
const normaliseTags = (tags) =>
  [...new Set((tags || []).map((t) => t.trim().toLowerCase()).filter(Boolean))];

/** Resolve category info for a userId + categoryId pair */
const resolveCategory = async (categoryId, userId) => {
  if (!categoryId) return { categoryId: null, categoryName: null };
  const cat = await Category.findOne({ where: { id: categoryId, userId } });
  if (!cat) throw new AppError('Category not found or does not belong to you', 404);
  return { categoryId: cat.id, categoryName: cat.name };
};

// ── POST /api/tasks ────────────────────────────────────────────────────────────
const createTask = async (req, res, next) => {
  try {
    const { title, description, dueDate, status, categoryId, tags } = req.body;

    const { categoryId: catId, categoryName } = await resolveCategory(
      categoryId || null, req.user.id
    );

    const task = await Task.create({
      title,
      description:  description || '',
      dueDate:      dueDate     || null,
      status:       status      || 'pending',
      userId:       req.user.id,
      categoryId:   catId,
      categoryName,
      tags:         normaliseTags(tags),
    });

    // Schedule reminder if dueDate provided
    if (task.dueDate) {
      await reminderScheduler.scheduleReminder(task).catch((err) =>
        logger.error('Failed to schedule reminder on create', { error: err.message })
      );
    }

    res.status(201).json({
      status:  'success',
      message: 'Task created successfully',
      data:    { task },
    });
  } catch (err) { next(err); }
};

// ── GET /api/tasks ─────────────────────────────────────────────────────────────
const getAllTasks = async (req, res, next) => {
  try {
    const {
      status, categoryId, tags,
      page  = 1,
      limit = 20,
    } = req.query;

    const filter = { userId: req.user.id };

    if (status && ['pending', 'completed'].includes(status)) {
      filter.status = status;
    }
    if (categoryId) {
      filter.categoryId = categoryId;
    }
    if (tags) {
      // ?tags=bugfix,urgent  — match tasks that have ALL specified tags
      const tagList = tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
      if (tagList.length) filter.tags = { $all: tagList };
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
          page:       parseInt(page),
          limit:      parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (err) { next(err); }
};

// ── GET /api/tasks/:id ─────────────────────────────────────────────────────────
const getTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return next(new AppError('Task not found', 404));
    if (task.userId !== req.user.id)
      return next(new AppError('You do not have permission to access this task', 403));

    res.status(200).json({ status: 'success', data: { task } });
  } catch (err) { next(err); }
};

// ── PATCH /api/tasks/:id ───────────────────────────────────────────────────────
const updateTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return next(new AppError('Task not found', 404));
    if (task.userId !== req.user.id)
      return next(new AppError('You do not have permission to modify this task', 403));

    const wasCompleted = task.status === 'completed';

    // ── Apply fields ───────────────────────────────────────────────────────────
    const { title, description, dueDate, status, categoryId, tags } = req.body;

    if (title       !== undefined) task.title       = title;
    if (description !== undefined) task.description = description;

    // Handle dueDate change
    const dueDateChanged = dueDate !== undefined && String(dueDate) !== String(task.dueDate);
    if (dueDate !== undefined) task.dueDate = dueDate;

    // Handle category
    if (categoryId !== undefined) {
      const { categoryId: catId, categoryName } = await resolveCategory(
        categoryId, req.user.id
      );
      task.categoryId   = catId;
      task.categoryName = categoryName;
    }

    // Handle tags
    if (tags !== undefined) task.tags = normaliseTags(tags);

    // Handle status transition
    const becomingCompleted = status === 'completed' && !wasCompleted;
    if (status !== undefined) {
      task.status = status;
      if (becomingCompleted) task.completedAt = new Date();
      if (status === 'pending') task.completedAt = null;
    }

    await task.save();

    // ── Side effects ───────────────────────────────────────────────────────────

    // Reminder: reschedule or cancel
    if (becomingCompleted || status === 'pending') {
      if (becomingCompleted) {
        await reminderScheduler.cancelReminder(task._id.toString()).catch(() => {});
      }
    } else if (dueDateChanged) {
      if (task.dueDate) {
        task.reminderSentAt = null; // reset so new reminder can fire
        await task.save();
        await reminderScheduler.scheduleReminder(task).catch((err) =>
          logger.error('Failed to reschedule reminder on update', { error: err.message })
        );
      } else {
        await reminderScheduler.cancelReminder(task._id.toString()).catch(() => {});
      }
    }

    // Webhook: fire if task just became completed
    if (becomingCompleted) {
      webhookService.scheduleTaskCompleted(task, req.user.id).catch((err) =>
        logger.error('Webhook scheduling failed', { error: err.message })
      );
    }

    res.status(200).json({
      status:  'success',
      message: 'Task updated successfully',
      data:    { task },
    });
  } catch (err) { next(err); }
};

// ── DELETE /api/tasks/:id ──────────────────────────────────────────────────────
const deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return next(new AppError('Task not found', 404));
    if (task.userId !== req.user.id)
      return next(new AppError('You do not have permission to delete this task', 403));

    // Cancel any pending reminder
    await reminderScheduler.cancelReminder(task._id.toString()).catch(() => {});

    await task.deleteOne();

    res.status(200).json({ status: 'success', message: 'Task deleted successfully' });
  } catch (err) { next(err); }
};

// ── GET /api/tasks/tags ────────────────────────────────────────────────────────
/** Returns all unique tags used by the authenticated user */
const getUserTags = async (req, res, next) => {
  try {
    const tags = await Task.distinct('tags', { userId: req.user.id });
    res.status(200).json({
      status: 'success',
      data:   { tags: tags.filter(Boolean).sort() },
    });
  } catch (err) { next(err); }
};

module.exports = { createTask, getAllTasks, getTask, updateTask, deleteTask, getUserTags };