const winston = require('winston');
const path = require('path');

const logDir = path.join(process.cwd(), 'logs');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` | ${JSON.stringify(meta)}` : '';
      return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      silent: process.env.NODE_ENV === 'test',
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'notifications.log'),
      level: 'info',
      silent: process.env.NODE_ENV === 'test',
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      silent: process.env.NODE_ENV === 'test',
    }),
  ],
});

// Ensure log directory exists
const fs = require('fs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

module.exports = logger;