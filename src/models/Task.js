const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
      default: '',
    },
    dueDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'completed'],
        message: 'Status must be either pending or completed',
      },
      default: 'pending',
    },
    completedAt: {
      type: Date,
      default: null,
    },
    userId: {
      type: String,   // PostgreSQL UUID stored as string
      required: [true, 'User ID is required'],
      index: true,
    },
    // ── NEW: Category reference (PostgreSQL UUID stored as string) ────────────
    categoryId: {
      type: String,   // UUID from PostgreSQL categories table
      default: null,
      index: true,
    },
    categoryName: {
      type: String,   // Denormalised for fast reads without joins
      default: null,
    },
    // ── NEW: Tags — free-form, lowercase-normalised ───────────────────────────
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 20,
        message: 'A task can have at most 20 tags',
      },
    },
    // ── NEW: Reminder tracking ────────────────────────────────────────────────
    reminderSentAt: {
      type: Date,
      default: null,
    },
    reminderScheduledFor: {
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

// Compound indexes for common query patterns
taskSchema.index({ userId: 1, createdAt: -1 });
taskSchema.index({ userId: 1, status: 1 });
taskSchema.index({ userId: 1, categoryId: 1 });
taskSchema.index({ userId: 1, tags: 1 });
taskSchema.index({ dueDate: 1, status: 1, reminderSentAt: 1 });

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;