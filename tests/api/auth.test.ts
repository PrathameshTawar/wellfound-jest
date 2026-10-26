import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../../app';
import User from '../../models/User';
import { createTestUser } from '../helpers/testData';
import { generateToken, getAuthHeaders } from '../helpers/authHelper';

describe('Auth & App API', () => {
  describe('GET / - Health Check', () => {
    it('should return 200 with server status message', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok', message: 'Salon Backend is running!' });
    });
  });

  describe('POST /api/register', () => {
    it('should successfully register a new user as customer with 201 status', async () => {
      const payload = {
        name: 'Alice Wonderland',
        email: 'alice@example.com',
        password: 'securePassword123'
      };

      const res = await request(app)
        .post('/api/register')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('message', 'User registered successfully');

      // Verify persistence in DB
      const userInDb = await User.findOne({ email: payload.email });
      expect(userInDb).not.toBeNull();
      expect(userInDb!.name).toBe(payload.name);
      expect(userInDb!.role).toBe('customer');

      // Verify password was securely hashed
      const isPasswordHashed = await bcrypt.compare(payload.password, userInDb!.password!);
      expect(isPasswordHashed).toBe(true);
      expect(userInDb!.password).not.toBe(payload.password);
    });

    it('should reject registration when email is already registered with 400 status', async () => {
      await createTestUser({ email: 'duplicate@example.com' });

      const payload = {
        name: 'Another User',
        email: 'duplicate@example.com',
        password: 'password123'
      };

      const res = await request(app)
        .post('/api/register')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Email already in use');
    });

    it('should return error when mandatory fields are missing', async () => {
      const res = await request(app)
        .post('/api/register')
        .send({ name: 'Incomplete User' }); // missing email and password

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error', 'Server error');
    });
  });

  describe('POST /api/login', () => {
    it('should successfully authenticate user with valid credentials and return JWT token', async () => {
      const plainPassword = 'mysecretpassword';
      const user = await createTestUser({
        name: 'Bob Builder',
        email: 'bob@example.com',
        password: plainPassword,
        role: 'customer'
      });

      const res = await request(app)
        .post('/api/login')
        .send({
          email: 'bob@example.com',
          password: plainPassword
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('role', 'customer');
      expect(res.body).toHaveProperty('userId', user._id.toString());

      // Verify JWT token signature and payload
      const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET || 'supersecretjwtkey_12345') as any;
      expect(decoded.userId).toBe(user._id.toString());
      expect(decoded.role).toBe('customer');
    });

    it('should successfully authenticate an admin user and return role admin', async () => {
      const plainPassword = 'adminpassword';
      const admin = await createTestUser({
        name: 'Admin Boss',
        email: 'admin@salon.com',
        password: plainPassword,
        role: 'admin'
      });

      const res = await request(app)
        .post('/api/login')
        .send({
          email: 'admin@salon.com',
          password: plainPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('admin');
      expect(res.body.userId).toBe(admin._id.toString());
    });

    it('should successfully authenticate a stylist user and return role stylist', async () => {
      const plainPassword = 'stylistpassword';
      const stylist = await createTestUser({
        name: 'Stylist Star',
        email: 'stylist@salon.com',
        password: plainPassword,
        role: 'stylist'
      });

      const res = await request(app)
        .post('/api/login')
        .send({
          email: 'stylist@salon.com',
          password: plainPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('stylist');
      expect(res.body.userId).toBe(stylist._id.toString());
    });

    it('should reject login when user email does not exist with 400 status', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should reject login when password is incorrect with 400 status', async () => {
      await createTestUser({
        email: 'existing@example.com',
        password: 'correctPassword'
      });

      const res = await request(app)
        .post('/api/login')
        .send({
          email: 'existing@example.com',
          password: 'wrongPassword'
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid credentials');
    });
  });

  describe('Authentication Middleware Verification', () => {
    it('should return 401 when Authorization header is missing on protected route', async () => {
      const res = await request(app)
        .post('/api/bookings')
        .send({});

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Authentication required');
    });

    it('should return 401 when an invalid JWT token is supplied', async () => {
      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', 'Bearer invalid.token.payload')
        .send({});

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Invalid token');
    });

    it('should return 401 when token refers to a deleted user ID', async () => {
      const nonExistentUserId = new mongoose.Types.ObjectId();
      const token = generateToken(nonExistentUserId, 'customer');

      const res = await request(app)
        .post('/api/bookings')
        .set(getAuthHeaders(token))
        .send({});

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'User not found');
    });
  });
});
