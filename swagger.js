const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Task Manager API',
      version: '1.0.0',
      description: `
A secure, production-ready RESTful API for Task Management.

## Architecture
- **Users** are stored in **PostgreSQL** (via Sequelize ORM) — relational integrity, unique email constraints, ACID guarantees.
- **Tasks** are stored in **MongoDB** (via Mongoose ODM) — flexible document model, efficient user-scoped queries.
- Cross-database ownership is enforced at the application layer using the PostgreSQL user UUID stored in each MongoDB task document.

## Authentication
All protected endpoints require a **Bearer JWT token** in the \`Authorization\` header:
\`\`\`
Authorization: Bearer <your_token>
\`\`\`
Obtain a token via \`POST /api/auth/register\` or \`POST /api/auth/login\`.
      `,
      contact: {
        name: 'Task Manager API Support',
        email: 'support@taskmanager.example.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local Development Server',
      },
      {
        url: 'https://api.taskmanager.example.com',
        description: 'Production Server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token. Obtain it from /api/auth/login or /api/auth/register',
        },
      },
      schemas: {
        // ── User ──────────────────────────────────────────────────────────────
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
              description: 'PostgreSQL UUID primary key',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'alice@example.com',
            },
            name: {
              type: 'string',
              example: 'Alice',
              nullable: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-01T00:00:00.000Z',
            },
          },
        },

        // ── Task ──────────────────────────────────────────────────────────────
        Task: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: '64f1a2b3c4d5e6f7a8b9c0d1',
              description: 'MongoDB ObjectId',
            },
            title: {
              type: 'string',
              maxLength: 200,
              example: 'Submit assignment',
            },
            description: {
              type: 'string',
              maxLength: 2000,
              example: 'Push to GitHub and share the link with the team',
              default: '',
            },
            dueDate: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-12-31T00:00:00.000Z',
            },
            status: {
              type: 'string',
              enum: ['pending', 'completed'],
              default: 'pending',
              example: 'pending',
            },
            userId: {
              type: 'string',
              format: 'uuid',
              example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
              description: 'Owner\'s PostgreSQL UUID',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-01T00:00:00.000Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-02T12:00:00.000Z',
            },
          },
        },

        // ── Pagination ────────────────────────────────────────────────────────
        Pagination: {
          type: 'object',
          properties: {
            total: { type: 'integer', example: 42 },
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            totalPages: { type: 'integer', example: 3 },
          },
        },

        // ── Request Bodies ────────────────────────────────────────────────────
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'alice@example.com',
            },
            password: {
              type: 'string',
              minLength: 8,
              example: 'SecurePass1',
              description: 'Min 8 chars, at least 1 uppercase letter, at least 1 number',
            },
            name: {
              type: 'string',
              maxLength: 100,
              example: 'Alice',
              description: 'Optional display name',
            },
          },
        },

        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'alice@example.com',
            },
            password: {
              type: 'string',
              example: 'SecurePass1',
            },
          },
        },

        CreateTaskRequest: {
          type: 'object',
          required: ['title'],
          properties: {
            title: {
              type: 'string',
              maxLength: 200,
              example: 'Submit assignment',
            },
            description: {
              type: 'string',
              maxLength: 2000,
              example: 'Push to GitHub and share link',
            },
            dueDate: {
              type: 'string',
              format: 'date',
              example: '2025-12-31',
              description: 'ISO 8601 date string',
            },
            status: {
              type: 'string',
              enum: ['pending', 'completed'],
              default: 'pending',
              example: 'pending',
            },
          },
        },

        UpdateTaskRequest: {
          type: 'object',
          description: 'All fields are optional — only provided fields are updated (PATCH semantics)',
          properties: {
            title: {
              type: 'string',
              maxLength: 200,
              example: 'Submit assignment — DONE',
            },
            description: {
              type: 'string',
              maxLength: 2000,
              example: 'Updated description',
            },
            dueDate: {
              type: 'string',
              format: 'date',
              example: '2026-01-15',
            },
            status: {
              type: 'string',
              enum: ['pending', 'completed'],
              example: 'completed',
            },
          },
        },

        // ── Responses ─────────────────────────────────────────────────────────
        AuthSuccessResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'success' },
            message: { type: 'string', example: 'User registered successfully' },
            data: {
              type: 'object',
              properties: {
                token: {
                  type: 'string',
                  example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                  description: 'JWT token — valid for 7 days by default',
                },
                user: { $ref: '#/components/schemas/User' },
              },
            },
          },
        },

        TaskResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'success' },
            data: {
              type: 'object',
              properties: {
                task: { $ref: '#/components/schemas/Task' },
              },
            },
          },
        },

        TaskListResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'success' },
            data: {
              type: 'object',
              properties: {
                tasks: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Task' },
                },
                pagination: { $ref: '#/components/schemas/Pagination' },
              },
            },
          },
        },

        // ── Errors ────────────────────────────────────────────────────────────
        ErrorResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'error' },
            message: { type: 'string', example: 'Human-readable error description' },
          },
        },

        ValidationErrorResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'error' },
            message: { type: 'string', example: 'Validation failed' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string', example: 'email' },
                  message: { type: 'string', example: 'Must be a valid email address' },
                },
              },
            },
          },
        },
      },

      // ── Reusable responses ─────────────────────────────────────────────────
      responses: {
        Unauthorized: {
          description: 'Missing, invalid, or expired JWT token',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { status: 'error', message: 'Access token required. Use Authorization: Bearer <token>' },
            },
          },
        },
        Forbidden: {
          description: 'Authenticated but not the owner of this resource',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { status: 'error', message: 'You do not have permission to access this task' },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { status: 'error', message: 'Task not found' },
            },
          },
        },
        BadRequest: {
          description: 'Validation failure or malformed request',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
            },
          },
        },
        InternalError: {
          description: 'Unexpected server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { status: 'error', message: 'Internal Server Error' },
            },
          },
        },
      },

      // ── Reusable parameters ────────────────────────────────────────────────
      parameters: {
        TaskId: {
          name: 'id',
          in: 'path',
          required: true,
          description: 'MongoDB ObjectId of the task (24-character hex string)',
          schema: {
            type: 'string',
            pattern: '^[a-f\\d]{24}$',
            example: '64f1a2b3c4d5e6f7a8b9c0d1',
          },
        },
      },
    },

    // ── Tags ──────────────────────────────────────────────────────────────────
    tags: [
      {
        name: 'Health',
        description: 'Server health check',
      },
      {
        name: 'Auth',
        description: 'User registration, login, and profile endpoints',
      },
      {
        name: 'Tasks',
        description: 'CRUD operations for tasks (all require authentication)',
      },
    ],

    // ── Paths ─────────────────────────────────────────────────────────────────
    paths: {
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Server health check',
          description: 'Returns a simple status message confirming the API is up and running.',
          operationId: 'healthCheck',
          responses: {
            200: {
              description: 'API is running',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'success' },
                      message: { type: 'string', example: 'Task Manager API is running' },
                      timestamp: { type: 'string', format: 'date-time', example: '2025-01-01T00:00:00.000Z' },
                    },
                  },
                },
              },
            },
          },
        },
      },

      '/api/auth/register': {
        post: {
          tags: ['Auth'],
          summary: 'Register a new user',
          description: `
Creates a new user account and returns a JWT token.

**Password requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one number

The password is hashed with bcrypt (configurable rounds, default 12) and is never returned in any response.
          `,
          operationId: 'register',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RegisterRequest' },
                examples: {
                  fullRegistration: {
                    summary: 'Registration with all fields',
                    value: { email: 'alice@example.com', password: 'SecurePass1', name: 'Alice' },
                  },
                  minimalRegistration: {
                    summary: 'Registration without name',
                    value: { email: 'bob@example.com', password: 'MyPassword9' },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'User registered successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AuthSuccessResponse' },
                  example: {
                    status: 'success',
                    message: 'User registered successfully',
                    data: {
                      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                      user: {
                        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                        email: 'alice@example.com',
                        name: 'Alice',
                        createdAt: '2025-01-01T00:00:00.000Z',
                      },
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            409: {
              description: 'Email address already registered',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                  example: { status: 'error', message: 'A user with this email already exists' },
                },
              },
            },
            500: { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Login with email and password',
          description: `
Authenticates an existing user and returns a JWT token.

The token is valid for **7 days** by default (configurable via \`JWT_EXPIRES_IN\`).
Store it securely and include it in the \`Authorization\` header for all protected requests.

> **Security note:** Both "email not found" and "wrong password" return the same \`401\` response to prevent user enumeration.
          `,
          operationId: 'login',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginRequest' },
                example: { email: 'alice@example.com', password: 'SecurePass1' },
              },
            },
          },
          responses: {
            200: {
              description: 'Login successful',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AuthSuccessResponse' },
                  example: {
                    status: 'success',
                    message: 'Login successful',
                    data: {
                      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                      user: {
                        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                        email: 'alice@example.com',
                        name: 'Alice',
                        createdAt: '2025-01-01T00:00:00.000Z',
                      },
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            401: {
              description: 'Invalid credentials',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                  example: { status: 'error', message: 'Invalid email or password' },
                },
              },
            },
            500: { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Get current user profile',
          description: `
Returns the profile of the currently authenticated user.

The JWT middleware verifies the token **and** re-fetches the user from PostgreSQL on every request, ensuring the account still exists even if deleted after token issuance.
          `,
          operationId: 'getProfile',
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: 'User profile retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'success' },
                      data: {
                        type: 'object',
                        properties: {
                          user: { $ref: '#/components/schemas/User' },
                        },
                      },
                    },
                  },
                },
              },
            },
            401: { $ref: '#/components/responses/Unauthorized' },
            500: { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/tasks': {
        post: {
          tags: ['Tasks'],
          summary: 'Create a new task',
          description: `
Creates a task owned by the authenticated user.

The task is stored in MongoDB. The owner's PostgreSQL UUID is saved in the \`userId\` field as a cross-database foreign key.

Only \`title\` is required. All other fields default to empty string / \`null\` / \`"pending"\`.
          `,
          operationId: 'createTask',
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateTaskRequest' },
                examples: {
                  fullTask: {
                    summary: 'Task with all fields',
                    value: {
                      title: 'Submit assignment',
                      description: 'Push to GitHub and share link',
                      dueDate: '2025-12-31',
                      status: 'pending',
                    },
                  },
                  minimalTask: {
                    summary: 'Task with title only',
                    value: { title: 'Buy groceries' },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Task created successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'success' },
                      message: { type: 'string', example: 'Task created successfully' },
                      data: {
                        type: 'object',
                        properties: {
                          task: { $ref: '#/components/schemas/Task' },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            401: { $ref: '#/components/responses/Unauthorized' },
            500: { $ref: '#/components/responses/InternalError' },
          },
        },

        get: {
          tags: ['Tasks'],
          summary: 'Get all tasks for the current user',
          description: `
Returns a paginated list of tasks belonging to the authenticated user.

Tasks are sorted by **creation date descending** (newest first).

Only the owner's tasks are returned — tasks belonging to other users are never visible.
          `,
          operationId: 'getAllTasks',
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: 'status',
              in: 'query',
              required: false,
              description: 'Filter tasks by status',
              schema: { type: 'string', enum: ['pending', 'completed'] },
              example: 'pending',
            },
            {
              name: 'page',
              in: 'query',
              required: false,
              description: 'Page number for pagination (1-based)',
              schema: { type: 'integer', minimum: 1, default: 1 },
              example: 1,
            },
            {
              name: 'limit',
              in: 'query',
              required: false,
              description: 'Number of tasks per page',
              schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
              example: 20,
            },
          ],
          responses: {
            200: {
              description: 'Tasks retrieved successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/TaskListResponse' },
                  example: {
                    status: 'success',
                    data: {
                      tasks: [
                        {
                          id: '64f1a2b3c4d5e6f7a8b9c0d1',
                          title: 'Submit assignment',
                          description: 'Push to GitHub',
                          dueDate: '2025-12-31T00:00:00.000Z',
                          status: 'pending',
                          userId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                          createdAt: '2025-01-01T00:00:00.000Z',
                          updatedAt: '2025-01-01T00:00:00.000Z',
                        },
                      ],
                      pagination: { total: 42, page: 1, limit: 20, totalPages: 3 },
                    },
                  },
                },
              },
            },
            401: { $ref: '#/components/responses/Unauthorized' },
            500: { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      '/api/tasks/{id}': {
        get: {
          tags: ['Tasks'],
          summary: 'Get a single task by ID',
          description: `
Retrieves a specific task by its MongoDB ObjectId.

**Ownership enforcement:** If the task exists but belongs to a different user, \`403 Forbidden\` is returned — not \`404\`. This correctly signals "the resource exists but you don't own it."
          `,
          operationId: 'getTask',
          security: [{ BearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/TaskId' }],
          responses: {
            200: {
              description: 'Task retrieved successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/TaskResponse' },
                },
              },
            },
            400: {
              description: 'Invalid MongoDB ObjectId format',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
                  example: {
                    status: 'error',
                    message: 'Validation failed',
                    errors: [{ field: 'id', message: 'Invalid task ID format' }],
                  },
                },
              },
            },
            401: { $ref: '#/components/responses/Unauthorized' },
            403: { $ref: '#/components/responses/Forbidden' },
            404: { $ref: '#/components/responses/NotFound' },
            500: { $ref: '#/components/responses/InternalError' },
          },
        },

        patch: {
          tags: ['Tasks'],
          summary: 'Partially update a task',
          description: `
Updates one or more fields of an existing task using **PATCH semantics** — only the fields present in the request body are modified; all other fields retain their current values.

This prevents accidental data loss when clients send partial payloads.

**Ownership check:** Only the task owner may update it.
          `,
          operationId: 'updateTask',
          security: [{ BearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/TaskId' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UpdateTaskRequest' },
                examples: {
                  markComplete: {
                    summary: 'Mark a task as completed',
                    value: { status: 'completed' },
                  },
                  updateTitle: {
                    summary: 'Update title and due date',
                    value: { title: 'Revised task title', dueDate: '2026-03-01' },
                  },
                  fullUpdate: {
                    summary: 'Update all fields',
                    value: {
                      title: 'Updated task',
                      description: 'New description',
                      dueDate: '2026-06-30',
                      status: 'completed',
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Task updated successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'success' },
                      message: { type: 'string', example: 'Task updated successfully' },
                      data: {
                        type: 'object',
                        properties: {
                          task: { $ref: '#/components/schemas/Task' },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            401: { $ref: '#/components/responses/Unauthorized' },
            403: { $ref: '#/components/responses/Forbidden' },
            404: { $ref: '#/components/responses/NotFound' },
            500: { $ref: '#/components/responses/InternalError' },
          },
        },

        delete: {
          tags: ['Tasks'],
          summary: 'Delete a task',
          description: `
Permanently deletes a task from MongoDB.

**Ownership check:** Only the task owner may delete it. Attempting to delete another user's task returns \`403 Forbidden\`.

This operation is **irreversible**.
          `,
          operationId: 'deleteTask',
          security: [{ BearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/TaskId' }],
          responses: {
            200: {
              description: 'Task deleted successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'success' },
                      message: { type: 'string', example: 'Task deleted successfully' },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Invalid MongoDB ObjectId format',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
                },
              },
            },
            401: { $ref: '#/components/responses/Unauthorized' },
            403: { $ref: '#/components/responses/Forbidden' },
            404: { $ref: '#/components/responses/NotFound' },
            500: { $ref: '#/components/responses/InternalError' },
          },
        },
      },
    },
  },
  apis: [], // All paths defined inline above
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;