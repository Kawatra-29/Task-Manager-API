const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT) || 5432,
  database: process.env.PG_DATABASE || 'taskmanager',
  username: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || '',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

const connectPostgres = async () => {
  await sequelize.authenticate();
  console.log('✅ PostgreSQL connected');
  await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
  console.log('✅ PostgreSQL models synced');
};

module.exports = { sequelize, connectPostgres };