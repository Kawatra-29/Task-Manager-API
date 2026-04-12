require('dotenv').config();
const app = require('./app');
const { connectPostgres } = require('./config/postgres');
const { connectMongo } = require('./config/mongo');

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectPostgres();
    await connectMongo();

    app.listen(PORT, () => {
      console.log(`\n🚀 Server running on http://localhost:${PORT}`);
      console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`❤️  Health check: http://localhost:${PORT}/health\n`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
};

startServer();
