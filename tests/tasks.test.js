const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/config/postgres');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Task = require('../src/models/Task');

// ── test DB setup ──────────────────────────────────────────────────────────────
beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-key-1234567890';
  process.env.BCRYPT_ROUNDS = '1';

  await sequelize.authenticate();
  await sequelize.sync({ force: true });

  const mongoUri =
    process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/taskmanager_test';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }
});

afterAll(async () => {
  await sequelize.close();
  await mongoose.connection.close();
});

afterEach(async () => {
  await Task.deleteMany({});
  await User.destroy({ where: {} });
});

// ── helpers ────────────────────────────────────────────────────────────────────
const makeUser = async (email = 'user@example.com') => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'Password1', name: 'Test' });
  return { token: res.body.data.token, userId: res.body.data.user.id };
};

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

const validTask = {
  title: 'Buy groceries',
  description: 'Milk, eggs, bread',
  dueDate: '2030-12-31',
  status: 'pending',
};

// ── CREATE TASK ───────────────────────────────────────────────────────────────
describe('POST /api/tasks', () => {
  let token;

  beforeEach(async () => {
    ({ token } = await makeUser());
  });

  it('creates a task for an authenticated user', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set(authHeader(token))
      .send(validTask);
    expect(res.status).toBe(201);
    expect(res.body.data.task.title).toBe(validTask.title);
    expect(res.body.data.task.status).toBe('pending');
  });

  it('creates a task with only required field (title)', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set(authHeader(token))
      .send({ title: 'Minimal task' });
    expect(res.status).toBe(201);
    expect(res.body.data.task.title).toBe('Minimal task');
  });

  it('returns 400 when title is missing', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set(authHeader(token))
      .send({ description: 'No title' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid due date', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set(authHeader(token))
      .send({ title: 'Bad date', dueDate: 'not-a-date' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid status', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set(authHeader(token))
      .send({ title: 'Bad status', status: 'in-progress' });
    expect(res.status).toBe(400);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/tasks').send(validTask);
    expect(res.status).toBe(401);
  });
});

// ── GET ALL TASKS ─────────────────────────────────────────────────────────────
describe('GET /api/tasks', () => {
  let token;

  beforeEach(async () => {
    ({ token } = await makeUser());
  });

  it('returns all tasks for the authenticated user', async () => {
    await request(app).post('/api/tasks').set(authHeader(token)).send({ title: 'Task A' });
    await request(app).post('/api/tasks').set(authHeader(token)).send({ title: 'Task B' });

    const res = await request(app).get('/api/tasks').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.tasks).toHaveLength(2);
    expect(res.body.data.pagination.total).toBe(2);
  });

  it('does not return tasks belonging to another user', async () => {
    const { token: otherToken } = await makeUser('other@example.com');
    await request(app).post('/api/tasks').set(authHeader(otherToken)).send({ title: "Other's task" });

    const res = await request(app).get('/api/tasks').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.tasks).toHaveLength(0);
  });

  it('filters tasks by status', async () => {
    await request(app).post('/api/tasks').set(authHeader(token)).send({ title: 'Pending', status: 'pending' });
    await request(app).post('/api/tasks').set(authHeader(token)).send({ title: 'Done', status: 'completed' });

    const res = await request(app).get('/api/tasks?status=completed').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.tasks).toHaveLength(1);
    expect(res.body.data.tasks[0].status).toBe('completed');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
  });
});

// ── GET SINGLE TASK ───────────────────────────────────────────────────────────
describe('GET /api/tasks/:id', () => {
  let token, taskId;

  beforeEach(async () => {
    ({ token } = await makeUser());
    const res = await request(app).post('/api/tasks').set(authHeader(token)).send(validTask);
    taskId = res.body.data.task.id;
  });

  it('returns the task for its owner', async () => {
    const res = await request(app).get(`/api/tasks/${taskId}`).set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.task.id).toBe(taskId);
  });

  it('returns 403 when another user tries to access the task', async () => {
    const { token: otherToken } = await makeUser('other@example.com');
    const res = await request(app).get(`/api/tasks/${taskId}`).set(authHeader(otherToken));
    expect(res.status).toBe(403);
  });

  it('returns 404 for a non-existent task ID', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app).get(`/api/tasks/${fakeId}`).set(authHeader(token));
    expect(res.status).toBe(404);
  });

  it('returns 400 for a malformed task ID', async () => {
    const res = await request(app).get('/api/tasks/not-valid').set(authHeader(token));
    expect(res.status).toBe(400);
  });
});

// ── UPDATE TASK ───────────────────────────────────────────────────────────────
describe('PATCH /api/tasks/:id', () => {
  let token, taskId;

  beforeEach(async () => {
    ({ token } = await makeUser());
    const res = await request(app).post('/api/tasks').set(authHeader(token)).send(validTask);
    taskId = res.body.data.task.id;
  });

  it('updates task fields partially', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set(authHeader(token))
      .send({ status: 'completed', title: 'Updated title' });
    expect(res.status).toBe(200);
    expect(res.body.data.task.status).toBe('completed');
    expect(res.body.data.task.title).toBe('Updated title');
    expect(res.body.data.task.description).toBe(validTask.description); // unchanged
  });

  it('returns 403 when another user tries to update', async () => {
    const { token: otherToken } = await makeUser('other@example.com');
    const res = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set(authHeader(otherToken))
      .send({ title: 'Hijacked' });
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid status value', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set(authHeader(token))
      .send({ status: 'in-progress' });
    expect(res.status).toBe(400);
  });
});

// ── DELETE TASK ───────────────────────────────────────────────────────────────
describe('DELETE /api/tasks/:id', () => {
  let token, taskId;

  beforeEach(async () => {
    ({ token } = await makeUser());
    const res = await request(app).post('/api/tasks').set(authHeader(token)).send(validTask);
    taskId = res.body.data.task.id;
  });

  it('deletes the task for its owner', async () => {
    const res = await request(app).delete(`/api/tasks/${taskId}`).set(authHeader(token));
    expect(res.status).toBe(200);

    const check = await request(app).get(`/api/tasks/${taskId}`).set(authHeader(token));
    expect(check.status).toBe(404);
  });

  it('returns 403 when another user tries to delete', async () => {
    const { token: otherToken } = await makeUser('other@example.com');
    const res = await request(app).delete(`/api/tasks/${taskId}`).set(authHeader(otherToken));
    expect(res.status).toBe(403);
  });

  it('returns 404 for a non-existent task', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app).delete(`/api/tasks/${fakeId}`).set(authHeader(token));
    expect(res.status).toBe(404);
  });
});
