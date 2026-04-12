// Custom API error class
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// 404 handler — mount before errorHandler
const notFound = (req, res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
};

// Global error handler
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Sequelize unique constraint (e.g. duplicate email)
  if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 409;
    message = 'A user with this email already exists';
  }

  // Sequelize validation errors
  if (err.name === 'SequelizeValidationError') {
    statusCode = 400;
    message = err.errors.map((e) => e.message).join(', ');
  }

  // Mongoose CastError (bad ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
  }

  // Log non-operational errors
  if (!err.isOperational) {
    console.error('💥 Unexpected error:', err);
  }

  res.status(statusCode).json({
    status: 'error',
    message,
    ...(process.env.NODE_ENV === 'development' && !err.isOperational && { stack: err.stack }),
  });
};

module.exports = { AppError, notFound, errorHandler };
