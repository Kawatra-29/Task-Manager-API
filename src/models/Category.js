const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/postgres');

const Category = sequelize.define('Category', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: { notEmpty: true },
  },
  color: {
    type: DataTypes.STRING(7),   // hex colour e.g. #4F46E5
    allowNull: true,
    defaultValue: '#6B7280',
  },
  icon: {
    type: DataTypes.STRING(10),  // emoji or short code
    allowNull: true,
    defaultValue: '📋',
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id',
  },
}, {
  tableName: 'categories',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { unique: true, fields: ['user_id', 'name'] },
  ],
});

module.exports = Category;