const mongoose = require('mongoose');

const webhookLogSchema = new mongoose.Schema(
  {
    taskId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
    },
    event: {
      type: String,
      enum: ['task.completed'],
      required: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    targetUrl: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'delivered', 'failed'],
      default: 'pending',
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lastAttemptAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      default: null,
    },
    nextRetryAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

const WebhookLog = mongoose.model('WebhookLog', webhookLogSchema);

module.exports = WebhookLog;