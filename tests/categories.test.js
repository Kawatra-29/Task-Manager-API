const request  = require('supertest');
const app      = require('../src/app');
const { sequelize } = require('../src/config/postgres');
const mongoose = require('mongoose');
const User     = require('../src/models/User');
const Category = require('../src/models/Category');
const Task     = require('../src/models/Task');

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
  await Category.destroy({ where: {} });
  await User.destroy({ where: {} });
});

const makeUser = async (email = 'user@example.com') => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'Password1', name: 'Test' });
  return { token: res.body.data.token, userId: res.body.data.user.id };
};

const auth  = (token) => ({ Authorization: `Bearer ${token}` });
const post  = (url, token, body) => request(app).post(url).set(auth(token)).send(body);
const get   = (url, token)       => request(app).get(url).set(auth(token));
const patch = (url, token, body) => request(app).patch(url).set(auth(token)).send(body);
const del   = (url, token)       => request(app).delete(url).set(auth(token));

// ── CREATE CATEGORY ───────────────────────────────────────────────────────────
describe('POST /api/categories', () => {
  let token;
  beforeEach(async () => { ({ token } = await makeUser()); });

  it('creates a category with name, color, icon', async () => {
    const res = await post('/api/categories', token, {
      name: 'Work', color: '#4F46E5', icon: '💼',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.category.name).toBe('Work');
    expect(res.body.data.category.color).toBe('#4F46E5');
  });

  it('creates a category with defaults for color and icon', async () => {
    const res = await post('/api/categories', token, { name: 'Personal' });
    expect(res.status).toBe(201);
    expect(res.body.data.category.color).toBeDefined();
  });

  it('returns 400 when name is missing', async () => {
    expect((await post('/api/categories', token, { color: '#fff' })).status).toBe(400);
  });

  it('returns 400 for invalid hex color', async () => {
    expect((await post('/api/categories', token, { name: 'X', color: 'red' })).status).toBe(400);
  });

  it('returns 409 for duplicate name per user', async () => {
    await post('/api/categories', token, { name: 'Work' });
    expect((await post('/api/categories', token, { name: 'Work' })).status).toBe(409);
  });

  it('allows same name for different users', async () => {
    const { token: other } = await makeUser('other@example.com');
    await post('/api/categories', token, { name: 'Work' });
    expect((await post('/api/categories', other, { name: 'Work' })).status).toBe(201);
  });

  it('returns 401 without token', async () => {
    expect((await request(app).post('/api/categories').send({ name: 'X' })).status).toBe(401);
  });
});

// ── GET ALL CATEGORIES ────────────────────────────────────────────────────────
describe('GET /api/categories', () => {
  let token;
  beforeEach(async () => { ({ token } = await makeUser()); });

  it('returns all categories for the user', async () => {
    await post('/api/categories', token, { name: 'Work' });
    await post('/api/categories', token, { name: 'Personal' });

    const res = await get('/api/categories', token);
    expect(res.status).toBe(200);
    expect(res.body.data.categories).toHaveLength(2);
  });

  it('does not return other users\' categories', async () => {
    const { token: other } = await makeUser('other@example.com');
    await post('/api/categories', other, { name: 'Private' });

    const res = await get('/api/categories', token);
    expect(res.status).toBe(200);
    expect(res.body.data.categories).toHaveLength(0);
  });
});

// ── UPDATE CATEGORY ───────────────────────────────────────────────────────────
describe('PATCH /api/categories/:id', () => {
  let token, catId;
  beforeEach(async () => {
    ({ token } = await makeUser());
    catId = (await post('/api/categories', token, { name: 'Work' })).body.data.category.id;
  });

  it('updates category name and color', async () => {
    const res = await patch(`/api/categories/${catId}`, token, { name: 'Career', color: '#059669' });
    expect(res.status).toBe(200);
    expect(res.body.data.category.name).toBe('Career');
    expect(res.body.data.category.color).toBe('#059669');
  });

  it('returns 404 for another user\'s category', async () => {
    const { token: other } = await makeUser('other@example.com');
    expect((await patch(`/api/categories/${catId}`, other, { name: 'X' })).status).toBe(404);
  });
});

// ── DELETE CATEGORY ───────────────────────────────────────────────────────────
describe('DELETE /api/categories/:id', () => {
  let token, catId;
  beforeEach(async () => {
    ({ token } = await makeUser());
    catId = (await post('/api/categories', token, { name: 'Temp' })).body.data.category.id;
  });

  it('deletes the category', async () => {
    expect((await del(`/api/categories/${catId}`, token)).status).toBe(200);
    expect((await get(`/api/categories/${catId}`, token)).status).toBe(404);
  });

  it('unlinks tasks after category deletion', async () => {
    const taskRes = await post('/api/tasks', token, { title: 'Task', categoryId: catId });
    const taskId  = taskRes.body.data.task.id;

    await del(`/api/categories/${catId}`, token);

    const taskCheck = await get(`/api/tasks/${taskId}`, token);
    expect(taskCheck.body.data.task.categoryId).toBeNull();
  });

  it('returns 404 for another user\'s category', async () => {
    const { token: other } = await makeUser('other@example.com');
    expect((await del(`/api/categories/${catId}`, other)).status).toBe(404);
  });
});