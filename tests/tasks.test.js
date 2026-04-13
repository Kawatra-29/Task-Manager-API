const request  = require('supertest');
const app      = require('../src/app');
const { sequelize } = require('../src/config/postgres');
const mongoose = require('mongoose');
const User     = require('../src/models/User');
const Task     = require('../src/models/Task');
const Category = require('../src/models/Category');

// ── Setup ─────────────────────────────────────────────────────────────────────
beforeAll(async () => {
  process.env.JWT_SECRET    = 'test-secret-key-1234567890';
  process.env.BCRYPT_ROUNDS = '1';

  await sequelize.authenticate();
  await sequelize.sync({ force: true });

  const mongoUri = process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/taskmanager_test';
  if (mongoose.connection.readyState === 0) await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await sequelize.close();
  await mongoose.connection.close();
});

afterEach(async () => {
  await Task.deleteMany({});
  await User.destroy({ where: {} });
  await Category.destroy({ where: {} });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const makeUser = async (email = 'user@example.com') => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'Password1', name: 'Test' });
  return { token: res.body.data.token, userId: res.body.data.user.id };
};

const auth   = (token) => ({ Authorization: `Bearer ${token}` });
const post   = (url, token, body) => request(app).post(url).set(auth(token)).send(body);
const get    = (url, token)       => request(app).get(url).set(auth(token));
const patch  = (url, token, body) => request(app).patch(url).set(auth(token)).send(body);
const del    = (url, token)       => request(app).delete(url).set(auth(token));

const validTask = {
  title: 'Buy groceries', description: 'Milk, eggs', dueDate: '2030-12-31', status: 'pending',
};

// ── CREATE TASK ───────────────────────────────────────────────────────────────
describe('POST /api/tasks', () => {
  let token;
  beforeEach(async () => { ({ token } = await makeUser()); });

  it('creates a task for an authenticated user', async () => {
    const res = await post('/api/tasks', token, validTask);
    expect(res.status).toBe(201);
    expect(res.body.data.task.title).toBe(validTask.title);
    expect(res.body.data.task.status).toBe('pending');
  });

  it('creates a task with only title', async () => {
    const res = await post('/api/tasks', token, { title: 'Minimal' });
    expect(res.status).toBe(201);
    expect(res.body.data.task.title).toBe('Minimal');
  });

  it('creates a task with tags and normalises them', async () => {
    const res = await post('/api/tasks', token, { title: 'Tagged', tags: ['BugFix', 'CLIENT A', 'bugfix'] });
    expect(res.status).toBe(201);
    expect(res.body.data.task.tags).toEqual(expect.arrayContaining(['bugfix', 'client a']));
    expect(res.body.data.task.tags).toHaveLength(2); // deduplicated
  });

  it('creates a task linked to a category', async () => {
    const catRes = await post('/api/categories', token, { name: 'Work', color: '#4F46E5' });
    const catId  = catRes.body.data.category.id;

    const res = await post('/api/tasks', token, { title: 'Work task', categoryId: catId });
    expect(res.status).toBe(201);
    expect(res.body.data.task.categoryId).toBe(catId);
    expect(res.body.data.task.categoryName).toBe('Work');
  });

  it('returns 400 when title is missing', async () => {
    expect((await post('/api/tasks', token, { description: 'No title' })).status).toBe(400);
  });

  it('returns 400 for invalid due date', async () => {
    expect((await post('/api/tasks', token, { title: 'Bad', dueDate: 'not-a-date' })).status).toBe(400);
  });

  it('returns 400 for invalid status', async () => {
    expect((await post('/api/tasks', token, { title: 'Bad', status: 'in-progress' })).status).toBe(400);
  });

  it('returns 404 for a non-existent category', async () => {
    const res = await post('/api/tasks', token, {
      title: 'x', categoryId: '00000000-0000-0000-0000-000000000000',
    });
    expect(res.status).toBe(404);
  });

  it('returns 401 without a token', async () => {
    expect((await request(app).post('/api/tasks').send(validTask)).status).toBe(401);
  });
});

// ── GET ALL TASKS ─────────────────────────────────────────────────────────────
describe('GET /api/tasks', () => {
  let token;
  beforeEach(async () => { ({ token } = await makeUser()); });

  it('returns only the authenticated user's tasks', async () => {
    await post('/api/tasks', token, { title: 'A' });
    await post('/api/tasks', token, { title: 'B' });
    const { token: other } = await makeUser('other@example.com');
    await post('/api/tasks', other, { title: "Other's" });

    const res = await get('/api/tasks', token);
    expect(res.status).toBe(200);
    expect(res.body.data.tasks).toHaveLength(2);
  });

  it('filters by status', async () => {
    await post('/api/tasks', token, { title: 'P', status: 'pending' });
    await post('/api/tasks', token, { title: 'C', status: 'completed' });

    const res = await get('/api/tasks?status=completed', token);
    expect(res.status).toBe(200);
    expect(res.body.data.tasks).toHaveLength(1);
    expect(res.body.data.tasks[0].status).toBe('completed');
  });

  it('filters by categoryId', async () => {
    const catRes = await post('/api/categories', token, { name: 'Work' });
    const catId  = catRes.body.data.category.id;

    await post('/api/tasks', token, { title: 'Work task', categoryId: catId });
    await post('/api/tasks', token, { title: 'No category' });

    const res = await get(`/api/tasks?categoryId=${catId}`, token);
    expect(res.status).toBe(200);
    expect(res.body.data.tasks).toHaveLength(1);
    expect(res.body.data.tasks[0].title).toBe('Work task');
  });

  it('filters by tags (AND logic)', async () => {
    await post('/api/tasks', token, { title: 'T1', tags: ['alpha', 'beta'] });
    await post('/api/tasks', token, { title: 'T2', tags: ['alpha'] });
    await post('/api/tasks', token, { title: 'T3', tags: ['gamma'] });

    const res = await get('/api/tasks?tags=alpha,beta', token);
    expect(res.status).toBe(200);
    expect(res.body.data.tasks).toHaveLength(1);
    expect(res.body.data.tasks[0].title).toBe('T1');
  });

  it('returns 401 without a token', async () => {
    expect((await request(app).get('/api/tasks')).status).toBe(401);
  });
});

// ── GET SINGLE TASK ───────────────────────────────────────────────────────────
describe('GET /api/tasks/:id', () => {
  let token, taskId;
  beforeEach(async () => {
    ({ token } = await makeUser());
    taskId = (await post('/api/tasks', token, validTask)).body.data.task.id;
  });

  it('returns the task for its owner', async () => {
    const res = await get(`/api/tasks/${taskId}`, token);
    expect(res.status).toBe(200);
    expect(res.body.data.task.id).toBe(taskId);
  });

  it('returns 403 for another user', async () => {
    const { token: other } = await makeUser('other@example.com');
    expect((await get(`/api/tasks/${taskId}`, other)).status).toBe(403);
  });

  it('returns 404 for non-existent ID', async () => {
    expect((await get('/api/tasks/507f1f77bcf86cd799439011', token)).status).toBe(404);
  });

  it('returns 400 for malformed ID', async () => {
    expect((await get('/api/tasks/not-valid', token)).status).toBe(400);
  });
});

// ── UPDATE TASK ───────────────────────────────────────────────────────────────
describe('PATCH /api/tasks/:id', () => {
  let token, taskId;
  beforeEach(async () => {
    ({ token } = await makeUser());
    taskId = (await post('/api/tasks', token, validTask)).body.data.task.id;
  });

  it('partially updates task fields', async () => {
    const res = await patch(`/api/tasks/${taskId}`, token, { status: 'completed', title: 'Done' });
    expect(res.status).toBe(200);
    expect(res.body.data.task.status).toBe('completed');
    expect(res.body.data.task.title).toBe('Done');
    expect(res.body.data.task.description).toBe(validTask.description);
  });

  it('sets completedAt when status becomes completed', async () => {
    const res = await patch(`/api/tasks/${taskId}`, token, { status: 'completed' });
    expect(res.status).toBe(200);
    expect(res.body.data.task.completedAt).not.toBeNull();
  });

  it('updates tags on a task', async () => {
    const res = await patch(`/api/tasks/${taskId}`, token, { tags: ['urgent', 'client-b'] });
    expect(res.status).toBe(200);
    expect(res.body.data.task.tags).toEqual(expect.arrayContaining(['urgent', 'client-b']));
  });

  it('updates categoryId on a task', async () => {
    const catId = (await post('/api/categories', token, { name: 'Personal' })).body.data.category.id;
    const res   = await patch(`/api/tasks/${taskId}`, token, { categoryId: catId });
    expect(res.status).toBe(200);
    expect(res.body.data.task.categoryId).toBe(catId);
    expect(res.body.data.task.categoryName).toBe('Personal');
  });

  it('returns 403 for another user', async () => {
    const { token: other } = await makeUser('other@example.com');
    expect((await patch(`/api/tasks/${taskId}`, other, { title: 'Hijack' })).status).toBe(403);
  });

  it('returns 400 for invalid status', async () => {
    expect((await patch(`/api/tasks/${taskId}`, token, { status: 'in-progress' })).status).toBe(400);
  });
});

// ── DELETE TASK ───────────────────────────────────────────────────────────────
describe('DELETE /api/tasks/:id', () => {
  let token, taskId;
  beforeEach(async () => {
    ({ token } = await makeUser());
    taskId = (await post('/api/tasks', token, validTask)).body.data.task.id;
  });

  it('deletes the task for its owner', async () => {
    expect((await del(`/api/tasks/${taskId}`, token)).status).toBe(200);
    expect((await get(`/api/tasks/${taskId}`, token)).status).toBe(404);
  });

  it('returns 403 for another user', async () => {
    const { token: other } = await makeUser('other@example.com');
    expect((await del(`/api/tasks/${taskId}`, other)).status).toBe(403);
  });

  it('returns 404 for non-existent task', async () => {
    expect((await del('/api/tasks/507f1f77bcf86cd799439011', token)).status).toBe(404);
  });
});

// ── GET TAGS ──────────────────────────────────────────────────────────────────
describe('GET /api/tasks/tags', () => {
  let token;
  beforeEach(async () => { ({ token } = await makeUser()); });

  it('returns all unique tags for the user', async () => {
    await post('/api/tasks', token, { title: 'T1', tags: ['alpha', 'beta'] });
    await post('/api/tasks', token, { title: 'T2', tags: ['beta', 'gamma'] });

    const res = await get('/api/tasks/tags', token);
    expect(res.status).toBe(200);
    expect(res.body.data.tags).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('returns empty array when no tags exist', async () => {
    await post('/api/tasks', token, { title: 'No tags' });
    const res = await get('/api/tasks/tags', token);
    expect(res.status).toBe(200);
    expect(res.body.data.tags).toEqual([]);
  });
});