require('dotenv').config();
const app               = require('./app');
const { connectPostgres } = require('./config/postgres');
const { connectMongo }    = require('./config/mongo');
const reminderScheduler   = require('./services/reminderScheduler');
const webhookService      = require('./services/webhookService');
const logger              = require('./utils/logger');

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectPostgres();
    await connectMongo();

    // Replay any pending webhooks from a previous run
    await webhookService.replayPending();

    // Start the reminder cron (polls every minute + re-arms timers)
    reminderScheduler.startCron();

    app.listen(PORT, () => {
      logger.info(`🚀 Server running on http://localhost:${PORT}`);
      logger.info(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`❤️  Health: http://localhost:${PORT}/health`);
      logger.info(`🔔 Reminder window: ${process.env.REMINDER_MINUTES_BEFORE || 60} min before due`);
      logger.info(`🪝  Webhook target: ${process.env.WEBHOOK_URL || '(not set)'}`);
    });
  } catch (err) {
    logger.error('❌ Failed to start server', { error: err.message });
    process.exit(1);
  }
};

startServer();