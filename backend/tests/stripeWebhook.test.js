const request = require('supertest');
const mongoose = require('mongoose');

// Mock Firebase Admin to prevent startup auth errors in test environment
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  credential: { cert: jest.fn() },
  apps: [],
}));

process.env.JWT_SECRET = 'test_secret_for_webhook_tests';
process.env.ALLOWED_ORIGINS = '*';

const app = require('../src/index');
const redis = require('../src/utils/redis');
const stripeService = require('../src/services/stripeService');

describe('💳 Stripe Webhook Idempotency & Financial Safety Suite', () => {
  const testEventId = `evt_test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const lockKey = `stripe:evt:${testEventId}`;

  afterAll(async () => {
    // Clean up test keys
    await redis.releaseLock(lockKey);
    await redis.del(lockKey);
  });

  describe('🔐 Redis Atomic Idempotency Locks', () => {
    test('acquireLock should grant lock for new key and deny for duplicate', async () => {
      const firstAttempt = await redis.acquireLock(lockKey, 60);
      expect(firstAttempt).toBe(true);

      // Second attempt on the same key must be rejected (idempotency guard)
      const secondAttempt = await redis.acquireLock(lockKey, 60);
      expect(secondAttempt).toBe(false);

      // Release lock and verify it can be re-acquired
      await redis.releaseLock(lockKey);
      const reAcquire = await redis.acquireLock(lockKey, 60);
      expect(reAcquire).toBe(true);

      // Clean up
      await redis.releaseLock(lockKey);
    });
  });

  describe('📡 POST /api/subscriptions/webhook Endpoint', () => {
    let constructSpy;
    let handleSpy;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    afterAll(() => {
      if (constructSpy) constructSpy.mockRestore();
      if (handleSpy) handleSpy.mockRestore();
    });

    test('should reject request without stripe-signature header', async () => {
      const res = await request(app)
        .post('/api/subscriptions/webhook')
        .send({ id: 'evt_no_sig' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('Missing stripe-signature header');
    });

    test('should process new webhook event and return 200 OK', async () => {
      const uniqueEvtId = `evt_new_${Date.now()}`;
      const mockEvent = {
        id: uniqueEvtId,
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_test_123', status: 'active' } }
      };

      constructSpy = jest.spyOn(stripeService, 'constructWebhookEvent').mockReturnValue(mockEvent);
      handleSpy = jest.spyOn(stripeService, 'handleWebhookEvent').mockResolvedValue(true);

      const res = await request(app)
        .post('/api/subscriptions/webhook')
        .set('stripe-signature', 't=123,v1=test_sig')
        .send(JSON.stringify(mockEvent));

      expect(res.statusCode).toBe(200);
      expect(res.body.received).toBe(true);
      expect(handleSpy).toHaveBeenCalledTimes(1);

      // Clean up
      await redis.releaseLock(`stripe:evt:${uniqueEvtId}`);
    });

    test('should detect duplicate webhook retry and return idempotent: true without re-processing', async () => {
      const duplicateEvtId = `evt_dup_${Date.now()}`;
      const mockEvent = {
        id: duplicateEvtId,
        type: 'invoice.payment_succeeded',
        data: { object: { id: 'in_test_456', subscription: 'sub_test_123' } }
      };

      constructSpy = jest.spyOn(stripeService, 'constructWebhookEvent').mockReturnValue(mockEvent);
      handleSpy = jest.spyOn(stripeService, 'handleWebhookEvent').mockResolvedValue(true);

      // First webhook delivery
      const firstRes = await request(app)
        .post('/api/subscriptions/webhook')
        .set('stripe-signature', 't=123,v1=test_sig')
        .send(JSON.stringify(mockEvent));

      expect(firstRes.statusCode).toBe(200);
      expect(firstRes.body.received).toBe(true);
      expect(handleSpy).toHaveBeenCalledTimes(1);

      // Immediate Stripe retry delivery (exact same event ID)
      const retryRes = await request(app)
        .post('/api/subscriptions/webhook')
        .set('stripe-signature', 't=123,v1=test_sig')
        .send(JSON.stringify(mockEvent));

      expect(retryRes.statusCode).toBe(200);
      expect(retryRes.body.received).toBe(true);
      expect(retryRes.body.idempotent).toBe(true);
      expect(retryRes.body.eventId).toBe(duplicateEvtId);
      // Ensure handleWebhookEvent was NOT called a second time!
      expect(handleSpy).toHaveBeenCalledTimes(1);

      // Clean up
      await redis.releaseLock(`stripe:evt:${duplicateEvtId}`);
    });
  });
});
