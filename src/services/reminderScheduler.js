/**
 * ReminderScheduler
 *
 * DESIGN: In-Memory Queue with Persistent State
 * ─────────────────────────────────────────────────────────────────────────────
 * We use a two-layer approach:
 *
 *   1. MongoDB as the source of truth — the `reminderScheduledFor` field on
 *      each task records when its reminder should fire, and `reminderSentAt`
 *      records if it was already delivered.
 *
 *   2. An in-memory Map<taskId, TimeoutHandle> tracks the active setTimeout
 *      handles so we can cancel/reschedule when a task is updated.
 *
 *   3. A node-cron job polls MongoDB every minute to pick up any tasks whose
 *      reminder window falls within the next ~2 minutes. This handles server
 *      restarts: on boot, poll immediately and re-arm any missed/upcoming
 *      reminders.
 *
 * REMINDER WINDOW: fires 1 hour before dueDate (configurable via env).
 *
 * CANCELLATION: When a task is:
 *   - Completed   → cancel timer + clear reminderScheduledFor
 *   - DueDate changed → cancel old timer + schedule new one
 *   - Deleted     → cancel timer
 *
 * NOTIFICATION: Simulated by logging to console + optional webhook.site call.
 */

const cron       = require('node-cron');
const axios      = require('axios');
const Task       = require('../models/Task');
const logger     = require('../utils/logger');

// How many minutes before dueDate to fire the reminder (default 60)
const REMINDER_MINUTES_BEFORE = parseInt(process.env.REMINDER_MINUTES_BEFORE || '60');

class ReminderScheduler {
  constructor() {
    /** @type {Map<string, NodeJS.Timeout>} taskId → setTimeout handle */
    this._timers = new Map();
    this._cronJob = null;
  }

  /** ── Public API ─────────────────────────────────────────────────────────── */

  /**
   * Called when a task is created or updated.
   * Computes the reminder time and arms a timer.
   */
  async scheduleReminder(task) {
    const taskId = task._id ? task._id.toString() : task.id;

    // Cancel any existing timer for this task
    this._cancel(taskId);

    if (!task.dueDate || task.status === 'completed') return;

    const dueDate     = new Date(task.dueDate);
    const reminderAt  = new Date(dueDate.getTime() - REMINDER_MINUTES_BEFORE * 60 * 1000);
    const now         = Date.now();
    const msUntilFire = reminderAt.getTime() - now;

    // Persist the scheduled time so we can recover after restart
    await Task.findByIdAndUpdate(taskId, { reminderScheduledFor: reminderAt });

    if (msUntilFire <= 0) {
      // Already past reminder time — check if reminder was sent
      if (!task.reminderSentAt) {
        logger.info(`Reminder for task "${task.title}" is overdue; firing immediately`, { taskId });
        await this._fire(taskId);
      }
      return;
    }

    logger.info(
      `Reminder scheduled for task "${task.title}" at ${reminderAt.toISOString()} ` +
      `(in ${Math.round(msUntilFire / 60000)} min)`,
      { taskId }
    );

    const handle = setTimeout(() => this._fire(taskId), msUntilFire);
    this._timers.set(taskId, handle);
  }

  /**
   * Cancel reminder for a task (completed / deleted).
   */
  async cancelReminder(taskId) {
    this._cancel(taskId);
    await Task.findByIdAndUpdate(taskId, {
      reminderScheduledFor: null,
    }).catch(() => {}); // best-effort
    logger.info(`Reminder cancelled for task ${taskId}`);
  }

  /**
   * Start the background cron that recovers reminders after restarts.
   * Runs every minute.
   */
  startCron() {
    this._cronJob = cron.schedule('* * * * *', () => this._poll());
    // Also poll immediately on startup
    setTimeout(() => this._poll(), 2000);
    logger.info('Reminder scheduler cron started (polling every minute)');
  }

  stopCron() {
    if (this._cronJob) {
      this._cronJob.stop();
      this._cronJob = null;
    }
    for (const handle of this._timers.values()) clearTimeout(handle);
    this._timers.clear();
  }

  /** ── Internals ──────────────────────────────────────────────────────────── */

  _cancel(taskId) {
    const existing = this._timers.get(taskId);
    if (existing) {
      clearTimeout(existing);
      this._timers.delete(taskId);
    }
  }

  /**
   * Fire the notification for a task.
   */
  async _fire(taskId) {
    this._timers.delete(taskId);

    const task = await Task.findById(taskId);
    if (!task) return;
    if (task.status === 'completed') return;
    if (task.reminderSentAt) return; // idempotent guard

    const now = new Date();

    // ── SIMULATED NOTIFICATION ────────────────────────────────────────────────
    logger.info('🔔 TASK REMINDER NOTIFICATION', {
      taskId,
      title:   task.title,
      dueDate: task.dueDate,
      userId:  task.userId,
      message: `Task "${task.title}" is due in ${REMINDER_MINUTES_BEFORE} minutes!`,
    });

    // Optionally POST to a dummy webhook (e.g. webhook.site)
    const notificationUrl = process.env.NOTIFICATION_WEBHOOK_URL;
    if (notificationUrl) {
      try {
        await axios.post(notificationUrl, {
          event:   'task.reminder',
          taskId,
          title:   task.title,
          dueDate: task.dueDate,
          userId:  task.userId,
          message: `Task "${task.title}" is due in ${REMINDER_MINUTES_BEFORE} minutes!`,
          firedAt: now.toISOString(),
        }, { timeout: 5000 });
        logger.info('Reminder notification webhook delivered', { taskId });
      } catch (err) {
        logger.warn('Reminder notification webhook failed (non-critical)', {
          taskId,
          error: err.message,
        });
      }
    }

    // Mark reminder as sent
    await Task.findByIdAndUpdate(taskId, { reminderSentAt: now });
  }

  /**
   * Cron poll: pick up tasks whose reminder is within the next 2 minutes
   * and that haven't had a reminder sent yet. Re-arms their timers.
   */
  async _poll() {
    try {
      const windowStart = new Date();
      const windowEnd   = new Date(Date.now() + 2 * 60 * 1000); // next 2 min

      const tasks = await Task.find({
        status:               { $ne: 'completed' },
        reminderScheduledFor: { $gte: windowStart, $lte: windowEnd },
        reminderSentAt:       null,
      }).limit(200);

      for (const task of tasks) {
        const taskId = task._id.toString();
        if (this._timers.has(taskId)) continue; // already armed

        const msUntilFire = task.reminderScheduledFor.getTime() - Date.now();
        if (msUntilFire <= 0) {
          await this._fire(taskId);
        } else {
          const handle = setTimeout(() => this._fire(taskId), msUntilFire);
          this._timers.set(taskId, handle);
          logger.info(`Cron re-armed reminder for "${task.title}"`, { taskId });
        }
      }
    } catch (err) {
      logger.error('Reminder cron poll error', { error: err.message });
    }
  }
}

module.exports = new ReminderScheduler();