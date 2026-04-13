const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Task Manager API',
      version: '2.0.0',
      description: `
A secure, production-ready Task Management REST API.

**Features:**
- JWT authentication
- Task categorisation & free-form tags
- Real-time reminders (fires 60 min before due date by default)
- Webhook delivery on task completion with exponential-backoff retry

**Auth:** All protected endpoints require \`Authorization: Bearer <token>\`.
      `.trim(),
      contact: { name: 'Task Manager API' },
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Local development' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /api/auth/login or /api/auth/register',
        },
      },
      schemas: {
        // ── Auth ────────────────────────────────────────────────────────────
        RegisterBody: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email:    { type: 'string', format: 'email', example: 'alice@example.com' },
            password: { type: 'string', minLength: 8, example: 'SecurePass1', description: 'Min 8 chars, 1 uppercase, 1 number' },
            name:     { type: 'string', maxLength: 100, example: 'Alice' },
          },
        },
        LoginBody: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email:    { type: 'string', format: 'email', example: 'alice@example.com' },
            password: { type: 'string', example: 'SecurePass1' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id:        { type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
            email:     { type: 'string', format: 'email', example: 'alice@example.com' },
            name:      { type: 'string', example: 'Alice' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            status:  { type: 'string', example: 'success' },
            message: { type: 'string', example: 'Login successful' },
            data: {
              type: 'object',
              properties: {
                token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIs...' },
                user:  { $ref: '#/components/schemas/User' },
              },
            },
          },
        },
        // ── Category ────────────────────────────────────────────────────────
        CategoryBody: {
          type: 'object',
          required: ['name'],
          properties: {
            name:  { type: 'string', maxLength: 100, example: 'Work' },
            color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$', example: '#4F46E5' },
            icon:  { type: 'string', maxLength: 10, example: '💼' },
          },
        },
        Category: {
          type: 'object',
          properties: {
            id:        { type: 'string', format: 'uuid' },
            name:      { type: 'string', example: 'Work' },
            color:     { type: 'string', example: '#4F46E5' },
            icon:      { type: 'string', example: '💼' },
            userId:    { type: 'string', format: 'uuid' },
            created_at:{ type: 'string', format: 'date-time' },
            updated_at:{ type: 'string', format: 'date-time' },
          },
        },
        // ── Task ────────────────────────────────────────────────────────────
        TaskBody: {
          type: 'object',
          required: ['title'],
          properties: {
            title:       { type: 'string', maxLength: 200, example: 'Submit assignment' },
            description: { type: 'string', maxLength: 2000, example: 'Push to GitHub and share link' },
            dueDate:     { type: 'string', format: 'date', example: '2025-12-31', description: 'Schedules a reminder 60 min before (configurable)' },
            status:      { type: 'string', enum: ['pending', 'completed'], default: 'pending' },
            categoryId:  { type: 'string', format: 'uuid', nullable: true, example: null },
            tags:        { type: 'array', items: { type: 'string', maxLength: 50 }, maxItems: 20, example: ['urgent', 'client-a'] },
          },
        },
        TaskUpdateBody: {
          type: 'object',
          properties: {
            title:       { type: 'string', maxLength: 200, example: 'Updated title' },
            description: { type: 'string', maxLength: 2000 },
            dueDate:     { type: 'string', format: 'date', nullable: true, description: 'Rescheduling cancels the old reminder and creates a new one' },
            status:      { type: 'string', enum: ['pending', 'completed'], description: 'Setting completed fires the analytics webhook and cancels reminder' },
            categoryId:  { type: 'string', format: 'uuid', nullable: true },
            tags:        { type: 'array', items: { type: 'string' }, maxItems: 20 },
          },
        },
        Task: {
          type: 'object',
          properties: {
            id:                   { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d1' },
            title:                { type: 'string', example: 'Submit assignment' },
            description:          { type: 'string', example: 'Push to GitHub' },
            dueDate:              { type: 'string', format: 'date-time', nullable: true },
            status:               { type: 'string', enum: ['pending', 'completed'] },
            completedAt:          { type: 'string', format: 'date-time', nullable: true },
            categoryId:           { type: 'string', format: 'uuid', nullable: true },
            categoryName:         { type: 'string', nullable: true, example: 'Work' },
            tags:                 { type: 'array', items: { type: 'string' }, example: ['urgent', 'client-a'] },
            reminderScheduledFor: { type: 'string', format: 'date-time', nullable: true },
            reminderSentAt:       { type: 'string', format: 'date-time', nullable: true },
            userId:               { type: 'string', format: 'uuid' },
            createdAt:            { type: 'string', format: 'date-time' },
            updatedAt:            { type: 'string', format: 'date-time' },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            total:      { type: 'integer', example: 42 },
            page:       { type: 'integer', example: 1 },
            limit:      { type: 'integer', example: 20 },
            totalPages: { type: 'integer', example: 3 },
          },
        },
        // ── Errors ──────────────────────────────────────────────────────────
        ErrorResponse: {
          type: 'object',
          properties: {
            status:  { type: 'string', example: 'error' },
            message: { type: 'string', example: 'Validation failed' },
          },
        },
        ValidationErrorResponse: {
          type: 'object',
          properties: {
            status:  { type: 'string', example: 'error' },
            message: { type: 'string', example: 'Validation failed' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field:   { type: 'string', example: 'email' },
                  message: { type: 'string', example: 'Must be a valid email address' },
                },
              },
            },
          },
        },
      },
      // ── Reusable responses ───────────────────────────────────────────────
      responses: {
        Unauthorized: {
          description: 'Missing, invalid, or expired JWT token',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { status: 'error', message: 'Access token required. Use Authorization: Bearer <token>' } } },
        },
        Forbidden: {
          description: 'Authenticated but not the resource owner',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { status: 'error', message: 'You do not have permission to access this task' } } },
        },
        NotFound: {
          description: 'Resource not found',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { status: 'error', message: 'Task not found' } } },
        },
        BadRequest: {
          description: 'Validation error',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidationErrorResponse' } } },
        },
        Conflict: {
          description: 'Resource already exists',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { status: 'error', message: 'A user with this email already exists' } } },
        },
      },
      // ── Reusable parameters ──────────────────────────────────────────────
      parameters: {
        taskId: {
          name: 'id', in: 'path', required: true,
          description: 'MongoDB ObjectId (24-char hex)',
          schema: { type: 'string', pattern: '^[a-f\\d]{24}$', example: '64f1a2b3c4d5e6f7a8b9c0d1' },
        },
        categoryId: {
          name: 'id', in: 'path', required: true,
          description: 'PostgreSQL UUID',
          schema: { type: 'string', format: 'uuid' },
        },
      },
    },

    // ── Paths ──────────────────────────────────────────────────────────────
    paths: {
      // Health
      '/health': {
        get: {
          tags: ['System'],
          summary: 'Health check',
          responses: {
            200: {
              description: 'API is running',
              content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' }, message: { type: 'string' }, timestamp: { type: 'string', format: 'date-time' } } } } },
            },
          },
        },
      },

      // Auth
      '/api/auth/register': {
        post: {
          tags: ['Auth'],
          summary: 'Register a new user',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterBody' } } } },
          responses: {
            201: { description: 'User registered', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
            400: { $ref: '#/components/responses/BadRequest' },
            409: { $ref: '#/components/responses/Conflict' },
          },
        },
      },
      '/api/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Login and receive a JWT',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginBody' } } } },
          responses: {
            200: { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
            400: { $ref: '#/components/responses/BadRequest' },
            401: { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
      '/api/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Get current user profile',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'User profile', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' }, data: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } } } } } } },
            401: { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },

      // Categories
      '/api/categories': {
        post: {
          tags: ['Categories'],
          summary: 'Create a category',
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CategoryBody' } } } },
          responses: {
            201: { description: 'Category created', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' }, data: { type: 'object', properties: { category: { $ref: '#/components/schemas/Category' } } } } } } } },
            400: { $ref: '#/components/responses/BadRequest' },
            401: { $ref: '#/components/responses/Unauthorized' },
            409: { $ref: '#/components/responses/Conflict' },
          },
        },
        get: {
          tags: ['Categories'],
          summary: 'List all categories for the authenticated user',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Category list', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' }, data: { type: 'object', properties: { categories: { type: 'array', items: { $ref: '#/components/schemas/Category' } } } } } } } } },
            401: { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
      '/api/categories/{id}': {
        parameters: [{ $ref: '#/components/parameters/categoryId' }],
        get: {
          tags: ['Categories'],
          summary: 'Get a category by ID',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Category', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' }, data: { type: 'object', properties: { category: { $ref: '#/components/schemas/Category' } } } } } } } },
            401: { $ref: '#/components/responses/Unauthorized' },
            404: { $ref: '#/components/responses/NotFound' },
          },
        },
        patch: {
          tags: ['Categories'],
          summary: 'Update a category (partial)',
          description: 'Changing `name` also propagates to `categoryName` on all tasks in this category.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name:  { type: 'string', maxLength: 100 },
                    color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
                    icon:  { type: 'string', maxLength: 10 },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Category updated', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' }, message: { type: 'string' }, data: { type: 'object', properties: { category: { $ref: '#/components/schemas/Category' } } } } } } } },
            400: { $ref: '#/components/responses/BadRequest' },
            401: { $ref: '#/components/responses/Unauthorized' },
            404: { $ref: '#/components/responses/NotFound' },
          },
        },
        delete: {
          tags: ['Categories'],
          summary: 'Delete a category',
          description: 'Also sets `categoryId = null` on all tasks that referenced this category.',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Category deleted', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' }, message: { type: 'string' } } } } } },
            401: { $ref: '#/components/responses/Unauthorized' },
            404: { $ref: '#/components/responses/NotFound' },
          },
        },
      },

      // Tasks
      '/api/tasks': {
        post: {
          tags: ['Tasks'],
          summary: 'Create a task',
          description: 'If `dueDate` is provided, a reminder is automatically scheduled for `REMINDER_MINUTES_BEFORE` minutes before the due time (default 60).',
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TaskBody' } } } },
          responses: {
            201: { description: 'Task created', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' }, message: { type: 'string' }, data: { type: 'object', properties: { task: { $ref: '#/components/schemas/Task' } } } } } } } },
            400: { $ref: '#/components/responses/BadRequest' },
            401: { $ref: '#/components/responses/Unauthorized' },
            404: { description: 'categoryId not found or not owned by user', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
        get: {
          tags: ['Tasks'],
          summary: 'List tasks with optional filtering and pagination',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'status',     in: 'query', schema: { type: 'string', enum: ['pending', 'completed'] }, description: 'Filter by task status' },
            { name: 'categoryId', in: 'query', schema: { type: 'string', format: 'uuid' }, description: 'Filter by category UUID' },
            { name: 'tags',       in: 'query', schema: { type: 'string' }, example: 'urgent,client-a', description: 'Comma-separated tags — task must have ALL listed tags' },
            { name: 'page',       in: 'query', schema: { type: 'integer', default: 1, minimum: 1 } },
            { name: 'limit',      in: 'query', schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 } },
          ],
          responses: {
            200: {
              description: 'Paginated task list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string' },
                      data: {
                        type: 'object',
                        properties: {
                          tasks:      { type: 'array', items: { $ref: '#/components/schemas/Task' } },
                          pagination: { $ref: '#/components/schemas/Pagination' },
                        },
                      },
                    },
                  },
                },
              },
            },
            401: { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
      '/api/tasks/tags': {
        get: {
          tags: ['Tasks'],
          summary: 'Get all unique tags used by the current user',
          description: 'Returns a sorted array of all distinct tag strings across all tasks owned by the authenticated user.',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Unique tags', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' }, data: { type: 'object', properties: { tags: { type: 'array', items: { type: 'string' }, example: ['alpha', 'beta', 'urgent'] } } } } } } } },
            401: { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
      '/api/tasks/{id}': {
        parameters: [{ $ref: '#/components/parameters/taskId' }],
        get: {
          tags: ['Tasks'],
          summary: 'Get a task by ID',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Task', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' }, data: { type: 'object', properties: { task: { $ref: '#/components/schemas/Task' } } } } } } } },
            400: { $ref: '#/components/responses/BadRequest' },
            401: { $ref: '#/components/responses/Unauthorized' },
            403: { $ref: '#/components/responses/Forbidden' },
            404: { $ref: '#/components/responses/NotFound' },
          },
        },
        patch: {
          tags: ['Tasks'],
          summary: 'Partially update a task',
          description: `All fields are optional.

**Side effects:**
- \`status: "completed"\` → sets \`completedAt\`, cancels reminder, fires \`task.completed\` webhook to \`WEBHOOK_URL\`
- \`dueDate\` changed → cancels old reminder, schedules new one
- \`status: "pending"\` (on a completed task) → clears \`completedAt\`
- \`categoryId: null\` → unlinks category`,
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TaskUpdateBody' } } } },
          responses: {
            200: { description: 'Task updated', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' }, message: { type: 'string' }, data: { type: 'object', properties: { task: { $ref: '#/components/schemas/Task' } } } } } } } },
            400: { $ref: '#/components/responses/BadRequest' },
            401: { $ref: '#/components/responses/Unauthorized' },
            403: { $ref: '#/components/responses/Forbidden' },
            404: { $ref: '#/components/responses/NotFound' },
          },
        },
        delete: {
          tags: ['Tasks'],
          summary: 'Delete a task',
          description: 'Cancels any pending reminder before deletion.',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Task deleted', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' }, message: { type: 'string' } } } } } },
            400: { $ref: '#/components/responses/BadRequest' },
            401: { $ref: '#/components/responses/Unauthorized' },
            403: { $ref: '#/components/responses/Forbidden' },
            404: { $ref: '#/components/responses/NotFound' },
          },
        },
      },
    },

    tags: [
      { name: 'System',     description: 'Health & status' },
      { name: 'Auth',       description: 'Register, login, profile' },
      { name: 'Categories', description: 'Manage task categories (per-user, stored in PostgreSQL)' },
      { name: 'Tasks',      description: 'Task CRUD with reminders, categories, tags & webhooks' },
    ],
  },
  apis: [], // all paths defined inline above
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;