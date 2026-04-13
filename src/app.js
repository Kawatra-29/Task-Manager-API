require('dotenv').config();
const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const morgan       = require('morgan');
const swaggerUi    = require('swagger-ui-express');
const swaggerSpec  = require('./config/swagger');

const authRoutes     = require('./routes/auth');
const taskRoutes     = require('./routes/tasks');
const categoryRoutes = require('./routes/categories');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Relax helmet's CSP so Swagger UI assets load correctly
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Swagger UI ─────────────────────────────────────────────────────────────────
const swaggerUiOptions = {
  customSiteTitle: 'Task Manager API Docs',
  customCss: `
    .topbar-wrapper img { content: url('https://upload.wikimedia.org/wikipedia/commons/a/ab/Swagger-logo.png'); }
    .swagger-ui .topbar { background-color: #1e293b; }
    .swagger-ui .info .title { font-size: 2rem; }
  `,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'list',
    filter: true,
    tryItOutEnabled: true,
  },
};

app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, swaggerUiOptions)
);

// Expose raw OpenAPI JSON (useful for code generation tools)
app.get('/api/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status:    'success',
    message:   'Task Manager API v2 is running',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth',       authRoutes);
app.use('/api/tasks',      taskRoutes);
app.use('/api/categories', categoryRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;