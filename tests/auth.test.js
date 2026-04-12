const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/config/postgres');
const mongoose = require('mongoose');
const User = require('../src/models/User');

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
  await User.destroy({ where: {} });
});

// ── helpers ────────────────────────────────────────────────────────────────────
const validUser = {
  email: 'test@example.com',
  password: 'Password1',
  name: 'Test User',
};

const registerUser = (overrides = {}) =>
  request(app)
    .post('/api/auth/register')
    .send({ ...validUser, ...overrides });

// ── REGISTER ──────────────────────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  it('registers a new user and returns a token', async () => {
    const res = await registerUser();
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe(validUser.email);
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('returns 409 when email already exists', async () => {
    await registerUser();
    const res = await registerUser();
    expect(res.status).toBe(409);
  });

  it('returns 400 for invalid email', async () => {
    const res = await registerUser({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  it('returns 400 when password is too short', async () => {
    const res = await registerUser({ password: 'abc' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when password has no uppercase letter', async () => {
    const res = await registerUser({ password: 'password1' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when password has no number', async () => {
    const res = await registerUser({ password: 'Password' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ password: 'Password1' });
    expect(res.status).toBe(400);
  });
});

// ── LOGIN ─────────────────────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await registerUser();
  });

  it('logs in with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: validUser.email, password: validUser.password });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: validUser.email, password: 'WrongPass1' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@example.com', password: 'Password1' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when fields are missing', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });
});

// ── GET /me ───────────────────────────────────────────────────────────────────
describe('GET /api/auth/me', () => {
  let token;

  beforeEach(async () => {
    const res = await registerUser();
    token = res.body.data.token;
  });

  it('returns the authenticated user profile', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(validUser.email);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with a malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
  });
});
