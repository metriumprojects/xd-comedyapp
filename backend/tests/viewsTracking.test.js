const request = require('supertest');
const mongoose = require('mongoose');
const express = require('express');

describe('Views Calculation & Deduplication System', () => {
  let app;
  let postRoutes;
  let Post;
  let testCreatorId;
  let testViewer1Id;
  let testViewer2Id;
  let testPostId;

  beforeAll(() => {
    // Setup lightweight express app with posts router for fast unit testing
    app = express();
    app.use(express.json());

    // Mock Post model on mongoose if not connected to live DB
    if (!mongoose.models.Post) {
      const mockPostSchema = new mongoose.Schema({
        userId: String,
        viewsCount: { type: Number, default: 0 }
      });
      Post = mongoose.model('Post', mockPostSchema);
    } else {
      Post = mongoose.model('Post');
    }

    testCreatorId = new mongoose.Types.ObjectId().toString();
    testViewer1Id = new mongoose.Types.ObjectId().toString();
    testViewer2Id = new mongoose.Types.ObjectId().toString();
    testPostId = new mongoose.Types.ObjectId().toString();

    // Mock findById for Post model
    jest.spyOn(Post, 'findById').mockImplementation((id) => ({
      select: () => ({
        lean: async () => {
          if (String(id) === String(testPostId)) {
            return { _id: testPostId, userId: testCreatorId, viewsCount: 10 };
          }
          return null;
        }
      })
    }));

    postRoutes = require('../routes/posts');
    app.use('/api/posts', postRoutes);
  });

  beforeEach(() => {
    // Reset test caches before each test
    if (postRoutes._viewTrackingInternal) {
      postRoutes._viewTrackingInternal.pendingViewCounts.clear();
      postRoutes._viewTrackingInternal.recentViewsMap.clear();
      postRoutes._viewTrackingInternal.postCreatorCache.clear();
      postRoutes._viewTrackingInternal.ipRateLimitMap.clear();
    }
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('1. Creator Exclusion', () => {
    it('should ignore view when viewer is the creator of the post', async () => {
      const res = await request(app)
        .post(`/api/posts/${testPostId}/view`)
        .set('x-user-id', testCreatorId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.counted).toBe(false);
      expect(res.body.reason).toBe('creator_view');

      // Verify pending buffer has NOT been incremented
      const pending = postRoutes._viewTrackingInternal.pendingViewCounts.get(testPostId) || 0;
      expect(pending).toBe(0);
    });
  });

  describe('2. Unique Views & 24h Deduplication', () => {
    it('should count the first view from a non-creator viewer', async () => {
      const res = await request(app)
        .post(`/api/posts/${testPostId}/view`)
        .set('x-user-id', testViewer1Id);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.counted).toBe(true);

      const pending = postRoutes._viewTrackingInternal.pendingViewCounts.get(testPostId);
      expect(pending).toBe(1);
    });

    it('should deduplicate multiple views from the same viewer within 24 hours', async () => {
      // First view: should count
      const res1 = await request(app)
        .post(`/api/posts/${testPostId}/view`)
        .set('x-user-id', testViewer1Id);
      expect(res1.body.counted).toBe(true);

      // Second view immediately: should be ignored as duplicate
      const res2 = await request(app)
        .post(`/api/posts/${testPostId}/view`)
        .set('x-user-id', testViewer1Id);
      expect(res2.body.counted).toBe(false);
      expect(res2.body.reason).toBe('duplicate_view');

      // Third view: still ignored
      const res3 = await request(app)
        .post(`/api/posts/${testPostId}/view`)
        .set('x-user-id', testViewer1Id);
      expect(res3.body.counted).toBe(false);
      expect(res3.body.reason).toBe('duplicate_view');

      // Total pending views should only be 1
      const pending = postRoutes._viewTrackingInternal.pendingViewCounts.get(testPostId);
      expect(pending).toBe(1);
    });

    it('should allow a view from a different viewer on the same post', async () => {
      // Viewer 1 views
      await request(app)
        .post(`/api/posts/${testPostId}/view`)
        .set('x-user-id', testViewer1Id);

      // Viewer 2 views
      const resViewer2 = await request(app)
        .post(`/api/posts/${testPostId}/view`)
        .set('x-user-id', testViewer2Id);

      expect(resViewer2.body.counted).toBe(true);

      // Pending buffer should have both views
      const pending = postRoutes._viewTrackingInternal.pendingViewCounts.get(testPostId);
      expect(pending).toBe(2);
    });
  });

  describe('3. Anonymous IP Deduplication', () => {
    it('should deduplicate anonymous views by client IP', async () => {
      // First anonymous view from IP 1.2.3.4
      const res1 = await request(app)
        .post(`/api/posts/${testPostId}/view`)
        .set('x-forwarded-for', '1.2.3.4');
      expect(res1.body.counted).toBe(true);

      // Second view from same IP within 24h
      const res2 = await request(app)
        .post(`/api/posts/${testPostId}/view`)
        .set('x-forwarded-for', '1.2.3.4');
      expect(res2.body.counted).toBe(false);
      expect(res2.body.reason).toBe('duplicate_view');

      // View from different IP 5.6.7.8
      const res3 = await request(app)
        .post(`/api/posts/${testPostId}/view`)
        .set('x-forwarded-for', '5.6.7.8');
      expect(res3.body.counted).toBe(true);
    });
  });

  describe('4. Invalid Post Handling', () => {
    it('should return 400 for invalid post ObjectId', async () => {
      const res = await request(app).post('/api/posts/not-a-valid-id/view');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 if post does not exist', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app).post(`/api/posts/${nonExistentId}/view`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
