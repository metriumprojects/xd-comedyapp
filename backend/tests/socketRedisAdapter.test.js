const http = require('http');
const initSockets = require('../src/loaders/socket');

// Mock Firebase Admin
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  credential: { cert: jest.fn() },
  apps: [],
}));

describe('⚡ Socket.IO Redis Adapter & Scaling Suite', () => {
  let server;
  let io;

  beforeAll((done) => {
    server = http.createServer();
    server.listen(0, () => {
      done();
    });
  });

  afterAll((done) => {
    if (io) {
      if (io.redisPubClient) {
        try { io.redisPubClient.disconnect(); } catch (_) {}
      }
      if (io.redisSubClient) {
        try { io.redisSubClient.disconnect(); } catch (_) {}
      }
      io.close();
    }
    if (server) {
      server.close(() => done());
    } else {
      done();
    }
  });

  test('initSockets should initialize Server and attach Redis clients when configured', () => {
    io = initSockets(server, 'test_jwt_secret');
    expect(io).toBeDefined();
    expect(typeof io.on).toBe('function');
    expect(typeof io.to).toBe('function');

    // Check if Redis clients were set up when REDIS_URL is present
    if (process.env.REDIS_URL || process.env.REDIS_HOST) {
      expect(io.redisPubClient).toBeDefined();
      expect(io.redisSubClient).toBeDefined();
    }
  });
});
