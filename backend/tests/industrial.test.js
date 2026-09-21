const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');



// Mock Firebase Admin
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  credential: { cert: jest.fn() },
  apps: [],
}));

// Set environment variables for testing
process.env.JWT_SECRET = 'test_secret_for_industrial_tests';
process.env.ALLOWED_ORIGINS = '*';

const app = require('../src/index');

describe('🚀 Industrial Security & Stability Suite', () => {
  
  let testUser;
  let testToken;

  beforeAll(async () => {
    const User = mongoose.model('User');
    const { generateToken } = require('../src/middleware/authMiddleware');
    testUser = await User.create({
      email: `test_${Date.now()}@example.com`,
      username: `test_${Date.now()}`,
      role: 'user',
      status: 'active'
    });
    testToken = generateToken(testUser._id.toString(), testUser.email);
  });

  afterAll(async () => {
    if (testUser?._id) {
      const User = mongoose.model('User');
      await User.findByIdAndDelete(testUser._id);
    }
  });

  describe('🛡️ Authentication & Authorization', () => {
    
    test('GET /api/posts - Should fail without Authorization header', async () => {
      const res = await request(app).get('/api/posts');
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Missing or invalid Authorization header');
    });

    test('GET /api/status - Public endpoint should succeed', async () => {
      const res = await request(app).get('/api/status');
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('online');
    });

    test('GET /api/gdpr/users/someid/export - Should fail without Auth', async () => {
      const res = await request(app).get('/api/gdpr/users/someid/export');
      expect(res.statusCode).toBe(401);
    });

    test('POST /api/admin/stats - Should fail for non-admin even if authenticated', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${testToken}`);
      
      // It should be 403 Forbidden because the user role is 'user'
      expect(res.statusCode).toBe(403);
    });
  });

  describe('🧪 Injection & Input Sanitization', () => {
    test('GET /api/users/search - Should handle regex characters safely', async () => {
      const res = await request(app)
        .get('/api/users/search?q=.*')
        .set('Authorization', `Bearer ${testToken}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('💾 Caching System', () => {
    test('Redis service should handle configuration gracefully', () => {
      const redis = require('../src/utils/redis');
      if (process.env.REDIS_URL || process.env.REDIS_HOST) {
        expect(redis.redis).toBeDefined();
        expect(typeof redis.isRedisAvailable).toBe('function');
      } else {
        expect(redis.redis).toBeUndefined();
      }
    });
  });

});
