/**
 * WebhookService
 *
 * DESIGN: Retry Logic
 * ─────────────────────────────────────────────────────────────────────────────
 * Delivery uses exponential backoff:  delay = baseDelay * 2^(attempt-1)
 *   Attempt 1: immediate
 *   Attempt 2: 5 s
 *   Attempt 3: 10 s  (max 3 attempts by default)
 *
 * All attempts are persisted in MongoDB via WebhookLog so that delivery state
 * survives process restarts (the retry scheduler re-queues pending logs on
 * startup). This also provides an audit trail.
 *
 * A configurable WEBHOOK_URL environment variable controls the target.
 * If not set, deliveries are skipped (logged as "no target configured").
 */

const axios = require('axios');
const WebhookLog = require('../models/WebhookLog');
const logger = require('../utils/logger');

const MAX_ATTEMPTS  = 3;
const BASE_DELAY_MS = 5000;  // 5 s

class WebhookService {
  /**
   * Schedule a task.completed webhook.
   * Creates a log entry then kicks off the first delivery attempt.
   */
  async scheduleTaskCompleted(task, userId) {
    const targetUrl = process.env.WEBHOOK_URL;

    const payload = {
      event:       'task.completed',
      taskId:      task._id ? task._id.toString() : task.id,
      title:       task.title,
      completedAt: task.completedAt || new Date(),
      userId,
    };

    if (!targetUrl) {
      logger.warn('WEBHOOK_URL not configured — skipping webhook for task.completed', {
        taskId: payload.taskId,
      });
      return null;
    }

    const log = await WebhookLog.create({
      taskId:    payload.taskId,
      userId,
      event:     'task.completed',
      payload,
      targetUrl,
      status:    'pending',
    });

    // Fire first attempt asynchronously (don't await — non-blocking)
    this._attempt(log._id.toString(), 1).catch((err) =>
      logger.error('Webhook initial attempt threw unexpectedly', { err: err.message })
    );

    return log;
  }

  /**
   * Internal: perform a single delivery attempt.
   * Schedules the next retry with exponential backoff on failure.
   */
  async _attempt(logId, attemptNumber) {
    const log = await WebhookLog.findById(logId);
    if (!log || log.status === 'delivered') return;

    logger.info(`Webhook attempt ${attemptNumber}/${MAX_ATTEMPTS}`, {
      logId,
      targetUrl: log.targetUrl,
      event:     log.event,
      taskId:    log.taskId,
    });

    log.attempts      = attemptNumber;
    log.lastAttemptAt = new Date();

    try {
      await axios.post(log.targetUrl, log.payload, {
        timeout: 8000,
        headers: { 'Content-Type': 'application/json', 'X-Event': log.event },
      });

      log.status      = 'delivered';
      log.deliveredAt = new Date();
      log.lastError   = null;
      await log.save();

      logger.info('Webhook delivered successfully', {
        logId,
        taskId:    log.taskId,
        attempts:  attemptNumber,
      });
    } catch (err) {
      const errMsg = err.response
        ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`
        : err.message;

      log.lastError = errMsg;
      logger.warn(`Webhook attempt ${attemptNumber} failed`, { logId, error: errMsg });

      if (attemptNumber < MAX_ATTEMPTS) {
        const delayMs       = BASE_DELAY_MS * Math.pow(2, attemptNumber - 1);
        log.nextRetryAt     = new Date(Date.now() + delayMs);
        log.status          = 'pending';
        await log.save();

        logger.info(`Scheduling retry ${attemptNumber + 1} in ${delayMs / 1000}s`, { logId });

        setTimeout(() => {
          this._attempt(logId, attemptNumber + 1).catch((e) =>
            logger.error('Webhook retry threw unexpectedly', { error: e.message })
          );
        }, delayMs);
      } else {
        log.status      = 'failed';
        log.nextRetryAt = null;
        await log.save();
        logger.error('Webhook permanently failed after max attempts', {
          logId,
          taskId: log.taskId,
          attempts: attemptNumber,
        });
      }
    }
  }

  /**
   * On server startup: re-queue any webhook logs that are still pending
   * (e.g. from a previous crash). Adds a short stagger to avoid thundering herd.
   */
  async replayPending() {
    const pendingLogs = await WebhookLog.find({ status: 'pending' }).limit(100);
    if (pendingLogs.length === 0) return;

    logger.info(`Replaying ${pendingLogs.length} pending webhook(s) from previous run`);

    pendingLogs.forEach((log, i) => {
      const delay = i * 2000; // stagger by 2 s each
      setTimeout(() => {
        const nextAttempt = (log.attempts || 0) + 1;
        if (nextAttempt <= MAX_ATTEMPTS) {
          this._attempt(log._id.toString(), nextAttempt).catch((e) =>
            logger.error('Replay attempt threw', { error: e.message })
          );
        } else {
          // Already exhausted — mark failed
          WebhookLog.findByIdAndUpdate(log._id, { status: 'failed' }).catch(() => {});
        }
      }, delay);
    });
  }
}

module.exports = new WebhookService();